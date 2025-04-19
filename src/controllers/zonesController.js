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
