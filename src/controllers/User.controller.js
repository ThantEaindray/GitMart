const model = require('../models/User.model');

module.exports.checkUsernameOrEmailExist = (req, res, next) => {
  if (
    req.body.username === undefined ||
    req.body.email === undefined ||
    req.body.password === undefined
  ) {
    return res.status(400).json({ message: 'Username, email or password is missing.' });
  }

  if (req.body.password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const data = { username: req.body.username };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const emailData = { email: req.body.email };

    const emailCallback = (error, result) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ message: 'Internal server error' });
      }

      if (result.rows.length > 0) {
        return res.status(409).json({ message: 'Email already exists.' });
      }

      next();
    };

    model.getUserByEmail(emailData, emailCallback);
  };

  model.getUserByUsername(data, callback);
};

module.exports.register = (req, res, next) => {
  const data = {
    username: req.body.username,
    email: req.body.email,
    password: res.locals.hash,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    res.locals.message = `User ${data.username} created successfully.`;
    res.locals.userId = result.rows[0].id;
    res.locals.username = result.rows[0].username;
    res.locals.isStaff = result.rows[0].isStaff;
    next();
  };

  model.createUser(data, callback);
};

module.exports.login = (req, res, next) => {
  if (req.body.username === undefined || req.body.password === undefined) {
    return res.status(400).json({ message: 'Username or password is missing.' });
  }

  const data = { username: req.body.username };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.locals.hash = result.rows[0].password;
    res.locals.userId = result.rows[0].id;
    res.locals.username = result.rows[0].username;
    res.locals.isStaff = result.rows[0].isStaff;
    res.locals.rememberMe = req.body.rememberMe || false;
    res.locals.message = 'Login successful.';
    next();
  };

  model.getUserByUsername(data, callback);
};

module.exports.getCurrentUser = (req, res) => {
  const data = { id: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json(result.rows[0]);
  };

  model.getUserById(data, callback);
};
