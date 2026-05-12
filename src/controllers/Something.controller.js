// Import Models
const model = require('../models/Something.model');


// ==============================
// GET /somethings
// Read All Somethings
// ==============================
module.exports.readAllSomethings = (req, res, next) => {

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results;
        next();
    };

    model.selectAll(callback);
};

// ==============================
// GET /somethings/:id
// Read Something By ID
// ==============================
module.exports.readSomethingById = (req, res, next) => {

    const data = { id: req.params.id };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results[0];
        next();
    };

    model.selectById(data, callback);
};

// ==============================
// POST /somethings
// Create Something
// ==============================
module.exports.createSomething = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.name === undefined) {
        return res.status(400).json({ message: 'Name is required.' });
    }

    const data = { name: req.body.name };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.locals.statusCode = 201;
        res.locals.results = results[0];
        next();
    };

    model.insertSingle(data, callback);
};

// ==============================
// PUT /somethings/:id
// Update Something By ID
// ==============================
module.exports.updateSomethingById = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.name === undefined) {
        return res.status(400).json({ message: 'Name is required.' });
    }

    const data = {
        id: req.params.id,
        name: req.body.name
    };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results[0];
        next();
    };

    model.updateById(data, callback);
};

// ==============================
// DELETE /somethings/:id
// Delete Something By ID
// ==============================
module.exports.deleteSomethingById = (req, res, next) => {

    const data = { id: req.params.id };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }

        res.locals.statusCode = 200;
        res.locals.results = results[0];
        next();
    };

    model.deleteById(data, callback);
};

// ==============================
// Send Response
// ==============================
module.exports.sendResponse = (req, res) => {
    return res.status(res.locals.statusCode).json(res.locals.results);
};
