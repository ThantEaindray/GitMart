jest.mock('../../src/models/image.model.js', () => ({
  writeDB: jest.fn(),
}));

jest.mock('node-scp', () => ({
  Client: jest.fn(),
}));

jest.mock('../../src/server.js', () => ({
  send: jest.fn(),
}));

const fs = require('fs');
const model = require('../../src/models/image.model.js');
const { Client } = require('node-scp');
const server = require('../../src/server.js');
const controller = require('../../src/controllers/image.controller.js');

let consoleLogSpy;
let consoleErrorSpy;

beforeAll(() => {
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SCP_USR = 'scp-user';
  process.env.SCP_PWD = 'scp-pass';
  process.env.SCP_IP = '203.0.113.10';
  process.env.SCP_PORT = '22';
  process.env.SCP_DIR = '/var/www/imgs';
});

afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  jest.restoreAllMocks();
});

function createResponse(userId = 7) {
  const res = {
    locals: { userId },
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

// ── uploadImg ────────────────────────────────────────────────────────────

describe('image.controller - uploadImg', () => {
  test('uploads the temp file to the configured SCP target and calls next on success', async () => {
    const uploadFile = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn();
    Client.mockResolvedValue({ uploadFile, close });

    const req = { file: { filename: 'cont-123.png' } };
    const res = createResponse();
    const next = jest.fn();

    controller.uploadImg(req, res, next);
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);

    expect(Client).toHaveBeenCalledWith({
      username: 'scp-user',
      password: 'scp-pass',
      host: '203.0.113.10',
      port: '22',
    });
    expect(uploadFile).toHaveBeenCalledWith('./src/tmp/cont-123.png', '/var/www/imgs/cont-123.png');
    expect(close).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('responds 500 with the error when the SCP upload itself fails', async () => {
    const uploadError = new Error('connection refused');
    const uploadFile = jest.fn().mockRejectedValue(uploadError);
    Client.mockResolvedValue({ uploadFile, close: jest.fn() });

    const req = { file: { filename: 'cont-123.png' } };
    const res = createResponse();
    const next = jest.fn();

    controller.uploadImg(req, res, next);
    await new Promise(process.nextTick);
    await new Promise(process.nextTick);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(uploadError);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── writeDB ──────────────────────────────────────────────────────────────

describe('image.controller - writeDB', () => {
  test('builds the SCP image URL, stores it via the model, and calls next on success', () => {
    model.writeDB.mockImplementation((data, callback) => callback(null, { rows: [{ id: 1 }] }));

    const req = { file: { filename: 'cont-123.png' }, body: { chat: 4, cont_type: 'img' } };
    const res = createResponse(9);
    const next = jest.fn();

    controller.writeDB(req, res, next);

    expect(res.locals.path).toBe('http://203.0.113.10/cont-123.png');
    expect(model.writeDB).toHaveBeenCalledWith(
      { chat: 4, from: 9, cont_type: 'img', cont: 'http://203.0.113.10/cont-123.png' },
      expect.any(Function),
    );
    expect(next).toHaveBeenCalled();
  });

  test('responds 500 with the error when the write fails', () => {
    const dbError = new Error('insert failed');
    model.writeDB.mockImplementation((data, callback) => callback(dbError));

    const req = { file: { filename: 'cont-123.png' }, body: { chat: 4, cont_type: 'img' } };
    const res = createResponse(9);
    const next = jest.fn();

    controller.writeDB(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(dbError);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── sendWS ───────────────────────────────────────────────────────────────

describe('image.controller - sendWS', () => {
  test('broadcasts the image message using the path set by writeDB and calls next', () => {
    const req = { body: { to: 3, chat: 4 } };
    const res = createResponse(9);
    res.locals.path = 'http://203.0.113.10/cont-123.png';
    const next = jest.fn();

    controller.sendWS(req, res, next);

    expect(server.send).toHaveBeenCalledWith({
      type: 'message',
      from: 9,
      to: 3,
      chat: 4,
      cont_type: 'img',
      cont: 'http://203.0.113.10/cont-123.png',
    });
    expect(next).toHaveBeenCalled();
  });
});

// ── cleanup ──────────────────────────────────────────────────────────────

describe('image.controller - cleanup', () => {
  test('deletes the temp file and responds 201 on success', () => {
    jest.spyOn(fs, 'unlink').mockImplementation((path, cb) => cb(null));

    const req = { file: { filename: 'cont-123.png' } };
    const res = createResponse();

    controller.cleanup(req, res, jest.fn());

    expect(fs.unlink).toHaveBeenCalledWith('./src/tmp/cont-123.png', expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith();
  });

  test('responds 500 with the error when deleting the temp file fails', () => {
    const unlinkError = new Error('ENOENT');
    jest.spyOn(fs, 'unlink').mockImplementation((path, cb) => cb(unlinkError));

    const req = { file: { filename: 'cont-123.png' } };
    const res = createResponse();

    controller.cleanup(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(unlinkError);
  });
});
