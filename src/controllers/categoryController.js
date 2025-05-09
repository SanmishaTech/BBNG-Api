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
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

/**
 * @function getCategories
 * @description Retrieves a list of categories based on query parameters.
 * Handles pagination, searching, sorting, and exporting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder, export.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of categories or an error message.
 */
const getCategories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "name";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    
    // Build the where clause for filtering
    const whereClause = {
      OR: [
        { name: { contains: search } },
        { description: { contains: search } }
      ]
    };
    
    const categories = await prisma.category.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    });
    
    const totalCategories = await prisma.category.count({
      where: whereClause
    });
    const totalPages = Math.ceil(totalCategories / limit);
    
    res.json({
      categories,
      page,
      totalPages,
      totalCategories
    });
  } catch (error) {
    next(createError(500, "Failed to fetch categories", { cause: error }));
  }
};

/**
 * @function createCategory
 * @description Creates a new category.
 * @param {object} req - Express request object. Expected body: { name: string, description: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created category or an error message.
 */
const createCategory = async (req, res, next) => {
  // Define Zod schema for category creation
  const schema = z.object({
    name: z.string()
      .min(1, "Category name cannot be empty")
      .max(255, "Category name must not exceed 255 characters"),
    description: z.string()
      .min(1, "Description cannot be empty")
      .max(1000, "Description must not exceed 1000 characters")
  }).superRefine(async (data, ctx) => {
    // Check if a category with the same name already exists
    const existingCategory = await prisma.category.findFirst({
      where: { name: data.name }
    });

    if (existingCategory) {
      ctx.addIssue({
        path: ["name"],
        message: `Category with name ${data.name} already exists.`,
      });
    }
  });

  // Validate the request body using Zod
  console.log('Create Category - Request received:', req.body);
  const validationResult = await validateRequest(schema, req.body, res);
  console.log('Create Category - Validation result:', validationResult);
  
  // If validation failed, response is already sent by validateRequest
  if (!validationResult) return;

  try {
    const newCategory = await prisma.category.create({
      data: {
        name: req.body.name,
        description: req.body.description
      }
    });
    
    res.status(201).json(newCategory);
  } catch (error) {
    // Handle specific error types
    if (error.code === 'P2002') {
      return res.status(400).json({
        errors: { message: "A category with this name already exists" }
      });
    }
    
    next(createError(500, "Failed to create category", { cause: error }));
  }
};

/**
 * @function getCategoryById
 * @description Retrieves a single category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the category data or an error message.
 */
const getCategoryById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid category ID" }
      });
    }
    
    const category = await prisma.category.findUnique({ where: { id } });
    
    if (!category) {
      return res.status(404).json({
        errors: { message: "Category not found" }
      });
    }
    
    res.json(category);
  } catch (error) {
    next(createError(500, "Failed to fetch category", { cause: error }));
  }
};

/**
 * @function updateCategory
 * @description Updates an existing category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Body: { name?: string, description?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated category or an error message.
 */
const updateCategory = async (req, res, next) => {
  const id = Number(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      errors: { message: "Invalid category ID" }
    });
  }
  
  // Define Zod schema for category update
  const schema = z.object({
    name: z.string()
      .min(1, "Category name cannot be empty")
      .max(255, "Category name must not exceed 255 characters")
      .optional(),
    description: z.string()
      .min(1, "Description cannot be empty")
      .max(1000, "Description must not exceed 1000 characters")
      .optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  }).superRefine(async (data, ctx) => {
    if (data.name) {
      // Check if another category with the same name already exists
      const existingCategory = await prisma.category.findFirst({
        where: { 
          name: data.name,
          id: { not: id }
        }
      });

      if (existingCategory) {
        ctx.addIssue({
          path: ["name"],
          message: `Category with name ${data.name} already exists.`,
        });
      }
    }
  });

  // Validate the request body using Zod
  console.log('Update Category - Request received:', req.body);
  const validationResult = await validateRequest(schema, req.body, res);
  console.log('Update Category - Validation result:', validationResult);
  
  // If validation failed, response is already sent by validateRequest
  if (!validationResult) return;

  try {
    // First check if the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });
    
    if (!existingCategory) {
      return res.status(404).json({
        errors: { message: "Category not found" }
      });
    }
    
    const data = {};
    
    if (req.body.name) {
      data.name = req.body.name;
    }
    
    if (req.body.description) {
      data.description = req.body.description;
    }
    
    const updatedCategory = await prisma.category.update({
      where: { id },
      data
    });
    
    res.json(updatedCategory);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Category not found" }
      });
    }
    
    next(createError(500, "Failed to update category", { cause: error }));
  }
};

/**
 * @function deleteCategory
 * @description Deletes a category by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
const deleteCategory = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid category ID" }
      });
    }
    
    // First check if the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id }
    });
    
    if (!existingCategory) {
      return res.status(404).json({
        errors: { message: "Category not found" }
      });
    }
    
    await prisma.category.delete({ where: { id } });
    
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Category not found" }
      });
    }
    
    next(createError(500, "Failed to delete category", { cause: error }));
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
