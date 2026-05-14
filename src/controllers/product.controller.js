// Import Models
const model = require('../models/product.model');


// ==============================
// GET /products or GET /products?search=query
// Read All Products (with optional search)
// ==============================
module.exports.readProducts = (req, res, next) => {

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results;
        next();
    };

    if (req.query.search) {
        const data = { search: req.query.search };
        model.searchByName(data, callback);
    } else {
        model.selectAll(callback);
    }
};

// ==============================
// GET /products/:id
// Read Product By ID
// ==============================
module.exports.readProductById = (req, res, next) => {

    const data = { id: req.params.id };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results[0];
        next();
    };

    model.selectById(data, callback);
};

// ==============================
// Send Response
// ==============================
module.exports.sendResponse = (req, res) => {
    return res.status(res.locals.statusCode).json(res.locals.results);
};
