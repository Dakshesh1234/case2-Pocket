const router = require('express').Router();
const { pool, createNotification } = require('../db');
const authMiddleware = require('../middleware/auth');

// Get expenses for a group
router.get('/groups/:groupId/expenses', authMiddleware, async (req, res) => {
  try {
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.userId]
    );
    if (memberCheck.rows.length === 0)
      return res.status(403).json({ error: 'Not a member' });

    const expenses = await pool.query(
      `SELECT e.*, u.name as paid_by_name,
        json_agg(json_build_object('userId', es.user_id, 'amount', es.amount, 'name', su.name)) as splits
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       JOIN expense_splits es ON es.expense_id = e.id
       JOIN users su ON su.id = es.user_id
       WHERE e.group_id = $1
       GROUP BY e.id, u.name
       ORDER BY e.created_at DESC`,
      [req.params.groupId]
    );
    res.json({ expenses: expenses.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add expense to a group
router.post('/groups/:groupId/expenses', authMiddleware, async (req, res) => {
  const { description, amount, paid_by, splits, category } = req.body;

  if (!description || !amount || !paid_by || !splits || splits.length === 0)
    return res.status(400).json({ error: 'description, amount, paid_by, and splits required' });

  const totalSplits = splits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  if (Math.abs(totalSplits - parseFloat(amount)) > 0.02)
    return res.status(400).json({ error: `Splits total (${totalSplits.toFixed(2)}) must equal amount (${parseFloat(amount).toFixed(2)})` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify payer and all split members belong to group
    const memberCheck = await client.query(
      'SELECT user_id FROM group_members WHERE group_id = $1',
      [req.params.groupId]
    );
    const memberIds = memberCheck.rows.map(r => String(r.user_id));
    if (!memberIds.includes(String(paid_by)))
      return res.status(400).json({ error: 'Payer is not a group member' });
    for (const s of splits) {
      if (!memberIds.includes(String(s.userId)))
        return res.status(400).json({ error: `User ${s.userId} is not a group member` });
    }

    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, description, amount, paid_by, created_by, category)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.groupId, description, amount, paid_by, req.userId, category || 'general']
    );
    const expense = expenseResult.rows[0];

    for (const split of splits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)',
        [expense.id, split.userId, split.amount]
      );
    }

    await client.query(
      `INSERT INTO audit_log (group_id, user_id, action, details)
       VALUES ($1, $2, 'expense_added', $3)`,
      [req.params.groupId, req.userId, JSON.stringify({ description, amount, paid_by })]
    );

    // Get group name and creator name for notification
    const groupRes = await client.query('SELECT name FROM groups WHERE id = $1', [req.params.groupId]);
    const creatorRes = await client.query('SELECT name FROM users WHERE id = $1', [req.userId]);
    const groupName = groupRes.rows[0]?.name || 'Unknown';
    const creatorName = creatorRes.rows[0]?.name || 'Someone';

    // Notify all split members (except the creator)
    for (const split of splits) {
      if (String(split.userId) !== String(req.userId)) {
        await createNotification(client, {
          userId: split.userId,
          groupId: parseInt(req.params.groupId),
          type: 'expense_added',
          message: `${creatorName} added "${description}" ($${parseFloat(amount).toFixed(2)}) in ${groupName}`,
          details: { expenseId: expense.id, amount: split.amount, description }
        });
      }
    }

    await client.query('COMMIT');
    res.json({ expense });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Delete expense
router.delete('/expenses/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const expenseResult = await client.query(
      'SELECT * FROM expenses WHERE id = $1',
      [req.params.id]
    );
    if (expenseResult.rows.length === 0)
      return res.status(404).json({ error: 'Expense not found' });

    const expense = expenseResult.rows[0];
    // Only creator or payer can delete
    if (String(expense.created_by) !== String(req.userId) && String(expense.paid_by) !== String(req.userId))
      return res.status(403).json({ error: 'Not authorized to delete this expense' });

    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [req.params.id]);
    await client.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);

    await client.query(
      `INSERT INTO audit_log (group_id, user_id, action, details)
       VALUES ($1, $2, 'expense_deleted', $3)`,
      [expense.group_id, req.userId, JSON.stringify({ description: expense.description, amount: expense.amount })]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
