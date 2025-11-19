// db.js - thin adapter supporting SQLite (default) and Postgres (via DATABASE_URL)
const path = require('path');
const Database = require('better-sqlite3');

const DATABASE_URL = process.env.DATABASE_URL;

let usingPg = false;
let pgPool = null;
let sqliteDb = null;

if (DATABASE_URL) {
  // Use Postgres
  usingPg = true;
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: DATABASE_URL });
} else {
  // Use SQLite file or provided path
  const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data.sqlite');
  sqliteDb = new Database(DB_PATH);
}

async function ensureSchema() {
  if (usingPg) {
    const sql = `
    CREATE TABLE IF NOT EXISTS links (
      code TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      last_clicked TIMESTAMP
    );
    `;
    try {
      await pgPool.query(sql);
      return;
    } catch (err) {
      // If Postgres is unreachable or misconfigured, fall back to SQLite
      console.error('Failed to ensure Postgres schema, falling back to SQLite. Error:', err && err.message);
      usingPg = false;
      // initialize sqlite DB if not already
      if (!sqliteDb) {
        const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data.sqlite');
        sqliteDb = new Database(DB_PATH);
      }
      // continue to ensure sqlite schema below
    }
  }

  // SQLite path (either because DATABASE_URL was not set or we fell back)
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS links (
      code TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_clicked DATETIME
    );
    `);
}

async function getAllLinks() {
  if (usingPg) {
    const res = await pgPool.query('SELECT code, url, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC');
    return res.rows;
  }
  return sqliteDb.prepare('SELECT code, url, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC').all();
}

async function getLink(code) {
  if (usingPg) {
    const res = await pgPool.query('SELECT code, url, clicks, last_clicked, created_at FROM links WHERE code = $1', [code]);
    return res.rows[0];
  }
  return sqliteDb.prepare('SELECT code, url, clicks, last_clicked, created_at FROM links WHERE code = ?').get(code);
}

async function exists(code) {
  if (usingPg) {
    const res = await pgPool.query('SELECT 1 FROM links WHERE code = $1 LIMIT 1', [code]);
    return res.rowCount > 0;
  }
  const r = sqliteDb.prepare('SELECT 1 FROM links WHERE code = ?').get(code);
  return !!r;
}

async function insertLink(code, url) {
  if (usingPg) {
    await pgPool.query('INSERT INTO links(code, url, clicks) VALUES($1, $2, 0)', [code, url]);
    return getLink(code);
  }
  const stmt = sqliteDb.prepare('INSERT INTO links (code, url, clicks) VALUES (?, ?, 0)');
  stmt.run(code, url);
  return sqliteDb.prepare('SELECT code, url, clicks, last_clicked, created_at FROM links WHERE code = ?').get(code);
}

async function deleteLink(code) {
  if (usingPg) {
    await pgPool.query('DELETE FROM links WHERE code = $1', [code]);
    return;
  }
  sqliteDb.prepare('DELETE FROM links WHERE code = ?').run(code);
}

async function incrementClicks(code) {
  if (usingPg) {
    await pgPool.query('UPDATE links SET clicks = clicks + 1, last_clicked = now() WHERE code = $1', [code]);
    return;
  }
  sqliteDb.prepare('UPDATE links SET clicks = clicks + 1, last_clicked = CURRENT_TIMESTAMP WHERE code = ?').run(code);
}

module.exports = {
  ensureSchema,
  getAllLinks,
  getLink,
  exists,
  insertLink,
  deleteLink,
  incrementClicks,
  usingPg
};
