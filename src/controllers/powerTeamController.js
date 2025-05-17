/**
 * Controller for handling PowerTeam-related operations.
 *
 * @module controllers/powerTeamController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

/**
 * @function getPowerTeams
 * @description Retrieves a list of power teams based on query parameters.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the list of power teams or an error message.
 */
const getPowerTeams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "name";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const whereClause = {
      OR: [{ name: { contains: search } }],
    };

    const powerTeams = await prisma.powerTeam.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { 
        categories: true, 
        subCategories: true 
      },
    });

    const totalPowerTeams = await prisma.powerTeam.count({
      where: whereClause,
    });
    const totalPages = Math.ceil(totalPowerTeams / limit);

    res.json({
      powerTeams,
      page,
      totalPages,
      totalPowerTeams,
    });
  } catch (error) {
    console.error("ERROR_FETCHING_POWERTEAMS_DETAILS:", error);
    console.error("Prisma error cause (if any):", error.cause);
    next(createError(500, "Failed to fetch power teams", { cause: error }));
  }
};

/**
 * @function createPowerTeam
 * @description Creates a new power team.
 * @param {object} req - Express request object. Expected body: { name: string, categoryIds: number[], subCategoryIds: number[] }.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the created power team or an error message.
 */
const createPowerTeam = async (req, res, next) => {
  const schema = z.object({
    name: z.string().min(1, "PowerTeam name cannot be empty").max(255),
    categoryIds: z.array(z.number().int().positive("Invalid Category ID")).min(1, "At least one main category must be selected"),
    subCategoryIds: z.array(z.number().int().positive("Invalid SubCategory ID")).optional(),
  }).superRefine(async (data, ctx) => {
    const existingPowerTeam = await prisma.powerTeam.findUnique({
      where: { name: data.name },
    });
    if (existingPowerTeam) {
      ctx.addIssue({
        path: ["name"],
        message: `PowerTeam with name "${data.name}" already exists.`,
      });
    }

    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoriesExist = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true }
      });
      if (categoriesExist.length !== data.categoryIds.length) {
        const foundIds = categoriesExist.map(c => c.id);
        const notFoundIds = data.categoryIds.filter(id => !foundIds.includes(id));
        ctx.addIssue({
          path: ["categoryIds"],
          message: `Invalid main Category IDs: ${notFoundIds.join(', ')}. Please ensure all main categories exist.`,
        });
        return; // Stop further validation if main categories are invalid
      }
    }

    if (data.subCategoryIds && data.subCategoryIds.length > 0) {
      if (!data.categoryIds || data.categoryIds.length === 0) {
        ctx.addIssue({
          path: ["subCategoryIds"],
          message: "Subcategories cannot be selected without selecting their parent main categories first."
        });
        return;
      }

      const subCategoriesExist = await prisma.subCategory.findMany({
        where: {
          id: { in: data.subCategoryIds },
          categoryId: { in: data.categoryIds } // Ensure subcategories belong to selected main categories
        },
        select: { id: true, categoryId: true }
      });

      if (subCategoriesExist.length !== data.subCategoryIds.length) {
        const foundSubIds = subCategoriesExist.map(sc => sc.id);
        const notFoundSubIds = data.subCategoryIds.filter(id => !foundSubIds.includes(id));
        ctx.addIssue({
          path: ["subCategoryIds"],
          message: `Invalid SubCategory IDs: ${notFoundSubIds.join(', ')}. They may not exist or do not belong to the selected main categories.`,
        });
      }
    }
  });

  const validationResult = await validateRequest(schema, req.body, res);
  if (!validationResult) return;

  const { name, categoryIds, subCategoryIds } = req.body;

  try {
    const newPowerTeam = await prisma.powerTeam.create({
      data: {
        name,
        categories: {
          connect: categoryIds.map((id) => ({ id })),
        },
        ...(subCategoryIds && subCategoryIds.length > 0 && {
          subCategories: {
            connect: subCategoryIds.map((id) => ({ id })),
          }
        }),
      },
      include: { categories: true, subCategories: true }, 
    });
    res.status(201).json(newPowerTeam);
  } catch (error) {
     if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return res.status(400).json({
        errors: { message: `PowerTeam with name "${name}" already exists` }
      });
    } 
    next(createError(500, "Failed to create power team", { cause: error }));
  }
};

/**
 * @function getPowerTeamById
 * @description Retrieves a single power team by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the power team data or an error message.
 */
const getPowerTeamById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return next(createError(400, "Invalid PowerTeam ID"));
    }

    const powerTeam = await prisma.powerTeam.findUnique({
      where: { id },
      include: { 
        categories: true, 
        subCategories: true 
      }, 
    });

    if (!powerTeam) {
      return next(createError(404, "PowerTeam not found"));
    }
    res.json(powerTeam);
  } catch (error) {
    next(createError(500, "Failed to fetch power team", { cause: error }));
  }
};

/**
 * @function updatePowerTeam
 * @description Updates an existing power team by its ID.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response with the updated power team or an error message.
 */
const updatePowerTeam = async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ errors: { message: "Invalid PowerTeam ID" } });
  }

  const schema = z.object({
    name: z.string().min(1, "PowerTeam name cannot be empty").max(255).optional(),
    categoryIds: z.array(z.number().int().positive("Invalid Category ID")).min(1, "At least one main category must be selected").optional(),
    subCategoryIds: z.array(z.number().int().positive("Invalid SubCategory ID")).optional(),
  }).superRefine(async (data, ctx) => {
    if (data.name) {
      const existingPowerTeam = await prisma.powerTeam.findFirst({
        where: {
          name: data.name,
          NOT: { id: id },
        },
      });
      if (existingPowerTeam) {
        ctx.addIssue({
          path: ["name"],
          message: `PowerTeam with name "${data.name}" already exists.`,
        });
      }
    }

    let effectiveCategoryIds = [];
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoriesExist = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true }
      });
      if (categoriesExist.length !== data.categoryIds.length) {
        const foundIds = categoriesExist.map(c => c.id);
        const notFoundIds = data.categoryIds.filter(id => !foundIds.includes(id));
        ctx.addIssue({
          path: ["categoryIds"],
          message: `Invalid main Category IDs: ${notFoundIds.join(', ')}. Please ensure all main categories exist.`,
        });
        return; // Stop further validation if main categories are invalid
      }
      effectiveCategoryIds = data.categoryIds;
    } else {
      // If categoryIds are not being updated, use existing ones for subCategory validation
      const currentPowerTeam = await prisma.powerTeam.findUnique({
        where: { id },
        select: { categories: { select: { id: true } } }
      });
      if (currentPowerTeam && currentPowerTeam.categories) {
        effectiveCategoryIds = currentPowerTeam.categories.map(c => c.id);
      }
    }
    
    // If categoryIds is explicitly an empty array, it means we want to remove all main categories.
    // In this case, subCategoryIds must also be empty or not provided.
    if (data.categoryIds && data.categoryIds.length === 0 && data.subCategoryIds && data.subCategoryIds.length > 0) {
      ctx.addIssue({
        path: ["subCategoryIds"],
        message: "Cannot assign subcategories if all main categories are being removed. Please remove subcategories as well.",
      });
      return;
    }

    if (data.subCategoryIds && data.subCategoryIds.length > 0) {
      if (effectiveCategoryIds.length === 0) {
         ctx.addIssue({
          path: ["subCategoryIds"],
          message: "Subcategories cannot be selected without parent main categories."
        });
        return;
      }

      const subCategoriesExist = await prisma.subCategory.findMany({
        where: {
          id: { in: data.subCategoryIds },
          categoryId: { in: effectiveCategoryIds } 
        },
        select: { id: true, categoryId: true }
      });

      if (subCategoriesExist.length !== data.subCategoryIds.length) {
        const foundSubIds = subCategoriesExist.map(sc => sc.id);
        const notFoundSubIds = data.subCategoryIds.filter(id => !foundSubIds.includes(id));
        ctx.addIssue({
          path: ["subCategoryIds"],
          message: `Invalid SubCategory IDs: ${notFoundSubIds.join(', ')}. They may not exist or do not belong to the relevant main categories.`,
        });
      }
    }
  });

  const validationResult = await validateRequest(schema, req.body, res);
  if (!validationResult) return;

  const { name, categoryIds, subCategoryIds } = req.body;
  const dataToUpdate = {};

  if (name) dataToUpdate.name = name;
  if (categoryIds) {
    dataToUpdate.categories = {
      set: categoryIds.map((catId) => ({ id: catId })),
    };
  }
  if (subCategoryIds) {
    dataToUpdate.subCategories = {
      set: subCategoryIds.map((subCatId) => ({ id: subCatId })),
    };
  }

  try {
    const updatedPowerTeam = await prisma.powerTeam.update({
      where: { id },
      data: dataToUpdate,
      include: { categories: true, subCategories: true }, 
    });
    res.json(updatedPowerTeam);
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return res.status(400).json({
        errors: { message: `PowerTeam with name "${name}" already exists` }
      });
    } 
    next(createError(500, "Failed to update power team", { cause: error }));
  }
};

/**
 * @function deletePowerTeam
 * @description Deletes a power team by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 * @returns {Promise<void>} Sends a JSON response confirming deletion or an error message.
 */
const deletePowerTeam = async (req, res, next) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return next(createError(400, "Invalid PowerTeam ID"));
  }

  try {
    const powerTeam = await prisma.powerTeam.findUnique({ where: { id } });
    if (!powerTeam) {
        return next(createError(404, "PowerTeam not found"));
    }

    await prisma.powerTeam.delete({ where: { id } });
    res.status(200).json({ message: "PowerTeam deleted successfully" });
  } catch (error) {
    next(createError(500, "Failed to delete power team", { cause: error }));
  }
};

module.exports = {
  getPowerTeams,
  createPowerTeam,
  getPowerTeamById,
  updatePowerTeam,
  deletePowerTeam,
};
