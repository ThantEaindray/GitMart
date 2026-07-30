const { GoogleGenerativeAI } = require('@google/generative-ai');
const model = require('../models/Listing.model');
const {
  normalizeListingStatus,
  isValidListingStatus,
  canTransitionListingStatus,
  getLegacyListingFlags,
} = require('../utils/listingLifecycle');
const { isListingSold } = require('../utils/purchaseState');

function applyRuntimeSoldState(listing) {
  return {
    ...listing,
    isSold: Boolean(listing.isSold || isListingSold({ id: listing.id })),
  };
}

function applyRuntimeSoldStateToRows(rows) {
  return rows.map(applyRuntimeSoldState);
}

// ── Gemini helper ─────────────────────────────────────────────────────────

function extractGeminiText(result) {
  return result.response
    .text()
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}

// POST /api/listings/analyse-image
module.exports.analyseImage = function (req, res) {
  const { imageBase64, mimeType } = req.body || {};

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ message: 'imageBase64 and mimeType are required.' });
  }

  function onSuccess(parsed) {
    return res.status(200).json({ title: parsed.title, description: parsed.description });
  }

  function onError(err) {
    console.log(err);
    return res.status(500).json({ message: 'Failed to analyse image.' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const gemini = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt =
    'Look at this image and suggest a listing title (max 60 characters) and a short description (2-3 sentences) for selling this item on a luxury marketplace. Respond ONLY with valid JSON, no markdown: {"title": "...", "description": "..."}';

  gemini
    .generateContent([{ inlineData: { data: imageBase64, mimeType } }, prompt])
    .then(extractGeminiText)
    .then(JSON.parse)
    .then(onSuccess)
    .catch(onError);
};

// GET /api/listings/recently-viewed
module.exports.getRecentlyViewed = (req, res) => {
  const data = { userId: res.locals.userId };
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.getRecentlyViewed(data, callback);
};

// GET /api/listings/most-viewed
module.exports.getMostViewed = (req, res) => {
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.getMostViewed(callback);
};

// GET /api/listings/search
module.exports.searchListings = (req, res) => {
  const data = {
    search: req.query.search || '',
    minPrice: req.query.minPrice || null,
    maxPrice: req.query.maxPrice || null,
    sort: req.query.sort || 'newest',
    category: req.query.category || '',
  };
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.searchListings(data, callback);
};

// GET /api/listings/dashboard — step 3: viewers per listing
module.exports.loadSellerViewBreakdown = (req, res, next) => {
  const data = { owner_id: res.locals.userId };
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    res.locals.dashViewBreakdown = result.rows;
    next();
  };
  model.getSellerViewBreakdown(data, callback);
};

// GET /api/listings/dashboard
module.exports.loadSellerStats = (req, res, next) => {
  const data = { owner_id: res.locals.userId };
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    res.locals.dashStats = result.rows[0];
    next();
  };
  model.getSellerStats(data, callback);
};

module.exports.loadSellerCategoryBreakdown = (req, res, next) => {
  const data = { owner_id: res.locals.userId };
  const callback = (error, result) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    res.locals.dashCategories = result.rows;
    next();
  };
  model.getSellerCategoryBreakdown(data, callback);
};

module.exports.sendDashboard = (req, res) => {
  return res.status(200).json({
    stats: res.locals.dashStats,
    categories: res.locals.dashCategories,
    viewBreakdown: res.locals.dashViewBreakdown,
  });
};

// GET /api/listings/category/:category
module.exports.getListingsByCategory = (req, res) => {
  const data = { category: req.params.category };
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.getListingsByCategory(data, callback);
};

// GET /api/listings
module.exports.getAllListings = (req, res) => {
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.getAllListings(callback);
};

// GET /api/listings/:id
module.exports.getListingById = (req, res) => {
  const data = {
    id: req.params.id,
    userId: res.locals.userId || null,
  };
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    return res.status(200).json(applyRuntimeSoldState(result.rows[0]));
  };
  if (data.userId) {
    model.getListingByIdWithView(data, callback);
  } else {
    model.getListingById(data, callback);
  }
};

// GET /api/listings/owner/:owner_id
module.exports.getListingsByOwner = (req, res) => {
  const data = { owner_id: req.params.owner_id };
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(applyRuntimeSoldStateToRows(result.rows));
  };
  model.getListingsByOwner(data, callback);
};

// POST /api/listings
module.exports.createListing = (req, res) => {
  const { title, description, price } = req.body || {};

  if (!title || !description || price === undefined) {
    return res.status(400).json({
      message: 'Title, description and price are required.',
    });
  }

  if (Number(price) <= 0) {
    return res.status(400).json({
      message: 'Price must be more than 0.',
    });
  }

  const data = {
    owner_id: res.locals.userId,
    title,
    description,
    price,
    category: req.body.category || 'Others',
    image_url: req.body.imageUrl || null,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(201).json({
      message: 'Listing created successfully.',
      listing: result.rows[0],
    });
  };

  model.createListing(data, callback);
};

// PATCH /api/listings/:id
module.exports.updateListing = (req, res) => {
  const { title, description, price } = req.body || {};

  if (!title || !description || price === undefined) {
    return res.status(400).json({
      message: 'Title, description and price are required.',
    });
  }

  if (Number(price) <= 0) {
    return res.status(400).json({
      message: 'Price must be more than 0.',
    });
  }

  const data = {
    id: req.params.id,
    owner_id: res.locals.userId,
    title,
    description,
    price,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Listing not found or you are not the owner.',
      });
    }
    return res.status(200).json({
      message: 'Listing updated successfully.',
      listing: result.rows[0],
    });
  };

  model.updateListing(data, callback);
};

// PATCH /api/listings/:id/status — step 1: validate input
module.exports.validateListingStatusInput = (req, res, next) => {
  const listingId = Number(req.params.id);
  const { status: requestedStatus } = req.body || {};

  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json({ message: 'Listing ID must be a positive integer.' });
  }
  if (typeof requestedStatus !== 'string' || requestedStatus.trim() === '') {
    return res.status(400).json({ message: 'Status is required.' });
  }

  const nextStatus = normalizeListingStatus(requestedStatus);

  if (!isValidListingStatus(nextStatus)) {
    return res
      .status(400)
      .json({ message: 'Status must be AVAILABLE, RESERVED, SOLD or ARCHIVED.' });
  }

  res.locals.nextStatus = nextStatus;
  next();
};

// PATCH /api/listings/:id/status — step 2: fetch listing and validate ownership + transition
module.exports.loadListingForStatusUpdate = (req, res, next) => {
  const data = { id: Number(req.params.id) };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const listing = result.rows[0];
    const nextStatus = res.locals.nextStatus;

    if (Number(listing.owner_id) !== Number(res.locals.userId)) {
      return res.status(403).json({ message: 'Only the listing owner can change its status.' });
    }
    if (!canTransitionListingStatus(listing.status, nextStatus)) {
      return res.status(409).json({
        message: `Cannot change listing status from ${listing.status} to ${nextStatus}.`,
      });
    }

    const { isSold, isClosed } = getLegacyListingFlags(nextStatus);

    res.locals.statusUpdateData = {
      id: Number(req.params.id),
      owner_id: res.locals.userId,
      current_status: listing.status,
      status: nextStatus,
      isSold,
      isClosed,
    };
    next();
  };

  model.getListingLifecycleById(data, callback);
};

// PATCH /api/listings/:id/status — step 3: apply the update and respond
module.exports.updateListingStatus = (req, res) => {
  const data = res.locals.statusUpdateData;

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(409).json({
        message: 'The listing status changed before this request was completed. Please try again.',
      });
    }
    return res.status(200).json({
      message: `Listing status changed from ${data.current_status} to ${data.status}.`,
      listing: result.rows[0],
    });
  };

  model.updateListingStatus(data, callback);
};

// DELETE /api/listings/:id
module.exports.deleteListing = (req, res) => {
  const data = {
    id: req.params.id,
    owner_id: res.locals.userId,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Listing not found or you are not the owner.',
      });
    }
    return res.status(200).json({
      message: 'Listing deleted successfully.',
    });
  };

  model.deleteListing(data, callback);
};
