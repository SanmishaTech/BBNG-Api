const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 * Converts Prisma validation errors and known request errors into structured 400 responses.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Zod or manual user errors forwarded by validateRequest
    if (err.status === 400 && err.expose) {
      return res
        .status(400)
        .json({ errors: err.errors || { message: err.message } });
    }
    // Prisma validation errors
    if (err.name === "PrismaClientValidationError") {
      return res.status(400).json({ errors: { message: err.message } });
    }
    // Prisma known request errors (e.g., unique constraint)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002" && err.meta?.target) {
        const field = Array.isArray(err.meta.target)
          ? err.meta.target[0]
          : err.meta.target;
        const message = `A record with that ${field} already exists.`;
        return res
          .status(400)
          .json({ errors: { [field]: { type: "unique", message } } });
      }
    }
    // Fallback for unexpected errors
    console.error(err);
    return res
      .status(500)
      .json({ errors: { message: "Internal Server Error" } });
  });
};

/** GET /api/packages
 * List packages (pagination, filters, sort)
 */
const getPackages = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", isVenueFee, active } = req.query;
  const parsedIsVenueFee = isVenueFee != null ? isVenueFee === "true" : undefined;
  const parsedActive = active != null ? active === "true" : undefined;
  const sortBy = req.query.sortBy || "packageName";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const filters = [];
  if (search) {
    filters.push({
      packageName: {
        contains: search,
      },
    });
  }
  if (parsedIsVenueFee !== undefined) filters.push({ isVenueFee: parsedIsVenueFee });
  if (parsedActive !== undefined) filters.push({ active: parsedActive });
  
  const where = filters.length ? { AND: filters } : {};

  const [packages, total] = await Promise.all([
    prisma.package.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { chapter: true },
    }),
    prisma.package.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    packages,
    page,
    totalPages,
    totalPackages: total,
  });
});

/** POST /api/packages
 * Create a new package
 */
const createPackage = asyncHandler(async (req, res) => {
  const schema = z
    .object({
      packageName: z.string().min(1, "Package name is required").max(255),
      periodMonths: z.number().int().min(1, "Period must be at least 1 month"),
      isVenueFee: z.boolean().default(false),
      chapterId: z.number().int().nullable().optional(),
      basicFees: z.number().positive("Basic fees must be positive"),
      gstRate: z.number().min(0, "GST rate cannot be negative"),
      active: z.boolean().optional(),
    })
    .superRefine(async (data, ctx) => {
      // If isVenueFee is true, chapterId is required
      if (data.isVenueFee === true && !data.chapterId) {
        ctx.addIssue({
          path: ["chapterId"],
          message: "Chapter ID is required for venue fee packages",
          code: z.ZodIssueCode.custom,
        });
        return;
      }

      // If chapterId is provided, check if it exists
      if (data.chapterId) {
        const chapterExists = await prisma.chapter.findUnique({
          where: { id: data.chapterId },
        });
        if (!chapterExists) {
          ctx.addIssue({
            path: ["chapterId"],
            message: "Chapter not found",
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Calculate GST amount and total fees
  const basicFees = parseFloat(req.body.basicFees);
  const gstRate = parseFloat(req.body.gstRate);
  const gstAmount = (basicFees * gstRate) / 100;
  const totalFees = basicFees + gstAmount;

  const packageData = {
    ...req.body,
    gstAmount,
    totalFees,
  };

  const package = await prisma.package.create({
    data: packageData,
  });
  res.status(201).json(package);
});

/** GET /api/packages/:id
 * Retrieve a package
 */
const getPackageById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid package ID");

  const package = await prisma.package.findUnique({
    where: { id },
    include: { chapter: true },
  });
  if (!package) throw createError(404, "Package not found");

  res.json(package);
});

/** PUT /api/packages/:id
 * Update a package
 */
const updatePackage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid package ID");

  const schema = z
    .object({
      packageName: z.string().min(1).max(255).optional(),
      periodMonths: z.number().int().min(1).optional(),
      isVenueFee: z.boolean().optional(),
      chapterId: z.number().int().nullable().optional(),
      basicFees: z.number().positive().optional(),
      gstRate: z.number().min(0).optional(),
      active: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    })
    .superRefine(async (data, ctx) => {
      // Get existing package data
      const existingPackage = await prisma.package.findUnique({
        where: { id },
      });
      
      if (!existingPackage) {
        ctx.addIssue({
          message: "Package not found",
          code: z.ZodIssueCode.custom,
        });
        return;
      }
      
      // Check if isVenueFee is being updated to true but no chapterId provided
      const isVenueFee = data.isVenueFee !== undefined 
        ? data.isVenueFee 
        : existingPackage.isVenueFee;
        
      const chapterId = data.chapterId !== undefined 
        ? data.chapterId 
        : existingPackage.chapterId;
        
      if (isVenueFee === true && !chapterId) {
        ctx.addIssue({
          path: ["chapterId"],
          message: "Chapter ID is required for venue fee packages",
          code: z.ZodIssueCode.custom,
        });
        return;
      }

      // If chapterId is provided, check if it exists
      if (data.chapterId) {
        const chapterExists = await prisma.chapter.findUnique({
          where: { id: data.chapterId },
        });
        if (!chapterExists) {
          ctx.addIssue({
            path: ["chapterId"],
            message: "Chapter not found",
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  const existingPackage = await prisma.package.findUnique({
    where: { id },
  });
  
  if (!existingPackage) {
    throw createError(404, "Package not found");
  }

  // Calculate new GST amount and total fees if needed
  let packageData = { ...req.body };
  
  if (req.body.basicFees !== undefined || req.body.gstRate !== undefined) {
    const basicFees = req.body.basicFees !== undefined 
      ? parseFloat(req.body.basicFees) 
      : parseFloat(existingPackage.basicFees);
      
    const gstRate = req.body.gstRate !== undefined 
      ? parseFloat(req.body.gstRate) 
      : parseFloat(existingPackage.gstRate);
      
    const gstAmount = (basicFees * gstRate) / 100;
    const totalFees = basicFees + gstAmount;
    
    packageData = {
      ...packageData,
      gstAmount,
      totalFees,
    };
  }

  const updated = await prisma.package.update({
    where: { id },
    data: packageData,
  });

  res.json(updated);
});

/** DELETE /api/packages/:id
 * Delete a package
 */
const deletePackage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid package ID");

  // Check if package exists
  const existing = await prisma.package.findUnique({ where: { id } });
  if (!existing) throw createError(404, "Package not found");
  
  // Check if package is used in any memberships
  const membershipExists = await prisma.membership.findFirst({
    where: { packageId: id },
  });
  
  if (membershipExists) {
    // If package is in use, set it to inactive instead of deleting
    await prisma.package.update({
      where: { id },
      data: { active: false },
    });
    return res.json({ 
      message: "Package has existing memberships. It has been deactivated instead of deleted." 
    });
  }

  // If package is not in use, proceed with deletion
  await prisma.package.delete({ where: { id } });
  res.json({ message: "Package deleted successfully" });
});

module.exports = {
  getPackages,
  createPackage,
  getPackageById,
  updatePackage,
  deletePackage,
}; 