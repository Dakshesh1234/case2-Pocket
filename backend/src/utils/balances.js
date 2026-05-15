const { pool } = require('../db');

/**
 * Calculate net balance for each member of a group.
 * Positive = others owe you. Negative = you owe others.
 */
async function calculateNetBalances(groupId) {
  // Get all expense splits with payer info
  const expenseRows = await pool.query(
    `SELECT e.paid_by, es.user_id, es.amount AS split_amount
     FROM expenses e
     JOIN expense_splits es ON e.id = es.expense_id
     WHERE e.group_id = $1`,
    [groupId]
  );

  // Get all settlements
  const settlementRows = await pool.query(
    `SELECT from_user, to_user, amount FROM settlements WHERE group_id = $1`,
    [groupId]
  );

  // Get all members with names
  const memberRows = await pool.query(
    `SELECT u.id, u.name FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = $1`,
    [groupId]
  );

  const balances = {};
  for (const m of memberRows.rows) {
    balances[m.id] = { amount: 0, name: m.name };
  }

  // For each (expense, split) pair:
  // - payer gets +split_amount (someone owes them)
  // - split user gets -split_amount (they owe that amount)
  // When paid_by === user_id, these cancel out (you don't owe yourself)
  for (const row of expenseRows.rows) {
    const payer = String(row.paid_by);
    const splitter = String(row.user_id);
    const amt = parseFloat(row.split_amount);

    if (!balances[payer]) balances[payer] = { amount: 0, name: 'Unknown' };
    if (!balances[splitter]) balances[splitter] = { amount: 0, name: 'Unknown' };

    balances[payer].amount += amt;
    balances[splitter].amount -= amt;
  }

  // Apply settlements: from_user paid to_user, so debt decreases
  for (const s of settlementRows.rows) {
    const from = String(s.from_user);
    const to = String(s.to_user);
    const amt = parseFloat(s.amount);

    if (!balances[from]) balances[from] = { amount: 0, name: 'Unknown' };
    if (!balances[to]) balances[to] = { amount: 0, name: 'Unknown' };

    balances[from].amount += amt;   // debtor paid up
    balances[to].amount -= amt;     // creditor received
  }

  // Round to 2 decimal places
  for (const id of Object.keys(balances)) {
    balances[id].amount = Math.round(balances[id].amount * 100) / 100;
  }

  return balances;
}

/**
 * Given net balances, compute minimum set of transactions to settle all debts.
 * Uses a greedy two-pointer algorithm.
 *
 * Example: A=+66.67, B=-33.33, C=-33.33
 * => B pays A $33.33, C pays A $33.33 (2 transactions)
 *
 * Example: A=+50, B=-20, C=+10, D=-40
 * => D pays A $40, then B pays A $10, then B pays C $10 (3 transactions vs 4 naive)
 */
function minimizeTransactions(balances) {
  const creditors = []; // positive balance (owed money)
  const debtors = [];   // negative balance (owes money)

  for (const [userId, { amount, name }] of Object.entries(balances)) {
    if (amount > 0.01) creditors.push({ userId, amount, name });
    else if (amount < -0.01) debtors.push({ userId, amount: -amount, name });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  while (creditors.length > 0 && debtors.length > 0) {
    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0.01) {
      transactions.push({
        from: { userId: debtor.userId, name: debtor.name },
        to: { userId: creditor.userId, name: creditor.name },
        amount: rounded,
      });
    }

    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;
    debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;

    if (creditor.amount <= 0.01) creditors.shift();
    if (debtor.amount <= 0.01) debtors.shift();
  }

  return transactions;
}

module.exports = { calculateNetBalances, minimizeTransactions };
