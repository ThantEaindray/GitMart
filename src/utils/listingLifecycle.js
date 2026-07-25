const LISTING_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  ARCHIVED: 'ARCHIVED',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [LISTING_STATUSES.AVAILABLE]: Object.freeze([
    LISTING_STATUSES.RESERVED,
    LISTING_STATUSES.SOLD,
    LISTING_STATUSES.ARCHIVED,
  ]),

  [LISTING_STATUSES.RESERVED]: Object.freeze([
    LISTING_STATUSES.AVAILABLE,
    LISTING_STATUSES.SOLD,
    LISTING_STATUSES.ARCHIVED,
  ]),

  [LISTING_STATUSES.SOLD]: Object.freeze([]),

  [LISTING_STATUSES.ARCHIVED]: Object.freeze([LISTING_STATUSES.AVAILABLE]),
});

function normalizeListingStatus(status) {
  if (typeof status !== 'string') {
    return '';
  }

  return status.trim().toUpperCase();
}

function isValidListingStatus(status) {
  const normalizedStatus = normalizeListingStatus(status);

  return Object.values(LISTING_STATUSES).includes(normalizedStatus);
}

function canTransitionListingStatus(currentStatus, nextStatus) {
  const normalizedCurrentStatus = normalizeListingStatus(currentStatus);

  const normalizedNextStatus = normalizeListingStatus(nextStatus);

  if (
    !isValidListingStatus(normalizedCurrentStatus) ||
    !isValidListingStatus(normalizedNextStatus) ||
    normalizedCurrentStatus === normalizedNextStatus
  ) {
    return false;
  }

  return ALLOWED_TRANSITIONS[normalizedCurrentStatus].includes(normalizedNextStatus);
}

function getLegacyListingFlags(status) {
  const normalizedStatus = normalizeListingStatus(status);

  if (!isValidListingStatus(normalizedStatus)) {
    throw new Error('Invalid listing status.');
  }

  return {
    isSold: normalizedStatus === LISTING_STATUSES.SOLD,

    isClosed: normalizedStatus === LISTING_STATUSES.ARCHIVED,
  };
}

module.exports = {
  LISTING_STATUSES,
  normalizeListingStatus,
  isValidListingStatus,
  canTransitionListingStatus,
  getLegacyListingFlags,
};
