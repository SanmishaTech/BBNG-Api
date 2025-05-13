/**
 * Controller for handling SubCategory-related operations.
 *
 * Provides functions to manage subcategories, including retrieving, creating,
 * updating, and deleting subcategories based on requests routed from subCategoryRoutes.js.
 *
 * @module controllers/subCategoryController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const createError = require("http-errors");

/**
 * @function getSubCategories
 * @description Retrieves a list of subcategories.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of subcategories or an error message.
 */
const getSubCategories = async (req, res, next) => {
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
       ]
    };
    
    const categories = await prisma.subCategory.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    });
    
    const totalCategories = await prisma.subCategory.count({
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
 * @function getSubCategoryById
 * @description Retrieves a single subcategory by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the subcategory data or an error message.
 */
const getSubCategoryById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid subcategory ID" }
      });
    }
    
    const subCategory = await prisma.subCategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!subCategory) {
      return res.status(404).json({
        errors: { message: "Subcategory not found" }
      });
    }
    
    res.json(subCategory);
  } catch (error) {
    next(createError(500, "Failed to fetch subcategory", { cause: error }));
  }
};

/**
 * @function createSubCategory
 * @description Creates a new subcategory.
 * @param {object} req - Express request object. Expected body: { name: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created subcategory or an error message.
 */
const createSubCategory = async (req, res, next) => {
  // Define Zod schema for category creation
  const schema = z.object({
    name: z.string()
      .min(1, "Category name cannot be empty")
      .max(255, "Category name must not exceed 255 characters"),
    categoryId: z.number().int().positive().optional()
  }).superRefine(async (data, ctx) => {
     const existingCategory = await prisma.subCategory.findFirst({
      where: { name: data.name }
    });

    if (existingCategory) {
      ctx.addIssue({
        path: ["name"],
        message: `Sub-Category with name ${data.name} already exists.`,
      });
    }
  });

  // Validate the request body using Z
  try {
    const newCategory = await prisma.subCategory.create({
      data: {
        name: req.body.name,
        categoryId: req.body.categoryId
      }
    });
    
    res.status(201).json(newCategory);
  } catch (error) {
    // Handle specific error types
    if (error.code === 'P2002') {
      return res.status(400).json({
        errors: { message: "A sub-category with this name already exists" }
      });
    }
    
    next(createError(500, "Failed to create sub-category", { cause: error }));
  }
};

/**
 * @function updateSubCategory
 * @description Updates an existing subcategory by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Body: { name?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated subcategory or an error message.
 */
const updateSubCategory = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid subcategory ID" }
      });
    }
    
    const schema = z.object({
      name: z.string()
        .min(1, "Name cannot be empty")
        .max(255, "Name must not exceed 255 characters")
        .optional(),
      categoryId: z.number().int().positive().optional()
    });
    
    const validatedData = schema.parse(req.body);
    
    const updatedSubCategory = await prisma.subCategory.update({
      where: { id },
      data: validatedData
    });
    
    res.json(updatedSubCategory);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        errors: error.errors
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        errors: { message: "Subcategory not found" }
      });
    }
    next(createError(500, "Failed to update subcategory", { cause: error }));
  }
};

/**
 * @function deleteSubCategory
 * @description Deletes a subcategory by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
const deleteSubCategory = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid subcategory ID" }
      });
    }
    
    await prisma.subCategory.delete({ where: { id } });
    
    res.json({ message: "Subcategory deleted successfully" });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        errors: { message: "Subcategory not found" }
      });
    }
    next(createError(500, "Failed to delete subcategory", { cause: error }));
  }
};

module.exports = {
  getSubCategories,
  getSubCategoryById,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory
};
