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
    const { name, description } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      name.trim() === "" ||
      !description ||
      typeof description !== "string" ||
      description.trim() === ""
    ) {
      return res.status(400).json({
        message: "Location name is required and must be a non-empty string.",
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

          // Check for dependent entities
          
      
          const chaptersCount = await prisma.chapter.count({
            where: { zoneId: zoneId },
          });
      
    
  
      let dependencies = [];
       
      if (chaptersCount > 0) {
        dependencies.push(`${chaptersCount} chapter(s)`);
      }
 
      if (dependencies.length > 0) {
        return res.status(400).json({
          message: `Cannot delete Location ID ${zoneId}. It is still referenced by ${dependencies.join(", ")}. Please remove or reassign these dependencies first.`,
        });
      }
    await prisma.location.delete({
      where: { id: zoneId },
    });

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Location with ID ${req.params.id} not found.` });
    }
    console.error(`Error deleting location with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error deleting location", error: error.message });
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
 * @function getLocations
 * @description Retrieves a list of locations based on query parameters.
 * Handles pagination, searching, sorting, and exporting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder, export.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of locations or an error message.
 */
exports.getLocations = async (req, res) => {
  try {
    // Parse and validate pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "id";
    const sortOrder = (req.query.sortOrder || "asc").toLowerCase();
    const exportData = req.query.export === "true" || req.query.export === true;

    const skip = (page - 1) * limit;
    const take = limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
              },
            },
            {
              description: {
                name: {
                  contains: search,
                },
              },
            },
          ],
        }
      : {};

    // Build orderBy object
    const orderBy = {
      [sortBy]: sortOrder,
    };

    // Get total count for pagination
    const totalLocations = await prisma.location.count({ where });
    const totalPages = Math.ceil(totalLocations / take);

    // For export, fetch all locations without pagination
    if (exportData) {
      const allLocations = await prisma.location.findMany({
        where,
        include: {
          zone: true,
        },
        orderBy,
      });

      return res.status(200).json({
        success: true,
        data: allLocations,
      });
    }

    // Fetch locations with pagination, search, and sorting
    const locations = await prisma.location.findMany({
      where,
      include: {
        zone: true,
      },
      orderBy,
      skip,
      take,
    });

    res.status(200).json({
      totalLocations,
      page,
      totalPages,
      locations,
    });
  } catch (error) {
    console.error("Error fetching locations:", error);
    res
      .status(500)
      .json({ message: "Error fetching locations", error: error.message });
  }
};

/**
 * @function createLocation
 * @description Creates a new location.
 * @param {object} req - Express request object. Expected body: { zoneId: number, location: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created location or an error message.
 */
exports.createLocation = async (req, res) => {
  try {
    const { zoneId, location } = req.body;

    if (
      !zoneId ||
      !location ||
      typeof location !== "string" ||
      location.trim() === ""
    ) {
      return res.status(400).json({
        message:
          "Zone ID and location are required and location must be a non-empty string.",
      });
    }

    // Check if zone exists
    const existingZone = await prisma.zone.findUnique({
      where: {
        id: zoneId,
      },
    });

    if (!existingZone) {
      return res.status(400).json({
        message: `Zone with ID ${zoneId} does not exist.`,
      });
    }

    // Create new location
    const newLocation = await prisma.location.create({
      data: {
        zoneId,
        location: location.trim(),
      },
    });

    res.status(201).json(newLocation);
  } catch (error) {
    console.error("Error creating location:", error);
    res
      .status(500)
      .json({ message: "Error creating location", error: error.message });
  }
};

/**
 * @function getLocationById
 * @description Retrieves a single location by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the location data or an error message.
 */
exports.getLocationById = async (req, res) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return res.status(400).json({ message: "Invalid Location ID provided." });
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        zone: true,
      },
    });

    if (!location) {
      return res
        .status(404)
        .json({ message: `Location with ID ${locationId} not found.` });
    }

    res.status(200).json(location);
  } catch (error) {
    console.error(`Error fetching location with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error fetching location", error: error.message });
  }
};

/**
 * @function updateLocation
 * @description Updates an existing location by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Expected body: { zoneId?: number, location?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated location or an error message.
 */
exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { zoneId, location } = req.body;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return res.status(400).json({ message: "Invalid Location ID provided." });
    }

    const updateData = {};

    if (zoneId) {
      // Check if zone exists
      const existingZone = await prisma.zone.findUnique({
        where: {
          id: zoneId,
        },
      });

      if (!existingZone) {
        return res.status(400).json({
          message: `Zone with ID ${zoneId} does not exist.`,
        });
      }

      updateData.zoneId = zoneId;
    }

    if (location && (typeof location !== "string" || location.trim() === "")) {
      return res.status(400).json({
        message: "Location must be a non-empty string for update.",
      });
    }

    if (location) {
      updateData.location = location.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid data provided for update.",
      });
    }

    const updatedLocation = await prisma.location.update({
      where: { id: locationId },
      data: updateData,
    });

    res.status(200).json(updatedLocation);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Location with ID ${req.params.id} not found.` });
    }
    console.error(`Error updating location with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error updating location", error: error.message });
  }
};

/**
 * @function deleteLocation
 * @description Deletes a location by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
exports.deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id);

    if (isNaN(locationId)) {
      return res.status(400).json({ message: "Invalid Location ID provided." });
    }

    // Check for dependent entities (Chapters)
    const chaptersCount = await prisma.chapter.count({
      where: { locationId: locationId },
    });

    if (chaptersCount > 0) {
      return res.status(400).json({
        message: `Cannot delete Location ID ${locationId}. It is still referenced by ${chaptersCount} chapter(s). Please remove or reassign these chapters first.`,
      });
    }

    // Proceed with deletion if no dependencies
    await prisma.location.delete({
      where: { id: locationId },
    });

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      // Record to delete not found
      return res
        .status(404)
        .json({ message: `Location with ID ${req.params.id} not found.` });
    } else if (error.code === "P2003") {
      // Foreign key constraint violation
      console.error(
        `Foreign key constraint error deleting location ID ${req.params.id}:`,
        error
      );
      return res.status(409).json({
        message: `Cannot delete Location ID ${req.params.id} due to existing relationships. Please ensure all associated entities (like Chapters) are removed or reassigned.`,
        details: process.env.NODE_ENV === 'development' ? error.message : 'A database constraint prevented deletion.',
      });
    }
    console.error(`Error deleting location with ID ${req.params.id}:`, error);
    return res.status(500).json({ message: "Error deleting location.", error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.' });
  }
};
