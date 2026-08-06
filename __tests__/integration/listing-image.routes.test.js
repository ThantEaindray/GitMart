process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

// Same reasoning as image.routes.test.js — the actual SCP upload is a real
// network call to an external host, mocked here so this suite proves the
// real route wiring without needing a live SFTP server.
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
const SUITE_USERNAME = 'listing_img_seller';

let seller;
let sellerToken;

function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

async function cleanupSuiteData() {
  await pool.query('DELETE FROM users WHERE username = $1', [SUITE_USERNAME]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockUploadFile.mockResolvedValue(undefined);
  await cleanupSuiteData();

  const result = await pool.query(
    `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id`,
    [SUITE_USERNAME, 'listing.img.seller@example.com', 'not-used-by-these-tests'],
  );
  seller = result.rows[0];
  sellerToken = createAccessToken(seller.id);
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('POST /api/listings/upload-image', () => {
  test('returns 401 without a token', async () => {
    const response = await request(app)
      .post('/api/listings/upload-image')
      .attach('cont', Buffer.from('fake image bytes'), 'cover.png');

    expect(response.status).toBe(401);
  });

  test('uploads the file and returns 201 with the resulting url', async () => {
    const response = await request(app)
      .post('/api/listings/upload-image')
      .set('Authorization', `Bearer ${sellerToken}`)
      .attach('cont', Buffer.from('fake image bytes'), 'cover.png');

    expect(response.status).toBe(201);
    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(response.body.url).toMatch(/^http:\/\//);
  });

  test('returns 500 and no url when the SCP upload fails', async () => {
    mockUploadFile.mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app)
      .post('/api/listings/upload-image')
      .set('Authorization', `Bearer ${sellerToken}`)
      .attach('cont', Buffer.from('fake image bytes'), 'cover.png');

    expect(response.status).toBe(500);
    expect(response.body.url).toBeUndefined();
  });
});
