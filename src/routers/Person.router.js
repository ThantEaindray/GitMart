const express = require('express');
const router = express.Router();

const personController = require('../controllers/Person.controller');

router.get('/', personController.getAllPersons);

module.exports = router;
