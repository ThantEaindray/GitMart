const model = require('../models/User.model');

module.exports.checkUsernameExists = (req, res, next) => {
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
    next();
  };

  model.getUserByUsername(data, callback);
};

module.exports.checkEmailExists = (req, res, next) => {
  const data = { email: req.body.email };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists.' });
    }
    next();
  };

  model.getUserByEmail(data, callback);
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

module.exports.getSettings = (req, res) => {
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

  model.getUserSettings(data, callback);
};

module.exports.updateSettings = (req, res) => {
  const data = {
    id: res.locals.userId,
    theme: req.body.theme ?? null,
    currency: req.body.currency || 'USD',
    fontSize: req.body.fontSize ?? null,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows[0]);
  };

  model.updateUserSettings(data, callback);
};

module.exports.updateDisplayName = (req, res) => {
  const data = { id: res.locals.userId, displayName: req.body.displayName ?? null };

  const callback = (error) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Display name updated.' });
  };

  model.updateDisplayName(data, callback);
};

module.exports.updateNotifications = (req, res) => {
  const data = {
    id: res.locals.userId,
    notifyOrders: req.body.notifyOrders !== false,
    notifyPromotions: req.body.notifyPromotions === true,
  };

  const callback = (error) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Notification preferences updated.' });
  };

  model.updateNotifications(data, callback);
};

module.exports.deleteAccount = (req, res) => {
  const data = { id: res.locals.userId };

  const callback = (error) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'Strict' });
    return res.status(200).json({ message: 'Account deleted.' });
  };

  model.deleteUser(data, callback);
};

module.exports.getPasswordHash = (req, res, next) => {
  if (!req.body.currentPassword || !req.body.newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (req.body.newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }

  const data = { id: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.locals.hash = result.rows[0].password;
    next();
  };

  model.getUserPasswordById(data, callback);
};

module.exports.updatePassword = (req, res) => {
  const data = { id: res.locals.userId, password: res.locals.hash };

  const callback = (error) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ message: 'Password updated successfully.' });
  };

  model.updateUserPassword(data, callback);
};

module.exports.sendRegistered = (req, res) => {
  return res.status(201).json({ message: 'Account created successfully. Please log in.' });
};

module.exports.logout = (req, res) => {
  const token = req.cookies?.refreshToken;

  const finish = () => {
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'Strict' });
    return res.status(200).json({ message: 'Logged out.' });
  };

  if (!token) return finish();

  model.deleteRefreshToken({ token }, (error) => {
    if (error) console.log(error);
    finish();
  });
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
