require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      invite_code VARCHAR(10) UNIQUE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      paid_by INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      category VARCHAR(50) DEFAULT 'general',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      amount DECIMAL(10,2) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      from_user INTEGER REFERENCES users(id),
      to_user INTEGER REFERENCES users(id),
      amount DECIMAL(10,2) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Tables ready.');
}

async function seed() {
  const client = await pool.connect();
  try {
    await createTables(client);
    await client.query('BEGIN');

    // Clear existing demo data
    await client.query(`DELETE FROM audit_log WHERE group_id IN (SELECT id FROM groups WHERE invite_code = 'DEMO01')`);
    await client.query(`DELETE FROM settlements WHERE group_id IN (SELECT id FROM groups WHERE invite_code = 'DEMO01')`);
    await client.query(`DELETE FROM expense_splits WHERE expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT id FROM groups WHERE invite_code = 'DEMO01'))`);
    await client.query(`DELETE FROM expenses WHERE group_id IN (SELECT id FROM groups WHERE invite_code = 'DEMO01')`);
    await client.query(`DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE invite_code = 'DEMO01')`);
    await client.query(`DELETE FROM groups WHERE invite_code = 'DEMO01'`);
    await client.query(`DELETE FROM users WHERE email IN ('alice@demo.com','bob@demo.com','carol@demo.com','dave@demo.com')`);

    const hash = await bcrypt.hash('password123', 10);

    const alice = (await client.query(`INSERT INTO users (name, email, password_hash) VALUES ('Alice', 'alice@demo.com', $1) RETURNING id`, [hash])).rows[0];
    const bob   = (await client.query(`INSERT INTO users (name, email, password_hash) VALUES ('Bob', 'bob@demo.com', $1) RETURNING id`, [hash])).rows[0];
    const carol = (await client.query(`INSERT INTO users (name, email, password_hash) VALUES ('Carol', 'carol@demo.com', $1) RETURNING id`, [hash])).rows[0];
    const dave  = (await client.query(`INSERT INTO users (name, email, password_hash) VALUES ('Dave', 'dave@demo.com', $1) RETURNING id`, [hash])).rows[0];

    const group = (await client.query(`INSERT INTO groups (name, invite_code, created_by) VALUES ('The Flat', 'DEMO01', $1) RETURNING id`, [alice.id])).rows[0];

    for (const u of [alice, bob, carol, dave]) {
      await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group.id, u.id]);
    }

    // Expense 1: Alice paid rent $2400, equal 4-way split
    const e1 = (await client.query(`INSERT INTO expenses (group_id, description, amount, paid_by, created_by, category) VALUES ($1, 'Monthly Rent', 2400, $2, $2, 'rent') RETURNING id`, [group.id, alice.id])).rows[0];
    for (const u of [alice, bob, carol, dave]) {
      await client.query('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)', [e1.id, u.id, 600]);
    }

    // Expense 2: Bob paid groceries $240, unequal split 40/30/20/10%
    const e2 = (await client.query(`INSERT INTO expenses (group_id, description, amount, paid_by, created_by, category) VALUES ($1, 'Groceries', 240, $2, $2, 'food') RETURNING id`, [group.id, bob.id])).rows[0];
    for (const [u, amt] of [[alice,96],[bob,72],[carol,48],[dave,24]]) {
      await client.query('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)', [e2.id, u.id, amt]);
    }

    // Expense 3: Carol paid internet $60, equal 4-way split
    const e3 = (await client.query(`INSERT INTO expenses (group_id, description, amount, paid_by, created_by, category) VALUES ($1, 'Internet Bill', 60, $2, $2, 'utilities') RETURNING id`, [group.id, carol.id])).rows[0];
    for (const u of [alice, bob, carol, dave]) {
      await client.query('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)', [e3.id, u.id, 15]);
    }

    // Expense 4: Dave paid electricity $120, 3-way split (Alice, Bob, Dave)
    const e4 = (await client.query(`INSERT INTO expenses (group_id, description, amount, paid_by, created_by, category) VALUES ($1, 'Electricity', 120, $2, $2, 'utilities') RETURNING id`, [group.id, dave.id])).rows[0];
    for (const u of [alice, bob, dave]) {
      await client.query('INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)', [e4.id, u.id, 40]);
    }

    // Settlement: Bob paid Alice $100
    await client.query(`INSERT INTO settlements (group_id, from_user, to_user, amount, note) VALUES ($1, $2, $3, 100, 'Partial rent payment')`, [group.id, bob.id, alice.id]);

    // Audit log
    for (const [uid, action, details] of [
      [alice.id, 'group_created', { name: 'The Flat' }],
      [alice.id, 'expense_added', { description: 'Monthly Rent', amount: 2400 }],
      [bob.id,   'expense_added', { description: 'Groceries', amount: 240 }],
      [carol.id, 'expense_added', { description: 'Internet Bill', amount: 60 }],
      [dave.id,  'expense_added', { description: 'Electricity', amount: 120 }],
      [bob.id,   'settled_up',    { from: 'Bob', to: 'Alice', amount: 100 }],
    ]) {
      await client.query(`INSERT INTO audit_log (group_id, user_id, action, details) VALUES ($1, $2, $3, $4)`, [group.id, uid, action, JSON.stringify(details)]);
    }

    await client.query('COMMIT');
    console.log('\nSeed completed!');
    console.log('Demo group: "The Flat" (invite code: DEMO01)');
    console.log('Demo users (all password: password123):');
    console.log('  alice@demo.com');
    console.log('  bob@demo.com');
    console.log('  carol@demo.com');
    console.log('  dave@demo.com');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
