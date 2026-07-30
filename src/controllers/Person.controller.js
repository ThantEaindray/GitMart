const model = require('../models/Person.model');

module.exports.getAllPersons = (req, res) => {
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows);
  };

  model.getAllPersons(callback);
};
