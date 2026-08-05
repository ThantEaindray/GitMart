const {
  LISTING_STATUSES,
  normalizeListingStatus,
  isValidListingStatus,
  canTransitionListingStatus,
  getLegacyListingFlags,
} = require('../../src/utils/listingLifecycle');

describe('listingLifecycle', () => {
  describe('normalizeListingStatus', () => {
    test('trims whitespace and converts text to uppercase', () => {
      expect(normalizeListingStatus(' reserved ')).toBe(LISTING_STATUSES.RESERVED);
    });

    test('returns an empty string for a non-string value', () => {
      expect(normalizeListingStatus(null)).toBe('');
    });
  });

  describe('isValidListingStatus', () => {
    test.each([
      LISTING_STATUSES.AVAILABLE,
      LISTING_STATUSES.RESERVED,
      LISTING_STATUSES.SOLD,
      LISTING_STATUSES.ARCHIVED,
    ])('accepts the supported status %s', (status) => {
      expect(isValidListingStatus(status)).toBe(true);
    });

    test('rejects an unsupported status', () => {
      expect(isValidListingStatus('DELETED')).toBe(false);
    });
  });

  describe('canTransitionListingStatus', () => {
    test.each([
      ['AVAILABLE', 'RESERVED'],
      ['AVAILABLE', 'SOLD'],
      ['AVAILABLE', 'ARCHIVED'],
      ['RESERVED', 'AVAILABLE'],
      ['RESERVED', 'SOLD'],
      ['RESERVED', 'ARCHIVED'],
      ['ARCHIVED', 'AVAILABLE'],
    ])('allows %s to transition to %s', (currentStatus, nextStatus) => {
      expect(canTransitionListingStatus(currentStatus, nextStatus)).toBe(true);
    });

    test.each([
      ['AVAILABLE', 'AVAILABLE'],
      ['SOLD', 'AVAILABLE'],
      ['SOLD', 'RESERVED'],
      ['ARCHIVED', 'SOLD'],
      ['UNKNOWN', 'AVAILABLE'],
    ])('rejects %s to %s', (currentStatus, nextStatus) => {
      expect(canTransitionListingStatus(currentStatus, nextStatus)).toBe(false);
    });
  });

  describe('getLegacyListingFlags', () => {
    test.each([
      ['AVAILABLE', { isSold: false, isClosed: false }],
      ['RESERVED', { isSold: false, isClosed: false }],
      ['SOLD', { isSold: true, isClosed: false }],
      ['ARCHIVED', { isSold: false, isClosed: true }],
    ])('maps %s to the correct compatibility flags', (status, expectedFlags) => {
      expect(getLegacyListingFlags(status)).toEqual(expectedFlags);
    });

    test('throws an error for an unsupported status', () => {
      expect(() => getLegacyListingFlags('DELETED')).toThrow('Invalid listing status.');
    });
  });
});

// ── normalizeListingStatus extra ──────────────────────────────────────────────

describe('normalizeListingStatus - extra cases', () => {
  test('returns empty string for a number input', () => {
    expect(normalizeListingStatus(123)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(normalizeListingStatus(undefined)).toBe('');
  });

  test('returns empty string for a boolean', () => {
    expect(normalizeListingStatus(true)).toBe('');
  });

  test('returns AVAILABLE for lowercase available', () => {
    expect(normalizeListingStatus('available')).toBe('AVAILABLE');
  });

  test('returns empty string for an empty string input', () => {
    expect(normalizeListingStatus('')).toBe('');
  });

  test('trims both leading and trailing whitespace', () => {
    expect(normalizeListingStatus('  SOLD  ')).toBe('SOLD');
  });
});

// ── isValidListingStatus extra ────────────────────────────────────────────────

describe('isValidListingStatus - extra cases', () => {
  test('returns true for lowercase available (normalises internally)', () => {
    expect(isValidListingStatus('available')).toBe(true);
  });

  test('returns true for mixed-case Reserved', () => {
    expect(isValidListingStatus('Reserved')).toBe(true);
  });

  test('returns false for empty string', () => {
    expect(isValidListingStatus('')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isValidListingStatus(null)).toBe(false);
  });
});

// ── canTransitionListingStatus extra ──────────────────────────────────────────

describe('canTransitionListingStatus - extra forbidden transitions', () => {
  test('rejects SOLD to RESERVED', () => {
    expect(canTransitionListingStatus('SOLD', 'RESERVED')).toBe(false);
  });

  test('rejects SOLD to ARCHIVED', () => {
    expect(canTransitionListingStatus('SOLD', 'ARCHIVED')).toBe(false);
  });

  test('rejects ARCHIVED to RESERVED', () => {
    expect(canTransitionListingStatus('ARCHIVED', 'RESERVED')).toBe(false);
  });

  test('rejects ARCHIVED to SOLD', () => {
    expect(canTransitionListingStatus('ARCHIVED', 'SOLD')).toBe(false);
  });

  test('rejects RESERVED to RESERVED (same status)', () => {
    expect(canTransitionListingStatus('RESERVED', 'RESERVED')).toBe(false);
  });
});

// ── getLegacyListingFlags extra ───────────────────────────────────────────────

describe('getLegacyListingFlags - extra cases', () => {
  test('returns correct flags for lowercase available (normalises input)', () => {
    expect(getLegacyListingFlags('available')).toEqual({ isSold: false, isClosed: false });
  });

  test('returns correct flags for SOLD with surrounding whitespace', () => {
    expect(getLegacyListingFlags(' SOLD ')).toEqual({ isSold: true, isClosed: false });
  });

  test('RESERVED sets neither isSold nor isClosed', () => {
    const flags = getLegacyListingFlags('RESERVED');
    expect(flags.isSold).toBe(false);
    expect(flags.isClosed).toBe(false);
  });

  test('ARCHIVED sets isClosed to true and isSold to false', () => {
    const flags = getLegacyListingFlags('ARCHIVED');
    expect(flags.isClosed).toBe(true);
    expect(flags.isSold).toBe(false);
  });

  test('throws with message "Invalid listing status." for unsupported input', () => {
    expect(() => getLegacyListingFlags('PENDING')).toThrow('Invalid listing status.');
  });

  test('SOLD sets isSold to true and isClosed to false', () => {
    const flags = getLegacyListingFlags('SOLD');
    expect(flags.isSold).toBe(true);
    expect(flags.isClosed).toBe(false);
  });
});
