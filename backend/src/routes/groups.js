const router = require('express').Router();
const { pool, createNotification, notifyGroupMembers } = require('../db');
const authMiddleware = require('../middleware/auth');
const { calculateNetBalances, minimizeTransactions } = require('../utils/balances');

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get all groups for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.name as creator_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT COUNT(*) FROM expenses WHERE group_id = g.id) as expense_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = g.created_by
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.userId]
    );
    res.json({ groups: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let inviteCode = generateInviteCode();
    // Ensure unique invite code
    let exists = true;
    while (exists) {
      const check = await client.query('SELECT id FROM groups WHERE invite_code = $1', [inviteCode]);
      exists = check.rows.length > 0;
      if (exists) inviteCode = generateInviteCode();
    }

    const groupResult = await client.query(
      'INSERT INTO groups (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, inviteCode, req.userId]
    );
    const group = groupResult.rows[0];

    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.userId]
    );

    await client.query(
      `INSERT INTO audit_log (group_id, user_id, action, details)
       VALUES ($1, $2, 'group_created', $3)`,
      [group.id, req.userId, JSON.stringify({ name })]
    );

    // Self-notification for group creation
    await createNotification(client, {
      userId: req.userId,
      groupId: group.id,
      type: 'group_created',
      message: `You created "${name}"`,
      details: { groupName: name, inviteCode: inviteCode }
    });

    await client.query('COMMIT');
    res.json({ group });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get group details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (memberCheck.rows.length === 0)
      return res.status(403).json({ error: 'Not a member of this group' });

    const groupResult = await pool.query(
      `SELECT g.*, u.name as creator_name FROM groups g
       JOIN users u ON u.id = g.created_by
       WHERE g.id = $1`,
      [req.params.id]
    );
    if (groupResult.rows.length === 0)
      return res.status(404).json({ error: 'Group not found' });

    res.json({ group: groupResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get group members
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, gm.joined_at
       FROM users u JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [req.params.id]
    );
    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join group via invite code
router.post('/join/:code', authMiddleware, async (req, res) => {
  try {
    const groupResult = await pool.query(
      'SELECT * FROM groups WHERE invite_code = $1',
      [req.params.code.toUpperCase()]
    );
    if (groupResult.rows.length === 0)
      return res.status(404).json({ error: 'Invalid invite code' });

    const group = groupResult.rows[0];
    const alreadyMember = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group.id, req.userId]
    );
    if (alreadyMember.rows.length > 0)
      return res.status(409).json({ error: 'Already a member', group });

    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.userId]
    );
    await pool.query(
      `INSERT INTO audit_log (group_id, user_id, action, details)
       VALUES ($1, $2, 'member_joined', $3)`,
      [group.id, req.userId, JSON.stringify({ name: req.userName })]
    );

    // Notify existing members that someone joined
    const joinerName = req.userName || 'Someone';
    await notifyGroupMembers(pool, {
      groupId: group.id,
      excludeUserId: req.userId,
      type: 'member_joined',
      message: `${joinerName} joined "${group.name}"`,
      details: { memberName: joinerName }
    });

    res.json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get balances for a group
router.get('/:id/balances', authMiddleware, async (req, res) => {
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (memberCheck.rows.length === 0)
      return res.status(403).json({ error: 'Not a member' });

    const netBalances = await calculateNetBalances(req.params.id);
    const transactions = minimizeTransactions(netBalances);
    res.json({ netBalances, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get audit log
router.get('/:id/audit', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.name as user_name
       FROM audit_log al
       JOIN users u ON u.id = al.user_id
       WHERE al.group_id = $1
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    res.json({ log: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
