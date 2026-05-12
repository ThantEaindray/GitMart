const express = require('express');
const router = express.Router();

const somethingController = require('../controllers/Something.controller');

// ==============================
// SOMETHING ROUTES
// ==============================

// Read All Somethings
router.get('/',
    somethingController.readAllSomethings,
    somethingController.sendResponse
);

// Read Something By ID
router.get('/:id',
    somethingController.readSomethingById,
    somethingController.sendResponse
);

// Create Something
router.post('/',
    somethingController.createSomething,
    somethingController.sendResponse
);

// Update Something By ID
router.put('/:id',
    somethingController.updateSomethingById,
    somethingController.sendResponse
);

// Delete Something By ID
router.delete('/:id',
    somethingController.deleteSomethingById,
    somethingController.sendResponse
);

module.exports = router;
