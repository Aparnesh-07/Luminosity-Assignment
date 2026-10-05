const authService = require('../services/auth.service');
const { success, error } = require('../utils/response');

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, studioName } = req.body;
    if (!email || !password || !name) {
      return error(res, 'Email, password, and name are required', 400);
    }
    if (password.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400);
    }

    const data = await authService.register({ email, password, name, studioName });
    return success(res, data, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginIdentifier = identifier || email || username;
    if (!loginIdentifier || !password) {
      return error(res, 'Username or email and password are required', 400);
    }

    const data = await authService.login({ identifier: loginIdentifier, password });
    return success(res, data, 'Login successful');
  } catch (err) {
    return error(res, err.message, 401);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res) => {
  // With stateless JWT, client deletes the token. Endpoint confirms logout.
  return success(res, null, 'Logged out successfully');
};
