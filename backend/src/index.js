require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();

// Initialize DB on startup
let dbPromise = initDb();

app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

// Ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  try {
    await dbPromise;
    next();
  } catch (err) {
    console.error('DB initialization error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api', require('./routes/expenses'));
app.use('/api', require('./routes/settlements'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

module.exports = app;
