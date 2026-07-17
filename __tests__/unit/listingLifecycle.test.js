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
