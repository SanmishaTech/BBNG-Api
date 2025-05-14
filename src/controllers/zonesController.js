/**
 * Controller for handling Zone-related operations.
 *
 * Provides functions to manage zones, including retrieving, creating,
 * updating, and deleting zones based on requests routed from zoneRoutes.js.
 *
 * @module controllers/zoneController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const asyncHandler = require("../middleware/asyncHandler");

// Define Zone Role Types
const ZONE_ROLE_TYPES = {
  REGIONAL_DIRECTOR: "Regional Director",
  JOINT_SECRETARY: "Joint Secretary",
};

/**
 * @function getZones
 * @description Retrieves a list of zones based on query parameters.
 * Handles pagination, searching, sorting, and exporting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder, export.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of zones or an error message.
 */
exports.getZones = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "id",
      sortOrder = "asc",
      export: exportData = false,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause for search
    const where = search
      ? {
          name: {
            contains: search,
          },
        }
      : {};

    // Build orderBy object
    const orderBy = {
      [sortBy]: sortOrder.toLowerCase(),
    };

    // Get total count for pagination
    const totalZones = await prisma.zone.count({ where });
    const totalPages = Math.ceil(totalZones / take);

    // Fetch zones with pagination, search, and sorting
    const zones = await prisma.zone.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    if (exportData === "true" || exportData === true) {
      // For export, fetch all zones without pagination
      const allZones = await prisma.zone.findMany({
        where,
        orderBy,
      });

      return res.status(200).json({
        success: true,
        data: allZones,
      });
    }

    res.status(200).json({
      totalZones,
      page: parseInt(page),
      totalPages,
      zones,
    });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res
      .status(500)
      .json({ message: "Error fetching zones", error: error.message });
  }
};

/**
 * @function createZone
 * @description Creates a new zone.
 * @param {object} req - Express request object. Expected body: { name: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created zone or an error message.
 */
exports.createZone = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        message: "Zone name is required and must be a non-empty string.",
      });
    }

    // Check if zone with same name exists
    const existingZone = await prisma.zone.findFirst({
      where: {
        name: name.trim(),
      },
    });

    if (existingZone) {
      return res.status(400).json({
        message: `Zone with name '${name.trim()}' already exists.`,
      });
    }

    // Create new zone
    const newZone = await prisma.zone.create({
      data: {
        name: name.trim(),
      },
    });

    res.status(201).json(newZone);
  } catch (error) {
    console.error("Error creating zone:", error);
    res
      .status(500)
      .json({ message: "Error creating zone", error: error.message });
  }
};

/**
 * @function getZoneById
 * @description Retrieves a single zone by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the zone data or an error message.
 */
exports.getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zoneId = parseInt(id);

    if (isNaN(zoneId)) {
      return res.status(400).json({ message: "Invalid Zone ID provided." });
    }

    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      return res
        .status(404)
        .json({ message: `Zone with ID ${zoneId} not found.` });
    }

    res.status(200).json(zone);
  } catch (error) {
    console.error(`Error fetching zone with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error fetching zone", error: error.message });
  }
};

/**
 * @function updateZone
 * @description Updates an existing zone by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Expected body: { name?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated zone or an error message.
 */
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const zoneId = parseInt(id);

    if (isNaN(zoneId)) {
      return res.status(400).json({ message: "Invalid Zone ID provided." });
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        message: "Zone name must be a non-empty string for update.",
      });
    }

    // Check if another zone exists with the same name
    const existingZone = await prisma.zone.findFirst({
      where: {
        name: name.trim(),
        NOT: {
          id: zoneId,
        },
      },
    });

    if (existingZone) {
      return res.status(400).json({
        message: `Another zone with the name '${name.trim()}' already exists.`,
      });
    }

    const updatedZone = await prisma.zone.update({
      where: { id: zoneId },
      data: { name: name.trim() },
    });

    res.status(200).json(updatedZone);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Zone with ID ${req.params.id} not found.` });
    }
    console.error(`Error updating zone with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error updating zone", error: error.message });
  }
};

/**
 * @function deleteZone
 * @description Deletes a zone by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
exports.deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const zoneId = parseInt(id);

    if (isNaN(zoneId)) {
      return res.status(400).json({ message: "Invalid Zone ID provided." });
    }

    await prisma.zone.delete({
      where: { id: zoneId },
    });

    res.status(200).json({ message: "Zone deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Zone with ID ${req.params.id} not found.` });
    }
    console.error(`Error deleting zone with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error deleting zone", error: error.message });
  }
};

exports.updateZoneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const zoneId = parseInt(id);

    if (isNaN(zoneId)) {
      return res.status(400).json({ message: "Invalid Zone ID provided." });
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        message: "Active status must be a boolean value.",
      });
    }

    const updatedZone = await prisma.zone.update({
      where: { id: zoneId },
      data: { active },
    });

    res.status(200).json(updatedZone);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Zone with ID ${req.params.id} not found.` });
    }
    console.error(
      `Error updating zone status with ID ${req.params.id}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Error updating zone status", error: error.message });
  }
};

/**
 * @function getChaptersByZone
 * @description Fetches all chapters belonging to a specific zone.
 * @param {object} req - Express request object. Expected params: { zoneId: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of chapters or an error message.
 */
exports.getChaptersByZone = async (req, res) => {
  try {
    const { zoneId: zoneIdParam } = req.params;
    const zoneId = parseInt(zoneIdParam);

    if (isNaN(zoneId)) {
      return res.status(400).json({ message: "Invalid Zone ID provided." });
    }

    // Check if the zone exists
    const zoneExists = await prisma.zone.findUnique({
      where: { id: zoneId },
    });

    if (!zoneExists) {
      return res.status(404).json({ message: `Zone with ID ${zoneId} not found.` });
    }

    const chapters = await prisma.chapter.findMany({
      where: {
        zoneId: zoneId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      }
    });

    res.status(200).json({ chapters }); // Ensure the response is { chapters: [...] }

  } catch (error) {
    console.error(`Error fetching chapters for zone ID ${req.params.zoneId}:`, error);
    res
      .status(500)
      .json({ message: "Error fetching chapters for zone", error: error.message });
  }
};

/**
 * @function getZoneRoles
 * @description Retrieves all roles assigned within a specific zone.
 * @param {object} req - Express request object. Expected params: { zoneId: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of zone roles or an error message.
 */
exports.getZoneRoles = asyncHandler(async (req, res) => {
  const { zoneId } = req.params;
  const id = parseInt(zoneId);

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid Zone ID." });
  }

  const zone = await prisma.zone.findUnique({
    where: { id },
    include: {
      zoneRoles: {
        include: {
          member: {
            select: {
              id: true,
              memberName: true,
              organizationName: true,
              profilePicture1: true,
            },
          },
        },
        orderBy: {
          roleType: 'asc'
        }
      },
    },
  });

  if (!zone) {
    return res.status(404).json({ message: "Zone not found." });
  }

  // Simplify the roles structure if needed or send as is
  const roles = zone.zoneRoles.map(role => ({
    assignmentId: role.id,
    roleType: role.roleType,
    memberId: role.memberId,
    memberName: role.member.memberName,
    organizationName: role.member.organizationName,
    profilePicture1: role.member.profilePicture1,
    assignedAt: role.assignedAt
  }));

  res.status(200).json({
    success: true,
    zoneId: id,
    zoneName: zone.name,
    roles,
  });
});

/**
 * @function assignZoneRole
 * @description Assigns a role to a member within a specific zone.
 * @param {object} req - Express request object. Params: { zoneId }. Body: { memberId, roleType }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the new role assignment or an error message.
 */
exports.assignZoneRole = asyncHandler(async (req, res) => {
  const { zoneId } = req.params;
  const { memberId, roleType } = req.body;
  const performingUserId = req.user ? req.user.id : null; // Assuming req.user is populated by auth middleware
  const performingUserName = req.user ? req.user.name : "System";

  const zId = parseInt(zoneId);
  const mId = parseInt(memberId);

  if (isNaN(zId)) {
    return res.status(400).json({ message: "Invalid Zone ID." });
  }
  if (isNaN(mId)) {
    return res.status(400).json({ message: "Invalid Member ID." });
  }

  if (!roleType || !Object.values(ZONE_ROLE_TYPES).includes(roleType)) {
    return res.status(400).json({ message: "Invalid or missing role type." });
  }

  // Check if zone exists
  const zone = await prisma.zone.findUnique({ where: { id: zId } });
  if (!zone) {
    return res.status(404).json({ message: "Zone not found." });
  }

  // Check if member exists
  const member = await prisma.member.findUnique({ where: { id: mId } });
  if (!member) {
    return res.status(404).json({ message: "Member not found." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if role already assigned to someone else in this zone (unique constraint handled by DB but good to check)
      const existingRoleForType = await tx.zoneRole.findUnique({
        where: {
          zoneId_roleType: {
            zoneId: zId,
            roleType: roleType,
          },
        },
      });

      if (existingRoleForType && existingRoleForType.memberId !== mId) {
        // Role type exists and is assigned to a different member
        res.status(409).json({ message: `Role '${roleType}' is already assigned to another member in this zone.` });
        throw new Error("RoleConflict"); // Throw to rollback transaction
      }
      if (existingRoleForType && existingRoleForType.memberId === mId) {
        // Role type exists and is assigned to the same member - idempotent or update assignedAt?
        // For now, let's consider it a success and return existing assignment.
        // Or, update assignedAt if that's desired behavior.
        // To prevent history duplication, we only proceed if it's a truly new assignment.
        return res.status(200).json({
          message: "Role already assigned to this member in this zone.",
          data: existingRoleForType,
        });
      }

      // Create the new zone role assignment
      const newZoneRole = await tx.zoneRole.create({
        data: {
          memberId: mId,
          zoneId: zId,
          roleType: roleType,
        },
      });

      // Create history record
      await tx.zoneRoleHistory.create({
        data: {
          roleId: newZoneRole.id,
          memberId: mId,
          zoneId: zId,
          roleType: roleType,
          action: "assigned",
          performedById: performingUserId,
          performedByName: performingUserName,
          startDate: newZoneRole.assignedAt, // or new Date()
        },
      });

      return newZoneRole;
    });

    // If res was already sent (e.g. for existingRoleForType.memberId === mId), don't send again.
    if (!res.headersSent) {
        res.status(201).json({
            message: "Role assigned successfully.",
            data: result,
        });
    }

  } catch (error) {
    if (error.message === "RoleConflict"  && res.headersSent) {
      // Error already handled and response sent, do nothing further.
      return;
    }
    if (error.code === 'P2002' && error.meta && error.meta.target && error.meta.target.includes('zoneId_roleType')) {
        // Unique constraint violation from the database
        return res.status(409).json({ message: `Role '${roleType}' is already assigned in this zone.` });
    }
    console.error("Error assigning zone role:", error);
    if (!res.headersSent) {
        res.status(500).json({ message: "Error assigning zone role", error: error.message });
    }
  }
});

/**
 * @function removeZoneRole
 * @description Removes a role assignment from a zone by its assignment ID.
 * @param {object} req - Express request object. Params: { assignmentId }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response or an error message.
 */
exports.removeZoneRole = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const assignId = parseInt(assignmentId);
  const performingUserId = req.user ? req.user.id : null;
  const performingUserName = req.user ? req.user.name : "System";

  if (isNaN(assignId)) {
    return res.status(400).json({ message: "Invalid Assignment ID." });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if the role assignment exists
      const zoneRoleAssignment = await tx.zoneRole.findUnique({
        where: { id: assignId },
      });

      if (!zoneRoleAssignment) {
        res.status(404).json({ message: "Zone role assignment not found." });
        throw new Error("AssignmentNotFound"); // Rollback
      }

      // Find the active history record for this assignment and update its endDate
      const activeHistoryRecord = await tx.zoneRoleHistory.findFirst({
        where: {
          roleId: zoneRoleAssignment.id,
          endDate: null, // Only active assignments
          action: "assigned"
        },
        orderBy: {
          startDate: 'desc' // Get the latest one if multiple somehow exist (should not happen for 'assigned' with null endDate)
        }
      });

      if (activeHistoryRecord) {
        await tx.zoneRoleHistory.update({
          where: { id: activeHistoryRecord.id },
          data: {
            endDate: new Date(),
            // Optionally, you could also update performedById/Name for who *ended* the role.
            // For now, assuming original assigner is fine or this action is implicit.
          },
        });
      } else {
        // This case should ideally not happen if every assignment creates a history record.
        // Log this anomaly or handle as an error.
        console.warn(`No active history record found for zone role assignment ID: ${assignId} during removal.`);
        // For robustness, we can still create a 'removed' log here if needed, but it will be short-lived due to cascade.
        // Let's create one that captures the removal action itself.
        // This specific record will be deleted by cascade when ZoneRole is deleted.
        // This is more of an immediate action log than a persistent historical record of the role itself after deletion.
        await tx.zoneRoleHistory.create({
            data: {
                roleId: zoneRoleAssignment.id, // This will link to the role being deleted
                memberId: zoneRoleAssignment.memberId,
                zoneId: zoneRoleAssignment.zoneId,
                roleType: zoneRoleAssignment.roleType,
                action: "removed_direct_action", // Differentiating from 'assigned' record being 'ended'
                performedById: performingUserId,
                performedByName: performingUserName,
                startDate: new Date(), 
                endDate: new Date() // Point-in-time event
            }
        });
      }

      // Delete the role assignment
      await tx.zoneRole.delete({
        where: { id: assignId },
      });

      return zoneRoleAssignment; // Return details of what was deleted
    });
    
    // If res was already sent (e.g. for AssignmentNotFound), don't send again.
    if (!res.headersSent) {
        res.status(200).json({
            message: "Zone role removed successfully.",
            data: { id: result.id, roleType: result.roleType, memberId: result.memberId, zoneId: result.zoneId }
        });
    }

  } catch (error) {
    if (error.message === "AssignmentNotFound" && res.headersSent) {
        return; // Error already handled
    }
    console.error("Error removing zone role:", error);
    if (!res.headersSent) {
        res.status(500).json({ message: "Error removing zone role", error: error.message });
    }
  }
});
