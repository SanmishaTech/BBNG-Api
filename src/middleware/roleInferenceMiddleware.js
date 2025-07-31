const createError = require("http-errors");
const roleInferenceService = require("../services/roleInferenceService");

/**
 * Middleware to infer user roles and attach role information to the request
 * This middleware should be used after authentication middleware
 */
const roleInferenceMiddleware = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(createError(401, "Unauthorized: User not authenticated"));
    }

    // Skip role inference for admin and super_admin users
    const adminRoles = ["admin", "super_admin"];
    const userRoles = Array.isArray(user.role)
      ? user.role.map((r) => String(r).toLowerCase())
      : [String(user.role || "").toLowerCase()];

    if (userRoles.some((role) => adminRoles.includes(role))) {
      // For admin users, set a default role info with full access
      req.userRole = {
        role: "Administrator",
        accessLevel: "admin",
        authorizedChapters: [], // Empty array indicates full access
        authorizedZones: [], // Empty array indicates full access
        contextLabel: "All System Data",
        permissions: ["*"], // Wildcard permission for admins
      };
      return next();
    }

    // Infer role for non-admin users
    try {
      const roleInfo = await roleInferenceService.inferUserRole(user.id);
      req.userRole = roleInfo;

      console.log(
        `[RoleInference] User ${user.id} inferred as ${roleInfo.role} with ${roleInfo.accessLevel} access`
      );
      next();
    } catch (roleError) {
      console.error(
        `[RoleInference] Failed to infer role for user ${user.id}:`,
        roleError.message
      );

      // Handle specific error cases
      if (roleError.message.includes("Member not found")) {
        return next(createError(403, "Access denied: No member profile found"));
      } else if (roleError.message.includes("No role assignments")) {
        return next(
          createError(403, "Access denied: No role assignments found")
        );
      } else {
        return next(createError(500, "Server error during role inference"));
      }
    }
  } catch (error) {
    console.error("[RoleInference] Unexpected error:", error);
    return next(createError(500, "Server error during role inference"));
  }
};

/**
 * Middleware to validate that user has required permissions for dashboard access
 * This middleware should be used after roleInferenceMiddleware
 */
const validateDashboardAccess = (req, res, next) => {
  try {
    const { userRole } = req;

    if (!userRole) {
      return next(createError(500, "Role information not available"));
    }

    // Check if user has dashboard access permission
    const hasDashboardAccess =
      userRole.permissions.includes("*") ||
      userRole.permissions.includes("dashboard.read");

    if (!hasDashboardAccess) {
      return next(
        createError(
          403,
          "Access denied: Insufficient permissions for dashboard"
        )
      );
    }

    next();
  } catch (error) {
    console.error(
      "[DashboardAccess] Error validating dashboard access:",
      error
    );
    return next(createError(500, "Server error during permission validation"));
  }
};

/**
 * Middleware factory to validate chapter access based on inferred roles
 * @param {Object} options - Configuration options
 * @param {string} options.param - Parameter name containing chapter ID (default: 'chapterId')
 * @param {boolean} options.optional - Whether chapter ID is optional (default: false)
 * @returns {Function} Express middleware function
 */
const validateChapterAccess = (options = {}) => {
  const { param = "chapterId", optional = false } = options;

  return (req, res, next) => {
    try {
      const { userRole } = req;

      if (!userRole) {
        return next(createError(500, "Role information not available"));
      }

      // Admin users have access to all chapters
      if (userRole.accessLevel === "admin") {
        return next();
      }

      // Extract chapter ID from request
      let chapterId;
      if (req.params[param]) {
        chapterId = parseInt(req.params[param], 10);
      } else if (req.query[param]) {
        chapterId = parseInt(req.query[param], 10);
      } else if (req.body[param]) {
        chapterId = parseInt(req.body[param], 10);
      }

      // Handle optional chapter ID
      if (!chapterId && optional) {
        return next();
      }

      if (!chapterId || isNaN(chapterId)) {
        return next(
          createError(
            400,
            `Bad Request: Invalid or missing chapter ID in parameter '${param}'`
          )
        );
      }

      // Check if user has access to the requested chapter
      const hasAccess = userRole.authorizedChapters.includes(chapterId);

      if (!hasAccess) {
        return next(
          createError(
            403,
            `Access denied: You don't have permission to access chapter ${chapterId}`
          )
        );
      }

      next();
    } catch (error) {
      console.error("[ChapterAccess] Error validating chapter access:", error);
      return next(
        createError(500, "Server error during chapter access validation")
      );
    }
  };
};

/**
 * Middleware factory to validate zone access based on inferred roles
 * @param {Object} options - Configuration options
 * @param {string} options.param - Parameter name containing zone ID (default: 'zoneId')
 * @param {boolean} options.optional - Whether zone ID is optional (default: false)
 * @returns {Function} Express middleware function
 */
const validateZoneAccess = (options = {}) => {
  const { param = "zoneId", optional = false } = options;

  return (req, res, next) => {
    try {
      const { userRole } = req;

      if (!userRole) {
        return next(createError(500, "Role information not available"));
      }

      // Admin users have access to all zones
      if (userRole.accessLevel === "admin") {
        return next();
      }

      // Only zone-level roles have zone access
      if (userRole.accessLevel !== "zone") {
        return next(
          createError(403, "Access denied: Zone-level access required")
        );
      }

      // Extract zone ID from request
      let zoneId;
      if (req.params[param]) {
        zoneId = parseInt(req.params[param], 10);
      } else if (req.query[param]) {
        zoneId = parseInt(req.query[param], 10);
      } else if (req.body[param]) {
        zoneId = parseInt(req.body[param], 10);
      }

      // Handle optional zone ID
      if (!zoneId && optional) {
        return next();
      }

      if (!zoneId || isNaN(zoneId)) {
        return next(
          createError(
            400,
            `Bad Request: Invalid or missing zone ID in parameter '${param}'`
          )
        );
      }

      // Check if user has access to the requested zone
      const hasAccess = userRole.authorizedZones.includes(zoneId);

      if (!hasAccess) {
        return next(
          createError(
            403,
            `Access denied: You don't have permission to access zone ${zoneId}`
          )
        );
      }

      next();
    } catch (error) {
      console.error("[ZoneAccess] Error validating zone access:", error);
      return next(
        createError(500, "Server error during zone access validation")
      );
    }
  };
};

module.exports = {
  roleInferenceMiddleware,
  validateDashboardAccess,
  validateChapterAccess,
  validateZoneAccess,
};
