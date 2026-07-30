const controller = require('../../src/controllers/product.controller');
const model = require('../../src/models/product.model');

jest.mock('../../src/models/product.model');
jest.mock('../../src/utils/purchaseState', () => ({
  isProductSold: jest.fn().mockReturnValue(false),
}));

const { isProductSold } = require('../../src/utils/purchaseState');

afterEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

function makeRes(locals = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: { ...locals },
  };
}

function mockFn(fn, err, rows) {
  fn.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows: rows ?? [] });
  });
}

const fakeProduct = {
  id: 1,
  name: 'Test Watch',
  category: 'Watches',
  description: 'A fine watch',
  price: 199.99,
  rating: 4.5,
  reviewCount: 10,
  icon: null,
  imageUrl: null,
  isSold: false,
};

// ── readProducts ──────────────────────────────────────────────────────────────

describe('readProducts - selectAll path', () => {
  it('returns 500 on DB error', () => {
    const req = { query: {} };
    const res = makeRes();
    mockFn(model.selectAll, new Error('DB error'));
    controller.readProducts(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('sets res.locals.statusCode to 200 and calls next on success', () => {
    const req = { query: {} };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectAll, null, [fakeProduct]);
    controller.readProducts(req, res, next);
    expect(res.locals.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('sets res.locals.results to the mapped rows', () => {
    const req = { query: {} };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectAll, null, [fakeProduct]);
    controller.readProducts(req, res, next);
    expect(Array.isArray(res.locals.results)).toBe(true);
    expect(res.locals.results).toHaveLength(1);
  });

  it('calls model.selectAll when no query params', () => {
    const req = { query: {} };
    const res = makeRes();
    mockFn(model.selectAll, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.selectAll).toHaveBeenCalled();
    expect(model.searchByName).not.toHaveBeenCalled();
    expect(model.selectByCategory).not.toHaveBeenCalled();
  });

  it('applies isProductSold via applyRuntimeSoldState to each row', () => {
    isProductSold.mockReturnValue(true);
    const req = { query: {} };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectAll, null, [fakeProduct]);
    controller.readProducts(req, res, next);
    expect(res.locals.results[0].isSold).toBe(true);
  });
});

describe('readProducts - searchByName path', () => {
  it('calls model.searchByName when req.query.search is set', () => {
    const req = { query: { search: 'rolex' } };
    const res = makeRes();
    mockFn(model.searchByName, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.searchByName).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'rolex' }),
      expect.any(Function),
    );
    expect(model.selectAll).not.toHaveBeenCalled();
  });

  it('returns 500 on DB error from searchByName', () => {
    const req = { query: { search: 'rolex' } };
    const res = makeRes();
    mockFn(model.searchByName, new Error('DB error'));
    controller.readProducts(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets statusCode 200 and calls next on success', () => {
    const req = { query: { search: 'watch' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.searchByName, null, [fakeProduct]);
    controller.readProducts(req, res, next);
    expect(res.locals.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });
});

describe('readProducts - selectByCategory path', () => {
  it('calls model.selectByCategory when req.query.category is set', () => {
    const req = { query: { category: 'Watches' } };
    const res = makeRes();
    mockFn(model.selectByCategory, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.selectByCategory).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Watches' }),
      expect.any(Function),
    );
  });

  it('passes excludeId from req.query.exclude (defaults to 0)', () => {
    const req = { query: { category: 'Watches' } };
    const res = makeRes();
    mockFn(model.selectByCategory, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.selectByCategory).toHaveBeenCalledWith(
      expect.objectContaining({ excludeId: 0 }),
      expect.any(Function),
    );
  });

  it('passes excludeId when req.query.exclude is provided', () => {
    const req = { query: { category: 'Watches', exclude: '5' } };
    const res = makeRes();
    mockFn(model.selectByCategory, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.selectByCategory).toHaveBeenCalledWith(
      expect.objectContaining({ excludeId: '5' }),
      expect.any(Function),
    );
  });

  it('returns 500 on DB error from selectByCategory', () => {
    const req = { query: { category: 'Watches' } };
    const res = makeRes();
    mockFn(model.selectByCategory, new Error('DB error'));
    controller.readProducts(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('search takes priority over category when both are set', () => {
    const req = { query: { search: 'rolex', category: 'Watches' } };
    const res = makeRes();
    mockFn(model.searchByName, null, []);
    controller.readProducts(req, res, jest.fn());
    expect(model.searchByName).toHaveBeenCalled();
    expect(model.selectByCategory).not.toHaveBeenCalled();
  });
});

// ── readProductById ───────────────────────────────────────────────────────────

describe('readProductById', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { id: '1' } };
    const res = makeRes();
    mockFn(model.selectById, new Error('DB error'));
    controller.readProductById(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 404 when product not found', () => {
    const req = { params: { id: '999' } };
    const res = makeRes();
    mockFn(model.selectById, null, []);
    controller.readProductById(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('sets statusCode 200 and calls next on success', () => {
    const req = { params: { id: '1' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectById, null, [fakeProduct]);
    controller.readProductById(req, res, next);
    expect(res.locals.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('sets res.locals.results to the single product with isSold applied', () => {
    isProductSold.mockReturnValue(false);
    const req = { params: { id: '1' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectById, null, [fakeProduct]);
    controller.readProductById(req, res, next);
    expect(res.locals.results).toMatchObject({ id: 1, isSold: false });
  });

  it('applies isProductSold runtime override', () => {
    isProductSold.mockReturnValue(true);
    const req = { params: { id: '1' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.selectById, null, [fakeProduct]);
    controller.readProductById(req, res, next);
    expect(res.locals.results.isSold).toBe(true);
  });

  it('passes id from req.params to model.selectById', () => {
    const req = { params: { id: '42' } };
    const res = makeRes();
    mockFn(model.selectById, null, [fakeProduct]);
    controller.readProductById(req, res, jest.fn());
    expect(model.selectById).toHaveBeenCalledWith(
      expect.objectContaining({ id: '42' }),
      expect.any(Function),
    );
  });
});

// ── sendResponse ──────────────────────────────────────────────────────────────

describe('sendResponse', () => {
  it('sends the statusCode and results from res.locals', () => {
    const res = makeRes({ statusCode: 200, results: [fakeProduct] });
    controller.sendResponse({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([fakeProduct]);
  });

  it('works with a 404 statusCode', () => {
    const res = makeRes({ statusCode: 404, results: { message: 'Not found' } });
    controller.sendResponse({}, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the exact results object set in res.locals', () => {
    const results = { id: 1, name: 'Product' };
    const res = makeRes({ statusCode: 200, results });
    controller.sendResponse({}, res);
    expect(res.json).toHaveBeenCalledWith(results);
  });
});
