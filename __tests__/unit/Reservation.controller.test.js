jest.mock('../../src/models/Reservation.model', () => ({
  getListingForReservation: jest.fn(),
  getPendingRequest: jest.fn(),
  createReservationRequest: jest.fn(),
  getSentReservations: jest.fn(),
  getReceivedReservations: jest.fn(),
  getReservationById: jest.fn(),
  cancelPendingReservation: jest.fn(),
  acceptReservationRequest: jest.fn(),
  rejectReservationRequest: jest.fn(),
}));

const model = require('../../src/models/Reservation.model');
const controller = require('../../src/controllers/Reservation.controller');

function createRequest({ params = {}, body = {} } = {}) {
  return {
    params,
    body,
  };
}

function createResponse(userId = 10) {
  const res = {
    locals: {
      userId,
    },
    status: jest.fn(),
    json: jest.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

let consoleErrorSpy;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  Object.values(model).forEach((mockFunction) => {
    mockFunction.mockReset();
  });

  consoleErrorSpy.mockClear();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

describe('Reservation.controller', () => {
  describe('createReservationRequest', () => {
    test('returns 400 when listing ID is invalid', () => {
      const req = createRequest({
        params: {
          listingId: 'invalid',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Listing ID must be a positive integer.',
      });

      expect(model.getListingForReservation).not.toHaveBeenCalled();
    });

    test('returns 400 when reservation message is not text', () => {
      const req = createRequest({
        params: {
          listingId: '5',
        },
        body: {
          message: 123,
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation message must be text.',
      });
    });

    test('returns 400 when message exceeds 500 characters', () => {
      const req = createRequest({
        params: {
          listingId: '5',
        },
        body: {
          message: 'a'.repeat(501),
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation message cannot exceed 500 characters.',
      });
    });

    test('returns 500 when listing lookup fails', () => {
      const databaseError = new Error('Listing lookup failed');

      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(databaseError);
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error.',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(databaseError);
    });

    test('returns 404 when listing does not exist', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Listing not found.',
      });
    });

    test('returns 409 when listing has no owner', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: null,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'This listing cannot receive reservation requests because it has no owner.',
      });
    });

    test('returns 403 when user reserves their own listing', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 20,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(res.json).toHaveBeenCalledWith({
        message: 'You cannot reserve your own listing.',
      });
    });

    test('returns 409 when listing is unavailable', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'RESERVED',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only available listings can be reserved.',
      });
    });

    test('returns 500 when pending-request lookup fails', () => {
      const databaseError = new Error('Pending lookup failed');

      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(databaseError);
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error.',
      });
    });

    test('returns 409 when requester already has a pending request', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 50,
              status: 'PENDING',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'You already have a pending reservation request for this listing.',
      });
    });

    test('returns 409 for duplicate pending database constraint', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((_data, callback) => {
        callback({
          code: '23505',
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'You already have a pending reservation request for this listing.',
      });
    });

    test('returns 400 for reservation check-constraint failure', () => {
      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((_data, callback) => {
        callback({
          code: '23514',
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'The reservation request contains invalid data.',
      });
    });

    test('returns 500 for unexpected creation error', () => {
      const databaseError = new Error('Create failed');

      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((_data, callback) => {
        callback(databaseError);
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error.',
      });
    });

    test('creates reservation and trims its message', () => {
      const createdReservation = {
        id: 100,
        listing_id: 5,
        requester_id: 20,
        status: 'PENDING',
        message: 'Please reserve this.',
      };

      model.getListingForReservation.mockImplementation((data, callback) => {
        expect(data).toEqual({
          listing_id: 5,
        });

        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((data, callback) => {
        expect(data).toEqual({
          listing_id: 5,
          requester_id: 20,
        });

        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((data, callback) => {
        expect(data).toEqual({
          listing_id: 5,
          requester_id: 20,
          message: 'Please reserve this.',
        });

        callback(null, {
          rows: [createdReservation],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
        body: {
          message: '  Please reserve this.  ',
        },
      });

      const res = createResponse('20');

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request created successfully.',
        reservation: createdReservation,
      });
    });

    test('creates a reservation with a null message when request body is missing', () => {
      const createdReservation = {
        id: 101,
        listing_id: 5,
        requester_id: 20,
        status: 'PENDING',
        message: null,
      };

      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((data, callback) => {
        expect(data).toEqual({
          listing_id: 5,
          requester_id: 20,
          message: null,
        });

        callback(null, {
          rows: [createdReservation],
        });
      });

      const req = {
        params: {
          listingId: '5',
        },
      };

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request created successfully.',
        reservation: createdReservation,
      });
    });

    test('converts a whitespace-only message to null', () => {
      const createdReservation = {
        id: 102,
        listing_id: 5,
        requester_id: 20,
        status: 'PENDING',
        message: null,
      };

      model.getListingForReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 5,
              owner_id: 10,
              status: 'AVAILABLE',
            },
          ],
        });
      });

      model.getPendingRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      model.createReservationRequest.mockImplementation((data, callback) => {
        expect(data).toEqual({
          listing_id: 5,
          requester_id: 20,
          message: null,
        });

        callback(null, {
          rows: [createdReservation],
        });
      });

      const req = createRequest({
        params: {
          listingId: '5',
        },
        body: {
          message: '   ',
        },
      });

      const res = createResponse(20);

      controller.createReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request created successfully.',
        reservation: createdReservation,
      });
    });
  });

  describe('getSentReservations', () => {
    test('returns 500 when model query fails', () => {
      const databaseError = new Error('Sent query failed');

      model.getSentReservations.mockImplementation((_data, callback) => {
        callback(databaseError);
      });

      const res = createResponse(20);

      controller.getSentReservations({}, res);

      expect(model.getSentReservations).toHaveBeenCalledWith(
        {
          requester_id: 20,
        },
        expect.any(Function),
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns sent reservation rows', () => {
      const rows = [
        {
          id: 1,
          requester_id: 20,
          status: 'PENDING',
        },
      ];

      model.getSentReservations.mockImplementation((_data, callback) => {
        callback(null, {
          rows,
        });
      });

      const res = createResponse('20');

      controller.getSentReservations({}, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('getReceivedReservations', () => {
    test('returns 500 when model query fails', () => {
      model.getReceivedReservations.mockImplementation((_data, callback) => {
        callback(new Error('Received query failed'));
      });

      const res = createResponse(10);

      controller.getReceivedReservations({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns received reservation rows', () => {
      const rows = [
        {
          id: 2,
          owner_id: 10,
          status: 'PENDING',
        },
      ];

      model.getReceivedReservations.mockImplementation((data, callback) => {
        expect(data).toEqual({
          owner_id: 10,
        });

        callback(null, {
          rows,
        });
      });

      const res = createResponse('10');

      controller.getReceivedReservations({}, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(rows);
    });
  });

  describe('cancelReservationRequest', () => {
    test('returns 400 for invalid reservation ID', () => {
      const req = createRequest({
        params: {
          id: 'invalid',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(model.getReservationById).not.toHaveBeenCalled();
    });

    test('returns 500 when reservation lookup fails', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(new Error('Lookup failed'));
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 404 when reservation does not exist', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request not found.',
      });
    });

    test('returns 403 when user is not the requester', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 7,
              requester_id: 99,
              status: 'PENDING',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns 409 when request is not pending', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 7,
              requester_id: 20,
              status: 'ACCEPTED',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only pending reservation requests can be cancelled.',
      });
    });

    test('returns 500 when cancellation query fails', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 7,
              requester_id: 20,
              status: 'PENDING',
            },
          ],
        });
      });

      model.cancelPendingReservation.mockImplementation((_data, callback) => {
        callback(new Error('Cancellation failed'));
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 409 when reservation changed before update', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 7,
              requester_id: 20,
              status: 'PENDING',
            },
          ],
        });
      });

      model.cancelPendingReservation.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse(20);

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'The reservation request is no longer pending.',
      });
    });

    test('cancels a pending reservation', () => {
      const cancelledReservation = {
        id: 7,
        requester_id: 20,
        status: 'CANCELLED',
      };

      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 7,
              requester_id: 20,
              status: 'PENDING',
            },
          ],
        });
      });

      model.cancelPendingReservation.mockImplementation((data, callback) => {
        expect(data).toEqual({
          id: 7,
          requester_id: 20,
        });

        callback(null, {
          rows: [cancelledReservation],
        });
      });

      const req = createRequest({
        params: {
          id: '7',
        },
      });

      const res = createResponse('20');

      controller.cancelReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request cancelled successfully.',
        reservation: cancelledReservation,
      });
    });
  });

  describe('acceptReservationRequest', () => {
    test('returns 400 for invalid reservation ID', async () => {
      const req = createRequest({
        params: {
          id: 'invalid',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(model.acceptReservationRequest).not.toHaveBeenCalled();
    });

    test('returns 404 when reservation is missing', async () => {
      model.acceptReservationRequest.mockResolvedValue({
        notFound: true,
      });

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 403 when user is not the listing owner', async () => {
      model.acceptReservationRequest.mockResolvedValue({
        forbidden: true,
      });

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only the listing owner can accept reservation requests.',
      });
    });

    test('returns 409 when request is not pending', async () => {
      model.acceptReservationRequest.mockResolvedValue({
        invalidState: true,
        currentStatus: 'REJECTED',
      });

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only pending reservation requests can be accepted. Current status: REJECTED.',
      });
    });

    test('returns 409 when listing is unavailable', async () => {
      model.acceptReservationRequest.mockResolvedValue({
        listingUnavailable: true,
        listingStatus: 'SOLD',
      });

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only listings with AVAILABLE status can be reserved. Current status: SOLD.',
      });
    });

    test('accepts a pending reservation', async () => {
      const acceptedReservation = {
        id: 8,
        requester_id: 20,
        status: 'ACCEPTED',
      };

      model.acceptReservationRequest.mockResolvedValue({
        reservation: acceptedReservation,
      });

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse('10');

      await controller.acceptReservationRequest(req, res);

      expect(model.acceptReservationRequest).toHaveBeenCalledWith({
        id: 8,
        owner_id: 10,
      });

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request accepted successfully.',
        reservation: acceptedReservation,
      });
    });

    test('returns 500 when acceptance throws an error', async () => {
      const databaseError = new Error('Acceptance failed');

      model.acceptReservationRequest.mockRejectedValue(databaseError);

      const req = createRequest({
        params: {
          id: '8',
        },
      });

      const res = createResponse(10);

      await controller.acceptReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error.',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(databaseError);
    });
  });

  describe('rejectReservationRequest', () => {
    test('returns 400 for invalid reservation ID', () => {
      const req = createRequest({
        params: {
          id: 'invalid',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(model.getReservationById).not.toHaveBeenCalled();
    });

    test('returns 500 when reservation lookup fails', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(new Error('Lookup failed'));
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 404 when reservation is missing', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 403 when user is not the listing owner', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 9,
              owner_id: 99,
              status: 'PENDING',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(403);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only the listing owner can reject reservation requests.',
      });
    });

    test('returns 409 when request is not pending', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 9,
              owner_id: 10,
              status: 'ACCEPTED',
            },
          ],
        });
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Only pending reservation requests can be rejected.',
      });
    });

    test('returns 500 when rejection query fails', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 9,
              owner_id: 10,
              status: 'PENDING',
            },
          ],
        });
      });

      model.rejectReservationRequest.mockImplementation((_data, callback) => {
        callback(new Error('Rejection failed'));
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    test('returns 409 when request changed before rejection', () => {
      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 9,
              owner_id: 10,
              status: 'PENDING',
            },
          ],
        });
      });

      model.rejectReservationRequest.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [],
        });
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse(10);

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        message: 'The reservation request is no longer pending.',
      });
    });

    test('rejects a pending reservation', () => {
      const rejectedReservation = {
        id: 9,
        owner_id: 10,
        status: 'REJECTED',
      };

      model.getReservationById.mockImplementation((_data, callback) => {
        callback(null, {
          rows: [
            {
              id: 9,
              owner_id: 10,
              status: 'PENDING',
            },
          ],
        });
      });

      model.rejectReservationRequest.mockImplementation((data, callback) => {
        expect(data).toEqual({
          id: 9,
          owner_id: 10,
        });

        callback(null, {
          rows: [rejectedReservation],
        });
      });

      const req = createRequest({
        params: {
          id: '9',
        },
      });

      const res = createResponse('10');

      controller.rejectReservationRequest(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Reservation request rejected successfully.',
        reservation: rejectedReservation,
      });
    });
  });
});
