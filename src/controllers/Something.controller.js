const model = require('../models/Something.model');

module.exports.readAllSomethings = (req, res, next) => {
    const callback = (error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.locals.statusCode = 200;
        res.locals.results = result.rows;
        next();
    };
    model.selectAll(callback);
};

module.exports.readSomethingById = (req, res, next) => {
    const data = { id: req.params.id };
    const callback = (error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }
        res.locals.statusCode = 200;
        res.locals.results = result.rows[0];
        next();
    };
    model.selectById(data, callback);
};

module.exports.createSomething = (req, res, next) => {
    if (req.body.name === undefined) {
        return res.status(400).json({ message: 'Name is required.' });
    }
    const data = { name: req.body.name };
    const callback = (error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        res.locals.statusCode = 201;
        res.locals.results = result.rows[0];
        next();
    };
    model.insertSingle(data, callback);
};

module.exports.updateSomethingById = (req, res, next) => {
    if (req.body.name === undefined) {
        return res.status(400).json({ message: 'Name is required.' });
    }
    const data = { id: req.params.id, name: req.body.name };
    const callback = (error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }
        res.locals.statusCode = 200;
        res.locals.results = result.rows[0];
        next();
    };
    model.updateById(data, callback);
};

module.exports.deleteSomethingById = (req, res, next) => {
    const data = { id: req.params.id };
    const callback = (error, result) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Something not found.' });
        }
        res.locals.statusCode = 200;
        res.locals.results = result.rows[0];
        next();
    };
    model.deleteById(data, callback);
};

module.exports.sendResponse = (req, res) => {
    return res.status(res.locals.statusCode).json(res.locals.results);
};
