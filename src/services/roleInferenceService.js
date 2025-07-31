const prisma = require("../config/db");

/**
 * Role Inference Service
 * Analyzes user assignments and determines access levels for the performance dashboard
 */
class RoleInferenceService {
  /**
   * Infer user role based on their assignments in the system
   * @param {number} userId - User ID to analyze
   * @returns {Promise<Object>} Role inference result
   */
  async inferUserRole(userId) {
    try {
      const member = await prisma.member.findUnique({
        where: { userId },
        include: {
          chapterRoles: {
            include: {
              chapter: {
                select: {
                  id: true,
                  name: true,
                  zoneId: true,
                  zones: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          zoneRoles: {
            include: {
              zone: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!member) {
        throw new Error("Member not found for user");
      }

      // Analyze zone-level assignments first (highest priority)
      const zoneRoleAnalysis = this._analyzeZoneRoles(member.zoneRoles);
      if (zoneRoleAnalysis.hasZoneRole) {
        const authorizedChapters = await this._getChaptersInZones(
          zoneRoleAnalysis.authorizedZones
        );
        return {
          role: zoneRoleAnalysis.inferredRole,
          accessLevel: "zone",
          authorizedChapters,
          authorizedZones: zoneRoleAnalysis.authorizedZones,
          contextLabel: this._generateContextLabel(
            "zone",
            zoneRoleAnalysis.inferredRole,
            zoneRoleAnalysis.authorizedZones.length
          ),
          permissions: this._getPermissionsForRole(
            zoneRoleAnalysis.inferredRole,
            "zone"
          ),
        };
      }

      // Analyze chapter-level assignments
      const chapterRoleAnalysis = this._analyzeChapterRoles(
        member.chapterRoles
      );
      if (chapterRoleAnalysis.hasChapterRole) {
        return {
          role: chapterRoleAnalysis.inferredRole,
          accessLevel: chapterRoleAnalysis.accessLevel,
          authorizedChapters: chapterRoleAnalysis.authorizedChapters,
          authorizedZones: [], // Chapter-level roles don't have zone access
          contextLabel: this._generateContextLabel(
            chapterRoleAnalysis.accessLevel,
            chapterRoleAnalysis.inferredRole,
            chapterRoleAnalysis.authorizedChapters.length
          ),
          permissions: this._getPermissionsForRole(
            chapterRoleAnalysis.inferredRole,
            chapterRoleAnalysis.accessLevel
          ),
        };
      }

      // No role assignments found
      throw new Error("No role assignments found for user");
    } catch (error) {
      console.error("Error in role inference:", error);
      throw error;
    }
  }

  /**
   * Get authorized chapters for a user based on their inferred role
   * @param {number} userId - User ID
   * @param {string} role - Inferred role
   * @returns {Promise<Array>} Array of authorized chapter IDs
   */
  async getAuthorizedChapters(userId, role) {
    try {
      const roleInfo = await this.inferUserRole(userId);
      return roleInfo.authorizedChapters;
    } catch (error) {
      console.error("Error getting authorized chapters:", error);
      return [];
    }
  }

  /**
   * Get authorized zones for a user based on their inferred role
   * @param {number} userId - User ID
   * @param {string} role - Inferred role
   * @returns {Promise<Array>} Array of authorized zone IDs
   */
  async getAuthorizedZones(userId, role) {
    try {
      const roleInfo = await this.inferUserRole(userId);
      return roleInfo.authorizedZones;
    } catch (error) {
      console.error("Error getting authorized zones:", error);
      return [];
    }
  }

  /**
   * Analyze zone-level role assignments
   * @param {Array} zoneRoles - Array of zone role assignments
   * @returns {Object} Zone role analysis result
   * @private
   */
  _analyzeZoneRoles(zoneRoles) {
    if (!zoneRoles || zoneRoles.length === 0) {
      return { hasZoneRole: false };
    }

    const regionalDirectorRoles = zoneRoles.filter(
      (role) =>
        role.roleType === "Regional Director" ||
        role.roleType === "regionalDirector"
    );

    const jointSecretaryRoles = zoneRoles.filter(
      (role) =>
        role.roleType === "Joint Secretary" ||
        role.roleType === "jointSecretary"
    );

    let inferredRole = null;
    let authorizedZones = [];

    // Regional Director takes precedence
    if (regionalDirectorRoles.length > 0) {
      inferredRole = "Regional Director";
      authorizedZones = regionalDirectorRoles.map((role) => role.zoneId);
    } else if (jointSecretaryRoles.length > 0) {
      inferredRole = "Joint Secretary";
      authorizedZones = jointSecretaryRoles.map((role) => role.zoneId);
    }

    return {
      hasZoneRole: inferredRole !== null,
      inferredRole,
      authorizedZones: [...new Set(authorizedZones)], // Remove duplicates
    };
  }

  /**
   * Analyze chapter-level role assignments
   * @param {Array} chapterRoles - Array of chapter role assignments
   * @returns {Object} Chapter role analysis result
   * @private
   */
  _analyzeChapterRoles(chapterRoles) {
    if (!chapterRoles || chapterRoles.length === 0) {
      return { hasChapterRole: false };
    }

    const officeBearerRoles = ["chapterHead", "secretary", "treasurer"];
    const developmentCoordinatorRoles = [
      "guardian",
      "districtCoordinator",
      "developmentCoordinator",
    ];

    const obRoles = chapterRoles.filter((role) =>
      officeBearerRoles.includes(role.roleType)
    );

    const dcRoles = chapterRoles.filter((role) =>
      developmentCoordinatorRoles.includes(role.roleType)
    );

    let inferredRole = null;
    let accessLevel = null;
    let authorizedChapters = [];

    // Office Bearer roles (single chapter access)
    if (obRoles.length > 0) {
      inferredRole = this._mapChapterRoleToDisplayRole(obRoles[0].roleType);
      accessLevel = "single-chapter";
      authorizedChapters = obRoles.map((role) => role.chapterId);
    }
    // Development Coordinator roles (multiple chapter access)
    else if (dcRoles.length > 0) {
      inferredRole = "Development Coordinator";
      accessLevel = "chapter";
      authorizedChapters = dcRoles.map((role) => role.chapterId);
    }

    return {
      hasChapterRole: inferredRole !== null,
      inferredRole,
      accessLevel,
      authorizedChapters: [...new Set(authorizedChapters)], // Remove duplicates
    };
  }

  /**
   * Map internal chapter role types to display-friendly role names
   * @param {string} roleType - Internal role type
   * @returns {string} Display-friendly role name
   * @private
   */
  _mapChapterRoleToDisplayRole(roleType) {
    const roleMapping = {
      chapterHead: "Chapter Head",
      secretary: "Secretary",
      treasurer: "Treasurer",
    };
    return roleMapping[roleType] || "Office Bearer";
  }

  /**
   * Get chapters within specified zones
   * @param {Array} zoneIds - Array of zone IDs
   * @returns {Promise<Array>} Array of chapter IDs
   * @private
   */
  async _getChaptersInZones(zoneIds) {
    if (!zoneIds || zoneIds.length === 0) {
      return [];
    }

    try {
      const chapters = await prisma.chapter.findMany({
        where: {
          zoneId: { in: zoneIds },
        },
        select: {
          id: true,
        },
      });

      return chapters.map((chapter) => chapter.id);
    } catch (error) {
      console.error("Error getting chapters in zones:", error);
      return [];
    }
  }

  /**
   * Generate contextual label for user's access scope
   * @param {string} accessLevel - Access level (zone, chapter, single-chapter)
   * @param {string} role - Inferred role
   * @param {number} count - Number of zones/chapters
   * @returns {string} Context label
   * @private
   */
  _generateContextLabel(accessLevel, role, count) {
    switch (accessLevel) {
      case "zone":
        return count === 1
          ? "Chapters Under Your Zone"
          : "Chapters Under Your Zones";
      case "chapter":
        return count === 1 ? "Your Assigned Chapter" : "Your Assigned Chapters";
      case "single-chapter":
        return "Your Chapter";
      default:
        return "Your Data Scope";
    }
  }

  /**
   * Get permissions for a specific role and access level
   * @param {string} role - Inferred role
   * @param {string} accessLevel - Access level
   * @returns {Array} Array of permissions
   * @private
   */
  _getPermissionsForRole(role, accessLevel) {
    const basePermissions = ["dashboard.read", "performance.read"];

    switch (accessLevel) {
      case "zone":
        return [
          ...basePermissions,
          "zone.read",
          "chapter.read",
          "member.read",
          "export.read",
        ];
      case "chapter":
        return [
          ...basePermissions,
          "chapter.read",
          "member.read",
          "export.read",
        ];
      case "single-chapter":
        return [...basePermissions, "chapter.read", "member.read"];
      default:
        return basePermissions;
    }
  }
}

module.exports = new RoleInferenceService();
