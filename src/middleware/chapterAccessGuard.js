const createError = require("http-errors");
const { getUserAccessibleChapters } = require("../controllers/authController");

/**
 * Middleware to verify if a user has access to a specific chapter based on role types (OB, RD, DC).
 * This should be placed AFTER the authentication middleware.
 *
 * It automatically grants access to 'admin' and 'super_admin' roles.
 * For other users, it checks if they have one of the `allowedRoleTypes` for the given chapter.
 *
 * @param {object|string} options - Can be an options object or the first allowedRoleType.
 * @param {string} [options.param='chapterId'] - The name of the route parameter containing the chapter ID.
 * @param {...string} allowedRoleTypes - A list of role types (e.g., 'OB', 'RD', 'DC') that are permitted.
 */
const chapterAccessGuard = (options, ...allowedRoleTypes) => {
  // Handle case where options are omitted and only role types are provided
  if (typeof options === 'string') {
    allowedRoleTypes.unshift(options);
    options = {};
  }

  const { param = 'chapterId' } = options || {};

  return async (req, res, next) => {
    try {
      const { user } = req;
      if (!user) {
        return next(createError(401, "Unauthorized: User not authenticated"));
      }

      // Admins and super_admins have access to all chapters
      const adminRoles = ['admin', 'super_admin'];
      const userRoles = Array.isArray(user.role)
        ? user.role.map(r => String(r).toLowerCase())
        : [String(user.role || "").toLowerCase()];

      if (userRoles.some(role => adminRoles.includes(role))) {
        const chapterIdForLog = req.params[param] || req.query[param] || req.body[param] || '(unknown)';
        console.log(`[chapterAccessGuard] Admin user ${user.id} granted access to chapter ${chapterIdForLog}.`);
        return next();
      }

      let chapterId;
      if (req.params[param]) {
        chapterId = parseInt(req.params[param], 10);
      } else if (req.query[param]) {
        chapterId = parseInt(req.query[param], 10);
      } else if (req.body[param]) {
        chapterId = parseInt(req.body[param], 10);
      }

      if (isNaN(chapterId)) {
        return next(createError(400, `Bad Request: Invalid or missing chapter ID in parameter '${param}'`));
      }

      // If no specific chapter role types are required, and user is not admin, deny access.
      if (allowedRoleTypes.length === 0) {
          console.log(`[chapterAccessGuard] Access denied for non-admin user ${user.id} to chapter ${chapterId}. No chapter roles were specified for this route.`);
          return next(createError(403, "Forbidden: You do not have the required role for this chapter."));
      }

      const accessibleChapters = await getUserAccessibleChapters(user.id);

      // Check if the user has access to the chapter via any of the allowed role types.
      const hasAccess = allowedRoleTypes.some(roleType => {
        const group = accessibleChapters.find(g => g.role === roleType);
        return group && group.chapters.includes(chapterId);
      });

      if (hasAccess) {
        console.log(`[chapterAccessGuard] User ${user.id} granted access to chapter ${chapterId} via role(s): ${allowedRoleTypes.join(', ')}.`);
        return next();
      }

      console.log(`[chapterAccessGuard] User ${user.id} denied access to chapter ${chapterId}. Required one of: ${allowedRoleTypes.join(', ')}.`);
      return next(createError(403, "Forbidden: You do not have the required role for this chapter."));

    } catch (error) {
      console.error("[chapterAccessGuard] Error:", error);
      return next(createError(500, "Server error while authorizing chapter access"));
    }
  };
};

module.exports = { chapterAccessGuard };

