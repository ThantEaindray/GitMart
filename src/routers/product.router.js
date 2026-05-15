const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');

// ==============================
// PRODUCT ROUTES
// ==============================

// Read All Products (supports ?search=query)
router.get('/',
    productController.readProducts,
    productController.sendResponse
);

// Read Product By ID
router.get('/:id',
    productController.readProductById,
    productController.sendResponse
);

module.exports = router;
