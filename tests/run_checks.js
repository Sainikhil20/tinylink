// Lightweight test runner that doesn't require external deps.
process.env.DATABASE_PATH = ':memory:';

const http = require('http');
const app = require('../server');

function requestOptions(port, method, path, headers) {
  return { method: method || 'GET', port, path, headers: headers || {} };
}

function doRequest(port, method, path, body, expectRedirectNotFollow=true) {
  return new Promise((resolve, reject) => {
    const opts = requestOptions(port, method, path, { 'Content-Type': 'application/json' });
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, headers: res.headers, body: raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  console.log('Test server listening on port', port);

  try {
    // health
    const h = await doRequest(port, 'GET', '/healthz');
    console.log('/healthz', h.status, h.body);
    if (h.status !== 200) throw new Error('/healthz failed');

    const code = 'Abc123';
    const url = 'https://example.com/test';

    // create
    const c = await doRequest(port, 'POST', '/api/links', { url, code });
    console.log('create', c.status, c.body);
    if (c.status !== 201) throw new Error('create failed');

    // duplicate
    const d = await doRequest(port, 'POST', '/api/links', { url, code });
    console.log('duplicate create', d.status, d.body);
    if (d.status !== 409) throw new Error('duplicate check failed');

    // stats before
    const s1 = await doRequest(port, 'GET', `/api/links/${code}`);
    const s1body = JSON.parse(s1.body);
    console.log('stats1', s1.status, s1body);
    if (s1body.clicks !== 0) throw new Error('initial clicks not 0');

    // redirect (we expect 302)
    const r = await doRequest(port, 'GET', `/${code}`);
    console.log('redirect', r.status, r.headers.location || 'no-location');
    if (r.status !== 302) throw new Error('redirect failed');
    if (!r.headers.location || r.headers.location !== url) throw new Error('redirect location wrong');

    // stats after
    const s2 = await doRequest(port, 'GET', `/api/links/${code}`);
    const s2body = JSON.parse(s2.body);
    console.log('stats2', s2.status, s2body);
    if (s2body.clicks !== 1) throw new Error('click not incremented');

    // delete
    const del = await doRequest(port, 'DELETE', `/api/links/${code}`);
    console.log('delete', del.status);
    if (del.status !== 204) throw new Error('delete failed');

    // redirect should now 404
    const ra = await doRequest(port, 'GET', `/${code}`);
    console.log('redirect after delete', ra.status);
    if (ra.status !== 404) throw new Error('redirect after delete not 404');

    console.log('\nALL CHECKS PASSED');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('TEST FAILED:', err && err.message || err);
    server.close(() => process.exit(2));
  }
})();
