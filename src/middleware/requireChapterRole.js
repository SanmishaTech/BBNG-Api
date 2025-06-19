const createError = require("http-errors");
const { getUserAccessibleChapters } = require("../services/chapterService");

/**
 * Middleware to ensure a user has at least one of the specified chapter roles.
 * This is a "drop-in" guard and does not check against a specific chapterId.
 * It's useful for routes that are generally restricted to users with certain responsibilities,
 * like an "Office Bearer dashboard".
 *
 * @param {...string} requiredRoleTypes - The role types required for access (e.g., 'OB', 'RD').
 */
const requireChapterRole = (...requiredRoleTypes) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(createError(401, "Authentication required"));
      }

      // Admins and super_admins have unrestricted access.
      const userRoles = Array.isArray(user.roles)
        ? user.roles.map(r => r.toLowerCase())
        : [String(user.role || "").toLowerCase()];

      const adminRoles = ["admin", "super_admin"];
      if (userRoles.some(role => adminRoles.includes(role))) {
        return next();
      }

      if (requiredRoleTypes.length === 0) {
          return next(createError(403, "Forbidden: No roles specified for this route."));
      }

      const accessibleChapters = await getUserAccessibleChapters(user.id);

      const hasRequiredRole = accessibleChapters.some(group =>
        requiredRoleTypes.includes(group.role) && group.chapters.length > 0
      );

      if (hasRequiredRole) {
        return next();
      }

      return next(createError(403, "Forbidden: You do not have the required role to access this resource."));

    } catch (error) {
      console.error("[requireChapterRole] Error:", error);
      return next(createError(500, "Server error while authorizing role access"));
    }
  };
};

module.exports = { requireChapterRole };
