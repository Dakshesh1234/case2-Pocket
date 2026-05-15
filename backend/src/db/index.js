const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
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

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      details JSONB,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Database initialized');
}

async function createNotification(client_or_pool, { userId, groupId, type, message, details }) {
  const q = client_or_pool.query ? client_or_pool : pool;
  await q.query(
    `INSERT INTO notifications (user_id, group_id, type, message, details) VALUES ($1, $2, $3, $4, $5)`,
    [userId, groupId, type, message, JSON.stringify(details || {})]
  );
}

async function notifyGroupMembers(client, { groupId, excludeUserId, type, message, details }) {
  const members = await client.query(
    'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2',
    [groupId, excludeUserId]
  );
  for (const m of members.rows) {
    await createNotification(client, { userId: m.user_id, groupId, type, message, details });
  }
}

module.exports = { pool, initDb, createNotification, notifyGroupMembers };
