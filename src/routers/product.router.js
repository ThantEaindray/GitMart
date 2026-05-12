const express = require('express');
const productController = require("../models/product.model.js")
const userController = require("../models/user.models.js")
const router = express.Router();

router.get('/search/{query}/{page}', productController.search)
router.get('/{id}', userController.isLoggedIn, productController.isOwner, productController.product)
router.get('/user/{id}', userController.isLoggedIn, userController.userExists, productController.userProducts)
router.post('/{id}', userController.isLoggedIn, productController.isOwner, productController.updateProduct)