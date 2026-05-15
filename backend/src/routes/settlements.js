const router = require('express').Router();
const { pool, createNotification } = require('../db');
const authMiddleware = require('../middleware/auth');
const { calculateNetBalances, minimizeTransactions } = require('../utils/balances');

// Settle a transaction (from_user pays to_user)
router.post('/groups/:groupId/settle', authMiddleware, async (req, res) => {
  const { from_user, to_user, amount, note } = req.body;

  if (!from_user || !to_user || !amount)
    return res.status(400).json({ error: 'from_user, to_user, and amount required' });

  const actorIsPayer = String(from_user) === String(req.userId);
  const actorIsPayee = String(to_user) === String(req.userId);
  if (!actorIsPayer && !actorIsPayee)
    return res.status(403).json({ error: 'You can only settle transactions you are part of' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const memberCheck = await client.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    if (memberCheck.rows.length === 0)
      return res.status(403).json({ error: 'Not a member of this group' });

    const result = await client.query(
      `INSERT INTO settlements (group_id, from_user, to_user, amount, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.groupId, from_user, to_user, amount, note || null]
    );

    const fromUser = await client.query('SELECT name FROM users WHERE id = $1', [from_user]);
    const toUser = await client.query('SELECT name FROM users WHERE id = $1', [to_user]);
    const fromName = fromUser.rows[0]?.name;
    const toName = toUser.rows[0]?.name;

    await client.query(
      `INSERT INTO audit_log (group_id, user_id, action, details)
       VALUES ($1, $2, 'settled_up', $3)`,
      [
        req.params.groupId,
        req.userId,
        JSON.stringify({
          from: fromName,
          to: toName,
          amount,
          recorded_by: actorIsPayer ? 'payer' : 'payee',
        }),
      ]
    );

    const groupRes = await client.query('SELECT name FROM groups WHERE id = $1', [req.params.groupId]);
    const groupName = groupRes.rows[0]?.name || 'Unknown';
    const amountStr = parseFloat(amount).toFixed(2);

    // Notify the other party
    const recipientId = actorIsPayer ? to_user : from_user;
    const message = actorIsPayer
      ? `${fromName} paid you $${amountStr} in ${groupName}`
      : `${toName} marked your $${amountStr} payment as received in ${groupName}`;
    await createNotification(client, {
      userId: recipientId,
      groupId: parseInt(req.params.groupId),
      type: 'settlement',
      message,
      details: {
        settlementId: result.rows[0].id,
        amount,
        from: fromName,
        to: toName,
        recorded_by: actorIsPayer ? 'payer' : 'payee',
      }
    });

    await client.query('COMMIT');

    // Return updated balances
    const netBalances = await calculateNetBalances(req.params.groupId);
    const transactions = minimizeTransactions(netBalances);
    res.json({ settlement: result.rows[0], netBalances, transactions });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get settlement history for a group
router.get('/groups/:groupId/settlements', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, fu.name as from_name, tu.name as to_name
       FROM settlements s
       JOIN users fu ON fu.id = s.from_user
       JOIN users tu ON tu.id = s.to_user
       WHERE s.group_id = $1
       ORDER BY s.created_at DESC`,
      [req.params.groupId]
    );
    res.json({ settlements: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
