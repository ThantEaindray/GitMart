jest.mock('../../src/models/Reservation.model', () => ({
  releaseExpiredReservations: jest.fn(),
}));
jest.mock('../../src/utils/notifier', () => ({
  notify: jest.fn(),
}));

const reservationModel = require('../../src/models/Reservation.model');
const { notify } = require('../../src/utils/notifier');
const sweep = require('../../src/utils/reservationExpirySweep');

let consoleErrorSpy;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.clearAllMocks();
  sweep.stop();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
  jest.restoreAllMocks();
});

describe('reservationExpirySweep - sweepOnce', () => {
  test('does nothing and calls notify zero times when nothing has expired', async () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([]);

    await sweep.sweepOnce();

    expect(notify).not.toHaveBeenCalled();
  });

  test('notifies both the requester and the owner for each expired reservation', async () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([
      { reservation_id: 1, requester_id: 20, listing_id: 5, owner_id: 10, title: 'Vintage Watch' },
    ]);

    await sweep.sweepOnce();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      20,
      'reservation_status',
      expect.any(String),
      expect.stringContaining('Vintage Watch'),
      '/html/listing.html?id=5',
    );
    expect(notify).toHaveBeenCalledWith(
      10,
      'reservation_status',
      expect.any(String),
      expect.stringContaining('Vintage Watch'),
      '/html/listing.html?id=5',
    );
  });

  test('notifies for every expired reservation when more than one expires in the same sweep', async () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([
      { reservation_id: 1, requester_id: 20, listing_id: 5, owner_id: 10, title: 'Watch' },
      { reservation_id: 2, requester_id: 21, listing_id: 6, owner_id: 11, title: 'Lamp' },
    ]);

    await sweep.sweepOnce();

    expect(notify).toHaveBeenCalledTimes(4);
  });

  test('logs and does not throw when the model call rejects', async () => {
    reservationModel.releaseExpiredReservations.mockRejectedValue(new Error('DB down'));

    await expect(sweep.sweepOnce()).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Reservation expiry sweep failed:',
      expect.any(Error),
    );
    expect(notify).not.toHaveBeenCalled();
  });

  test('skips a second call while the first is still in flight', async () => {
    let resolveFirst;
    reservationModel.releaseExpiredReservations.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const first = sweep.sweepOnce();
    const second = sweep.sweepOnce();

    expect(reservationModel.releaseExpiredReservations).toHaveBeenCalledTimes(1);

    resolveFirst([]);
    await Promise.all([first, second]);
  });

  test('runs again normally once the previous sweep has finished', async () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([]);

    await sweep.sweepOnce();
    await sweep.sweepOnce();

    expect(reservationModel.releaseExpiredReservations).toHaveBeenCalledTimes(2);
  });
});

describe('reservationExpirySweep - start/stop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('start() schedules a recurring sweep', () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([]);

    sweep.start();
    expect(reservationModel.releaseExpiredReservations).not.toHaveBeenCalled();

    jest.advanceTimersByTime(15 * 60 * 1000);
    expect(reservationModel.releaseExpiredReservations).toHaveBeenCalledTimes(1);
  });

  test('start() is idempotent — calling it twice does not double the interval', () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([]);

    sweep.start();
    sweep.start();

    jest.advanceTimersByTime(15 * 60 * 1000);
    expect(reservationModel.releaseExpiredReservations).toHaveBeenCalledTimes(1);
  });

  test('stop() cancels future sweeps', () => {
    reservationModel.releaseExpiredReservations.mockResolvedValue([]);

    sweep.start();
    sweep.stop();

    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(reservationModel.releaseExpiredReservations).not.toHaveBeenCalled();
  });
});
