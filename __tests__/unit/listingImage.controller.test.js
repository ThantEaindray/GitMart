const fs = require('fs');
const imageController = require('../../src/controllers/image.controller.js');
const controller = require('../../src/controllers/listingImage.controller.js');

let consoleErrorSpy;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SCP_IP = '203.0.113.10';
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
  jest.restoreAllMocks();
});

function createResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('listingImage.controller - uploadCoverImage', () => {
  test('is the same function chat images use for the SCP upload, not a copy', () => {
    // Reused directly rather than duplicated — this pins that intent, so a
    // future refactor that accidentally forks the two doesn't go unnoticed.
    expect(controller.uploadCoverImage).toBe(imageController.uploadImg);
  });
});

describe('listingImage.controller - respondWithUrl', () => {
  test('builds the SCP image URL, deletes the temp file, and responds 201 with the url', () => {
    jest.spyOn(fs, 'unlink').mockImplementation((path, cb) => cb(null));

    const req = { file: { filename: 'cont-123.png' } };
    const res = createResponse();

    controller.respondWithUrl(req, res);

    expect(fs.unlink).toHaveBeenCalledWith('./src/tmp/cont-123.png', expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ url: 'http://203.0.113.10/cont-123.png' });
  });

  test('still responds 201 with the url even if deleting the temp file fails', () => {
    const unlinkError = new Error('ENOENT');
    jest.spyOn(fs, 'unlink').mockImplementation((path, cb) => cb(unlinkError));

    const req = { file: { filename: 'cont-456.png' } };
    const res = createResponse();

    controller.respondWithUrl(req, res);

    expect(consoleErrorSpy).toHaveBeenCalledWith(unlinkError);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ url: 'http://203.0.113.10/cont-456.png' });
  });
});
