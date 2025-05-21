const jwt = require("jsonwebtoken");
const createError = require("http-errors");
const { secret } = require("../config/jwt");
const prisma = require("../config/db");
const { checkMembershipExpiry } = require("../services/membershipService");

module.exports = async (req, res, next) => {
  console.log('[AuthMiddleware] Attempting to authenticate for URL:', req.originalUrl);
  const authHeader = req.headers.authorization;
  console.log('[AuthMiddleware] Authorization header:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AuthMiddleware] No Bearer token found in Authorization header.');
    return next(createError(401, "Unauthorized: No token provided"));
  }
  const token = authHeader.split(" ")[1];
  console.log('[AuthMiddleware] Token extracted:', token ? 'Token present' : 'Token MISSING after split');
  if (!token) {
    return next(createError(401, "Unauthorized"));
  }
  try {
    const decoded = jwt.verify(token, secret);
    console.log('[AuthMiddleware] Token decoded. User ID from token:', decoded?.userId);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    console.log('[AuthMiddleware] User fetched from DB:', user ? `User ID: ${user.id}, Role: ${user.role}` : 'User NOT FOUND in DB');
    if (!user) {
      console.log('[AuthMiddleware] Authentication failed.');
      return next(createError(401, "Unauthorized: User not found"));
    }

    // Check membership expiry for members
    if (user.role.includes('member')) {
      const { active, expiryInfo } = await checkMembershipExpiry(user.id);
      
      // Update user object with current active status
      user.active = active;
      
      // Attach expiry info to request if available
      if (expiryInfo) {
        req.membershipExpiryInfo = expiryInfo;
      }
      
      // If membership has expired, update user's active status and return 403
      if (!active) {
        return next(createError(403, "Your membership has expired. Please contact your administrator."));
      }
    }

    req.user = user;
    console.log('[AuthMiddleware] Authentication successful. User set on req.user.');
    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error during authentication:', error.message);
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createError(401, "Unauthorized: Invalid token"));
    } else if (error instanceof jwt.TokenExpiredError) {
      return next(createError(401, "Unauthorized: Token expired"));
    }
    return next(createError(401, "Unauthorized: Authentication error"));
  }
};
