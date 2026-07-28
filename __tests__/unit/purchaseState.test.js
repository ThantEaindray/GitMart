// purchaseState uses module-level Sets so state persists within a module instance.
// Each describe re-requires the module fresh to guarantee isolation.

// ── isListingSold ─────────────────────────────────────────────────────────────

describe('isListingSold', () => {
  let ps;
  beforeEach(() => {
    jest.resetModules();
    ps = require('../../src/models/purchaseState');
  });

  it('returns false for any id before any marking', () => {
    expect(ps.isListingSold(1)).toBe(false);
  });

  it('returns true after markPurchasedItemsSold with listingId', () => {
    ps.markPurchasedItemsSold([{ listingId: 5 }]);
    expect(ps.isListingSold(5)).toBe(true);
  });

  it('returns false for an id that was not marked', () => {
    ps.markPurchasedItemsSold([{ listingId: 5 }]);
    expect(ps.isListingSold(6)).toBe(false);
  });

  it('coerces a string id to string for comparison when marking', () => {
    ps.markPurchasedItemsSold([{ listingId: '10' }]);
    expect(ps.isListingSold(10)).toBe(true);
  });

  it('coerces a numeric id to string for comparison when checking', () => {
    ps.markPurchasedItemsSold([{ listingId: 11 }]);
    expect(ps.isListingSold('11')).toBe(true);
  });
});

// ── isProductSold ─────────────────────────────────────────────────────────────

describe('isProductSold', () => {
  let ps;
  beforeEach(() => {
    jest.resetModules();
    ps = require('../../src/models/purchaseState');
  });

  it('returns false for any id before any marking', () => {
    expect(ps.isProductSold(1)).toBe(false);
  });

  it('returns true after markPurchasedItemsSold with productId', () => {
    ps.markPurchasedItemsSold([{ productId: 3 }]);
    expect(ps.isProductSold(3)).toBe(true);
  });

  it('returns false for an id that was not marked', () => {
    ps.markPurchasedItemsSold([{ productId: 3 }]);
    expect(ps.isProductSold(4)).toBe(false);
  });

  it('coerces a string id to string for comparison when marking', () => {
    ps.markPurchasedItemsSold([{ productId: '20' }]);
    expect(ps.isProductSold(20)).toBe(true);
  });

  it('coerces a numeric id to string for comparison when checking', () => {
    ps.markPurchasedItemsSold([{ productId: 21 }]);
    expect(ps.isProductSold('21')).toBe(true);
  });
});

// ── markPurchasedItemsSold ────────────────────────────────────────────────────

describe('markPurchasedItemsSold', () => {
  let ps;
  beforeEach(() => {
    jest.resetModules();
    ps = require('../../src/models/purchaseState');
  });

  it('does nothing when passed an empty array', () => {
    ps.markPurchasedItemsSold([]);
    expect(ps.isListingSold(1)).toBe(false);
    expect(ps.isProductSold(1)).toBe(false);
  });

  it('marks a listing using the listingId field', () => {
    ps.markPurchasedItemsSold([{ listingId: 7 }]);
    expect(ps.isListingSold(7)).toBe(true);
  });

  it('does not mark listing id as a product', () => {
    ps.markPurchasedItemsSold([{ listingId: 7 }]);
    expect(ps.isProductSold(7)).toBe(false);
  });

  it('marks a product using the productId field', () => {
    ps.markPurchasedItemsSold([{ productId: 8 }]);
    expect(ps.isProductSold(8)).toBe(true);
  });

  it('does not mark product id as a listing', () => {
    ps.markPurchasedItemsSold([{ productId: 8 }]);
    expect(ps.isListingSold(8)).toBe(false);
  });

  it('marks a listing using id when isOneOff is true', () => {
    ps.markPurchasedItemsSold([{ isOneOff: true, id: 9 }]);
    expect(ps.isListingSold(9)).toBe(true);
  });

  it('does not mark product when isOneOff is true', () => {
    ps.markPurchasedItemsSold([{ isOneOff: true, id: 9 }]);
    expect(ps.isProductSold(9)).toBe(false);
  });

  it('marks a product using id when isOneOff is false', () => {
    ps.markPurchasedItemsSold([{ isOneOff: false, id: 12 }]);
    expect(ps.isProductSold(12)).toBe(true);
  });

  it('does not mark listing when isOneOff is false', () => {
    ps.markPurchasedItemsSold([{ isOneOff: false, id: 12 }]);
    expect(ps.isListingSold(12)).toBe(false);
  });

  it('treats item with listingId as one-off even without explicit isOneOff flag', () => {
    ps.markPurchasedItemsSold([{ listingId: 40 }]);
    expect(ps.isListingSold(40)).toBe(true);
    expect(ps.isProductSold(40)).toBe(false);
  });

  it('marks both listing and product when both fields are present', () => {
    ps.markPurchasedItemsSold([{ listingId: 50, productId: 51 }]);
    expect(ps.isListingSold(50)).toBe(true);
    expect(ps.isProductSold(51)).toBe(true);
  });

  it('marks all items when multiple items are passed', () => {
    ps.markPurchasedItemsSold([{ listingId: 100 }, { productId: 101 }, { listingId: 102 }]);
    expect(ps.isListingSold(100)).toBe(true);
    expect(ps.isProductSold(101)).toBe(true);
    expect(ps.isListingSold(102)).toBe(true);
  });

  it('accumulates marks across multiple calls', () => {
    ps.markPurchasedItemsSold([{ listingId: 200 }]);
    ps.markPurchasedItemsSold([{ listingId: 201 }]);
    expect(ps.isListingSold(200)).toBe(true);
    expect(ps.isListingSold(201)).toBe(true);
  });

  it('item with id only (no isOneOff, no listingId) marks it as product', () => {
    ps.markPurchasedItemsSold([{ id: 300 }]);
    expect(ps.isProductSold(300)).toBe(true);
    expect(ps.isListingSold(300)).toBe(false);
  });

  it('item with no recognisable fields marks nothing', () => {
    ps.markPurchasedItemsSold([{}]);
    expect(ps.isListingSold(undefined)).toBe(false);
    expect(ps.isProductSold(undefined)).toBe(false);
  });

  it('marking the same id twice is idempotent', () => {
    ps.markPurchasedItemsSold([{ listingId: 400 }]);
    ps.markPurchasedItemsSold([{ listingId: 400 }]);
    expect(ps.isListingSold(400)).toBe(true);
  });

  it('listing and product sets remain independent for the same numeric id', () => {
    ps.markPurchasedItemsSold([{ listingId: 500 }]);
    expect(ps.isListingSold(500)).toBe(true);
    expect(ps.isProductSold(500)).toBe(false);
    ps.markPurchasedItemsSold([{ productId: 500 }]);
    expect(ps.isProductSold(500)).toBe(true);
  });

  it('handles large numeric ids', () => {
    ps.markPurchasedItemsSold([{ listingId: 9999999 }]);
    expect(ps.isListingSold(9999999)).toBe(true);
    expect(ps.isListingSold(9999998)).toBe(false);
  });

  it('handles default parameter when called with no argument', () => {
    expect(() => ps.markPurchasedItemsSold()).not.toThrow();
    expect(ps.isListingSold(1)).toBe(false);
  });
});
