const model = require('../models/product.model');
const { isProductSold } = require('../models/purchaseState');

function applyRuntimeSoldState(product) {
  return {
    ...product,
    isSold: isProductSold(product.id),
  };
}

module.exports.readProducts = (req, res, next) => {
  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.locals.statusCode = 200;
    res.locals.results = result.rows.map(applyRuntimeSoldState);
    next();
  };

  if (req.query.search) {
    model.searchByName({ search: req.query.search }, callback);
  } else if (req.query.category) {
    const data = {
      category: req.query.category,
      excludeId: req.query.exclude || 0,
    };
    model.selectByCategory(data, callback);
  } else {
    model.selectAll(callback);
  }
};

module.exports.readProductById = (req, res, next) => {
  const data = { id: req.params.id };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.locals.statusCode = 200;
    res.locals.results = applyRuntimeSoldState(result.rows[0]);
    next();
  };

  model.selectById(data, callback);
};

module.exports.sendResponse = (req, res) => {
  return res.status(res.locals.statusCode).json(res.locals.results);
};
