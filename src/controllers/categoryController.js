/**
 * Controller for handling Category-related operations.
 *
 * Provides functions to manage categories, including retrieving, creating,
 * updating, and deleting categories based on requests routed from categoryRoutes.js.
 *
 * @module controllers/categoryController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @function getCategories
 * @description Retrieves a list of categories based on query parameters.
 * Handles pagination, searching, sorting, and exporting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder, export.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of categories or an error message.
 */
exports.getCategories = async (req, res) => {
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
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {};

    // Build orderBy object
    const orderBy = { [sortBy]: sortOrder.toLowerCase() };

    // Get total count for pagination
    const totalCategories = await prisma.category.count({ where });
    const totalPages = Math.ceil(totalCategories / take);

    // Export all data if requested
    if (exportData === "true" || exportData === true) {
      const allCategories = await prisma.category.findMany({ where, orderBy });
      return res.status(200).json({ success: true, data: allCategories });
    }

    // Fetch paginated data
    const categories = await prisma.category.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    res.status(200).json({
      totalCategories,
      page: parseInt(page),
      totalPages,
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .json({ message: "Error fetching categories", error: error.message });
  }
};

/**
 * @function createCategory
 * @description Creates a new category.
 * @param {object} req - Express request object. Expected body: { name: string, description: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created category or an error message.
 */
exports.createCategory = async (req, res) => {
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
        message:
          "Name and description are required and must be non-empty strings.",
      });
    }

    // Check if category with same name exists
    const existing = await prisma.category.findFirst({
      where: { name: name.trim() },
    });
    if (existing) {
      return res.status(400).json({
        message: `Category with name '${name.trim()}' already exists.`,
      });
    }

    // Create category
    const newCategory = await prisma.category.create({
      data: { name: name.trim(), description: description.trim() },
    });

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res
      .status(500)
      .json({ message: "Error creating category", error: error.message });
  }
};

/**
 * @function getCategoryById
 * @description Retrieves a single category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the category data or an error message.
 */
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid Category ID provided." });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return res
        .status(404)
        .json({ message: `Category with ID ${categoryId} not found.` });
    }

    res.status(200).json(category);
  } catch (error) {
    console.error(`Error fetching category with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error fetching category", error: error.message });
  }
};

/**
 * @function updateCategory
 * @description Updates an existing category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Body: { name?: string, description?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated category or an error message.
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid Category ID provided." });
    }

    const updateData = {};
    if (name) {
      if (typeof name !== "string" || name.trim() === "") {
        return res
          .status(400)
          .json({ message: "Name must be a non-empty string." });
      }
      // Check uniqueness
      const duplicate = await prisma.category.findFirst({
        where: { name: name.trim(), NOT: { id: categoryId } },
      });
      if (duplicate) {
        return res.status(400).json({
          message: `Another category with name '${name.trim()}' already exists.`,
        });
      }
      updateData.name = name.trim();
    }
    if (description) {
      if (typeof description !== "string" || description.trim() === "") {
        return res
          .status(400)
          .json({ message: "Description must be a non-empty string." });
      }
      updateData.description = description.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid data provided for update." });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });
    res.status(200).json(updated);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Category with ID ${req.params.id} not found.` });
    }
    console.error(`Error updating category with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error updating category", error: error.message });
  }
};

/**
 * @function deleteCategory
 * @description Deletes a category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid Category ID provided." });
    }

    await prisma.category.delete({ where: { id: categoryId } });
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: `Category with ID ${req.params.id} not found.` });
    }
    console.error(`Error deleting category with ID ${req.params.id}:`, error);
    res
      .status(500)
      .json({ message: "Error deleting category", error: error.message });
  }
};
