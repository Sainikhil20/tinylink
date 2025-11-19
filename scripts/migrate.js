// Run DB schema creation/migrations
const db = require('../db');

(async () => {
  try {
    await db.ensureSchema();
    console.log('Schema ensured');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(2);
  }
})();
