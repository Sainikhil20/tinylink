const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const db = require('./db');

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ensure DB schema exists (SQLite or Postgres)
db.ensureSchema().catch((err)=>{
  console.error('Failed to ensure DB schema:', err);
  process.exit(1);
});

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use('/static', express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/healthz', (req, res) => {
  res.json({ ok: true, version: '1.0' });
});

// API: list all links
app.get('/api/links', async (req, res) => {
  const rows = await db.getAllLinks();
  res.json(rows);
});

// API: get one link stats
app.get('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  const row = await db.getLink(code);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Helper: validate URL
function isValidUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Helper: validate code
function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

// Helper: generate random code
function genCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Create link
app.post('/api/links', async (req, res) => {
  const { url, code } = req.body || {};
  if (!url || typeof url !== 'string' || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let useCode = code && String(code).trim() !== '' ? String(code).trim() : null;
  if (useCode) {
    if (!isValidCode(useCode)) return res.status(400).json({ error: 'Code must match [A-Za-z0-9]{6,8}' });
    const existing = await db.exists(useCode);
    if (existing) return res.status(409).json({ error: 'Code already exists' });
  } else {
    // generate unique code
    let tries = 0;
    do {
      useCode = genCode(6);
      const existing = await db.exists(useCode);
      if (!existing) break;
      tries++;
    } while (tries < 5);
    if (!useCode) useCode = genCode(7);
  }

  try {
    const created = await db.insertLink(useCode, url);
    res.status(201).json(created);
  } catch (e) {
    return res.status(409).json({ error: 'Code already exists' });
  }
});

// Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;
  const info = await db.exists(code);
  if (!info) return res.status(404).json({ error: 'Not found' });
  await db.deleteLink(code);
  res.status(204).send();
});

// Serve dashboard and stats pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/code/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'code.html'));
});

// Redirect route (must be last, after other routes)
app.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (code === 'api' || code === 'healthz' || code === 'static' || code === 'code') return res.status(404).send('Not found');
  const row = await db.getLink(code);
  if (!row) return res.status(404).send('Not found');

  await db.incrementClicks(code);
  res.redirect(302, row.url);
});
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TinyLink running on ${BASE_URL}`);
  });
}

module.exports = app;
