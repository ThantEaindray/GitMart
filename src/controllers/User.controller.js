
const model = require('../models/User.model');


// ==============================
// POST /api/register
// Check Username or Email Exist
// ==============================
module.exports.checkUsernameOrEmailExist = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.username === undefined ||
        req.body.email === undefined ||
        req.body.password === undefined) {
        return res.status(400).json({ message: 'Username, email or password is missing.' });
    }

    if (req.body.password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const data = { username: req.body.username };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length > 0) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        // Username is free — now check email
        const emailData = { email: req.body.email };

        const emailCallback = (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (results.length > 0) {
                return res.status(409).json({ message: 'Email already exists.' });
            }

            next();
        };

        model.getUserByEmail(emailData, emailCallback);
    };

    model.getUserByUsername(data, callback);
};

// ==============================
// POST /api/register
// Register User (Create)
// ==============================
module.exports.register = (req, res, next) => {

    // 400 skipped — already checked in checkUsernameOrEmailExist

    const data = {
        username: req.body.username,
        email: req.body.email,
        password: res.locals.hash
    };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // For generateToken: save userId into res.locals
        res.locals.message = `User ${data.username} created successfully.`;
        res.locals.userId = results[0].id;
        res.locals.username = results[0].username;
        res.locals.isStaff = results[0].isStaff;
        next();
    };

    model.createUser(data, callback);
};

// ==============================
// POST /api/login
// Login — Fetch User by Username
// ==============================
module.exports.login = (req, res, next) => {

    // 400 Check for all expected input
    if (req.body.username === undefined ||
        req.body.password === undefined) {
        return res.status(400).json({ message: 'Username or password is missing.' });
    }

    const data = { username: req.body.username };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.locals.hash = results[0].password;
        res.locals.userId = results[0].id;
        res.locals.username = results[0].username;
        res.locals.isStaff = results[0].isStaff;
        res.locals.rememberMe = req.body.rememberMe || false;
        res.locals.message = 'Login successful.';
        next();
    };

    model.getUserByUsername(data, callback);
};

// ==============================
// GET /api/me
// Get Current Logged-In User
// ==============================
module.exports.getCurrentUser = (req, res) => {

    const data = { id: res.locals.userId };

    const callback = (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json(results[0]);
    };

    model.getUserById(data, callback);
};
