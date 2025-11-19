process.env.DATABASE_PATH = ':memory:';

const request = require('supertest');
const app = require('../server');

describe('TinyLink API', () => {
  let server;
  beforeAll((done) => {
    server = app.listen(0, done);
  });
  afterAll((done) => {
    server.close(done);
  });

  test('GET /healthz returns ok', async () => {
    const res = await request(server).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  test('Create link and handle duplicate code, redirect increments clicks, delete stops redirect', async () => {
    const code = 'Abc123';
    const url = 'https://example.com/test';

    // create with custom code
    const createRes = await request(server).post('/api/links').send({ url, code });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('code', code);
    expect(createRes.body).toHaveProperty('clicks', 0);

    // duplicate should return 409
    const dup = await request(server).post('/api/links').send({ url, code });
    expect(dup.status).toBe(409);

    // stats show clicks 0
    const stats1 = await request(server).get('/api/links/' + code);
    expect(stats1.status).toBe(200);
    expect(stats1.body.clicks).toBe(0);

    // redirect should 302 and increment click
    const redirect = await request(server).get('/' + code).redirects(0);
    expect(redirect.status).toBe(302);
    expect(redirect.headers).toHaveProperty('location', url);

    // stats now should have clicks 1
    const stats2 = await request(server).get('/api/links/' + code);
    expect(stats2.status).toBe(200);
    expect(stats2.body.clicks).toBe(1);

    // delete
    const del = await request(server).delete('/api/links/' + code);
    expect(del.status).toBe(204);

    // redirect now should 404
    const redirectAfter = await request(server).get('/' + code);
    expect(redirectAfter.status).toBe(404);
  });
});
