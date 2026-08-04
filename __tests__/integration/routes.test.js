const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  // Clean slate for every test
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helper ───────────────────────────────────────────────
async function seedPersons() {
  await pool.query(
    `INSERT INTO "Person" ("email","name") VALUES
      ('alice@example.com','Alice'),
      ('bob@example.com','Bob')`,
  );
}

async function seedSomethings() {
  await pool.query(`INSERT INTO "Something" ("name") VALUES ('Seed 1'),('Seed 2')`);
}

// ─────────────────────────────────────────────────────────
// GET /persons
// ─────────────────────────────────────────────────────────
describe('GET /persons', () => {
  // Boundary: zero rows – empty table returns empty array
  test('should return 200 and an empty array when no persons exist', async () => {
    const res = await request(app).get('/persons');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: seeded data returns all rows with expected fields
  test('should return 200 and all persons', async () => {
    await seedPersons();

    const res = await request(app).get('/persons');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('email');
    expect(res.body[0]).toHaveProperty('name');
  });
});

// ─────────────────────────────────────────────────────────
// GET /somethings
// ─────────────────────────────────────────────────────────
describe('GET /somethings', () => {
  // Boundary: zero rows – empty table returns empty array
  test('should return 200 and an empty array when none exist', async () => {
    const res = await request(app).get('/somethings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: seeded data returns all rows with expected fields
  test('should return 200 and all somethings', async () => {
    await seedSomethings();

    const res = await request(app).get('/somethings');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });
});

// ─────────────────────────────────────────────────────────
// POST /somethings
// ─────────────────────────────────────────────────────────
describe('POST /somethings', () => {
  // Valid partition: valid name creates and returns the new record
  test('should return 201 and the created something', async () => {
    const res = await request(app).post('/somethings').send({ name: 'cheese' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('cheese');
  });

  // Valid partition: verify data persists in DB after creation
  test('created something should be persisted in the database', async () => {
    await request(app).post('/somethings').send({ name: 'milk' });

    const res = await request(app).get('/somethings');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('milk');
  });
});

// ─────────────────────────────────────────────────────────
// PUT /somethings/:id
// ─────────────────────────────────────────────────────────
describe('PUT /somethings/:id', () => {
  // Valid partition: update an existing record with a valid name
  test('should return 200 and the updated something', async () => {
    // Create one first
    const createRes = await request(app).post('/somethings').send({ name: 'original' });
    const id = createRes.body.id;

    const res = await request(app).put(`/somethings/${id}`).send({ name: 'updated' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('updated');
  });

  // Valid partition: verify updated value persists when retrieved
  test('updated value should persist when retrieved', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'before' });
    const id = createRes.body.id;

    await request(app).put(`/somethings/${id}`).send({ name: 'after' });

    const getRes = await request(app).get('/somethings');
    const item = getRes.body.find((s) => s.id === id);

    expect(item.name).toBe('after');
  });

  // Boundary: non-existent id – large id that doesn't match any row
  test('should return 404 for non-existing id (boundary)', async () => {
    const res = await request(app).put('/somethings/999999').send({ name: 'ghost' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /somethings/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /somethings/:id', () => {
  // Valid partition: delete an existing record and return it
  test('should return 200 and the deleted something', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'doomed' });
    const id = createRes.body.id;

    const res = await request(app).delete(`/somethings/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('doomed');
  });

  // Valid partition: verify deleted item is no longer retrievable
  test('deleted item should no longer appear in GET', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'temporary' });
    const id = createRes.body.id;

    await request(app).delete(`/somethings/${id}`);

    const getRes = await request(app).get('/somethings');
    const ids = getRes.body.map((s) => s.id);

    expect(ids).not.toContain(id);
  });

  // Valid partition: other records remain unaffected after deleting one
  test('other items should remain after deleting one', async () => {
    await request(app).post('/somethings').send({ name: 'keep' });
    const deleteRes = await request(app).post('/somethings').send({ name: 'remove' });
    const removeId = deleteRes.body.id;

    await request(app).delete(`/somethings/${removeId}`);

    const getRes = await request(app).get('/somethings');

    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].name).toBe('keep');
  });

  // Boundary: non-existent id – large id that doesn't match any row
  test('should return 404 for non-existing id (boundary)', async () => {
    const res = await request(app).delete('/somethings/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });
});

// ─────────────────────────────────────────────────────────
// 404 handling
// ─────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  // Invalid partition: GET to a non-existent route
  test('GET /unknown should return 404', async () => {
    const res = await request(app).get('/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Unknown resource/);
  });

  // Invalid partition: POST to a non-existent route
  test('POST /unknown should return 404', async () => {
    const res = await request(app).post('/unknown').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Unknown resource/);
  });
});

// ── GET /api/health ───────────────────────────────────────────────────────
// The deploy pipeline rolls back when this fails, so it needs to be right.
describe('GET /api/health', () => {
  test('reports ok when the database is reachable', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'reachable' });
  });

  test('is public, so the deploy check needs no credentials', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
