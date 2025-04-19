const createError = require('http-errors');
const aclService = require('../services/aclService');

module.exports = (permission) => async (req, res, next) => {
  try {
    if (!req.user || !req.user.role) {
      return next(createError(403, 'User role not found'));
    }

    // Use aclService to check if the user has the required permission
    const hasPermission = await aclService.hasPermission(req.user, permission);

    if (hasPermission) {
      return next();
    }

    return next(createError(403, 'Insufficient permissions'));
  } catch (error) {
    return next(createError(500, 'Error checking permissions'));
  }
};
