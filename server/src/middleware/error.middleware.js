const { error } = require('../utils/response');

/**
 * Global Error Handling Middleware
 */
module.exports = (err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    return error(res, `Upload error: ${err.message}`, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid authentication token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return error(res, 'Authentication token has expired', 401);
  }

  // Handle MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return error(res, 'Duplicate entry: A record with this unique identifier already exists.', 409);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return error(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : null);
};
