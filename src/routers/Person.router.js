const express = require('express');
const router = express.Router();
const model = require('../models/Person.model');

router.get('/', (req, res) => {
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows);
  };
  model.getAllPersons(callback);
});

module.exports = router;
