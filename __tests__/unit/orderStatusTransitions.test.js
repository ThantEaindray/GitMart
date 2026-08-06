const {
  _test: { ORDER_STATUSES, canTransitionOrderStatus, isAllowedOrderStatus },
} = require('../../src/controllers/order.controller');

describe('order status transition rules', () => {
  test('allows Pending orders to move to Processing or Cancelled', () => {
    expect(canTransitionOrderStatus(ORDER_STATUSES.PENDING, ORDER_STATUSES.PROCESSING)).toBe(true);
    expect(canTransitionOrderStatus(ORDER_STATUSES.PENDING, ORDER_STATUSES.CANCELLED)).toBe(true);
  });

  test('allows Processing orders to move to Delivered or Cancelled', () => {
    expect(canTransitionOrderStatus(ORDER_STATUSES.PROCESSING, ORDER_STATUSES.DELIVERED)).toBe(
      true,
    );
    expect(canTransitionOrderStatus(ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED)).toBe(
      true,
    );
  });

  test('keeps Delivered and Cancelled orders as final statuses', () => {
    expect(canTransitionOrderStatus(ORDER_STATUSES.DELIVERED, ORDER_STATUSES.PENDING)).toBe(false);
    expect(canTransitionOrderStatus(ORDER_STATUSES.DELIVERED, ORDER_STATUSES.PROCESSING)).toBe(
      false,
    );
    expect(canTransitionOrderStatus(ORDER_STATUSES.CANCELLED, ORDER_STATUSES.PROCESSING)).toBe(
      false,
    );
    expect(canTransitionOrderStatus(ORDER_STATUSES.CANCELLED, ORDER_STATUSES.DELIVERED)).toBe(
      false,
    );
  });

  test('allows submitting the same status without creating an invalid transition', () => {
    expect(canTransitionOrderStatus(ORDER_STATUSES.PENDING, ORDER_STATUSES.PENDING)).toBe(true);
    expect(canTransitionOrderStatus(ORDER_STATUSES.DELIVERED, ORDER_STATUSES.DELIVERED)).toBe(true);
  });

  test('rejects unknown statuses before transition handling', () => {
    expect(isAllowedOrderStatus('Refunded')).toBe(false);
    expect(isAllowedOrderStatus(ORDER_STATUSES.PENDING)).toBe(true);
  });
});
