const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');
const { query } = require('../config/database');

/**
 * Authentication Middleware: Validates Bearer JWT Token
 */
exports.requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Authorization token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'luminosity_super_secret_jwt_key_2026';
    const decoded = jwt.verify(token, secret);

    // Fetch user and user's default studio
    const [users] = await query(
      `SELECT u.id, u.email, u.name, u.role, s.id as studio_id, s.name as studio_name 
       FROM users u 
       LEFT JOIN studios s ON s.owner_id = u.id 
       WHERE u.id = ? LIMIT 1`,
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      return error(res, 'User no longer exists or unauthorized', 401);
    }

    const user = users[0];
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studioId: user.studio_id || 1
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired, please log in again', 401);
    }
    return error(res, 'Invalid authentication token', 401);
  }
};

/**
 * Authorization Middleware: Checks allowed user roles
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
};
