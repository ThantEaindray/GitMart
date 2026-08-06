process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

// The actual SCP upload is a real network call to an external host — mocked
// here the same way it is in the unit tests, so this suite proves the real
// route wiring (auth, multer, DB write, response) without needing a live
// SFTP server or real credentials.
const mockUploadFile = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn();
jest.mock('node-scp', () => ({
  Client: jest.fn(() => Promise.resolve({ uploadFile: mockUploadFile, close: mockClose })),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

const SUITE_USERNAMES = ['img_alice', 'img_bob'];

let alice;
let bob;
let aliceToken;
let chat;

function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

async function insertUser(username, email) {
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `,
    [username, email, 'not-used-by-these-tests'],
  );
  return result.rows[0];
}

async function insertChat(userOne, userTwo) {
  const result = await pool.query(
    'INSERT INTO chats (user_1, user_2) VALUES ($1, $2) RETURNING id, user_1, user_2',
    [userOne, userTwo],
  );
  return result.rows[0];
}

// chatcontent and chats reference users without ON DELETE CASCADE, so they must
// be removed in dependency order before the users themselves.
async function cleanupSuiteData() {
  const ids = `SELECT id FROM users WHERE username = ANY($1::text[])`;

  await pool.query(
    `DELETE FROM chatcontent WHERE sender_id IN (${ids}) OR chat_id IN (
       SELECT id FROM chats WHERE user_1 IN (${ids}) OR user_2 IN (${ids})
     )`,
    [SUITE_USERNAMES],
  );
  await pool.query(`DELETE FROM chats WHERE user_1 IN (${ids}) OR user_2 IN (${ids})`, [
    SUITE_USERNAMES,
  ]);
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockUploadFile.mockResolvedValue(undefined);
  await cleanupSuiteData();

  alice = await insertUser(SUITE_USERNAMES[0], 'img.alice@example.com');
  bob = await insertUser(SUITE_USERNAMES[1], 'img.bob@example.com');
  chat = await insertChat(alice.id, bob.id);
  aliceToken = createAccessToken(alice.id);
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('POST /api/images/send', () => {
  test('returns 401 without a token', async () => {
    const response = await request(app)
      .post('/api/images/send')
      .field('chat', chat.id)
      .field('to', bob.id)
      .field('cont_type', 'img')
      .attach('cont', Buffer.from('fake image bytes'), 'photo.png');

    expect(response.status).toBe(401);
  });

  test('uploads the file, stores the message, and returns 201', async () => {
    const response = await request(app)
      .post('/api/images/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('chat', chat.id)
      .field('to', bob.id)
      .field('cont_type', 'img')
      .attach('cont', Buffer.from('fake image bytes'), 'photo.png');

    expect(response.status).toBe(201);
    expect(mockUploadFile).toHaveBeenCalledTimes(1);

    const stored = await pool.query('SELECT * FROM chatcontent WHERE chat_id = $1', [chat.id]);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].sender_id).toBe(alice.id);
    expect(stored.rows[0].cont_type).toBe('img');
    expect(stored.rows[0].cont).toMatch(/^http:\/\//);
  });

  test('returns 500 and does not store a row when the SCP upload fails', async () => {
    mockUploadFile.mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app)
      .post('/api/images/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('chat', chat.id)
      .field('to', bob.id)
      .field('cont_type', 'img')
      .attach('cont', Buffer.from('fake image bytes'), 'photo.png');

    expect(response.status).toBe(500);

    const stored = await pool.query('SELECT * FROM chatcontent WHERE chat_id = $1', [chat.id]);
    expect(stored.rows).toHaveLength(0);
  });

  test('returns 500 when the chat does not exist', async () => {
    const response = await request(app)
      .post('/api/images/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .field('chat', 999999)
      .field('to', bob.id)
      .field('cont_type', 'img')
      .attach('cont', Buffer.from('fake image bytes'), 'photo.png');

    expect(response.status).toBe(500);
  });
});
