require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();

// Initialize DB
let dbInitialized = false;
let dbPromise = null;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    if (!dbPromise) {
      dbPromise = initDb();
    }
    await dbPromise;
    dbInitialized = true;
  }
}

app.use(cors());
app.use(express.json());

// Middleware to ensure DB is initialized
app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api', require('./routes/expenses'));
app.use('/api', require('./routes/settlements'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// For Vercel serverless
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
}
