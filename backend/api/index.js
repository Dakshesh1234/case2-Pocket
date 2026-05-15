const app = require('../src/index');
const { initDb } = require('../src/db');

let dbInitialized = false;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
  return app(req, res);
};
