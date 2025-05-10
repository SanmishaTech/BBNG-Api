const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");
const { addMonths, subDays } = require("date-fns");

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

/** GET /api/memberships
 * List memberships (pagination, filters, sort)
 */
const getMemberships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", memberId, packageId, active } = req.query;
  const sortBy = req.query.sortBy || "invoiceDate";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
  const parsedActive = active != null ? active === "true" : undefined;

  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { invoiceNumber: { contains: search } },
        { member: { memberName: { contains: search } } },
      ],
    });
  }
  if (memberId) {
    filters.push({ memberId: parseInt(memberId) });
  }
  if (packageId) {
    filters.push({ packageId: parseInt(packageId) });
  }
  if (parsedActive !== undefined) {
    filters.push({ active: parsedActive });
  }
  
  const where = filters.length ? { AND: filters } : {};

  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { 
        member: true, 
        package: { include: { chapter: true } }
      },
    }),
    prisma.membership.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    memberships,
    page,
    totalPages,
    totalMemberships: total,
  });
});

/** POST /api/memberships
 * Create a new membership
 */
const createMembership = asyncHandler(async (req, res) => {
  const schema = z
    .object({
      memberId: z.number().int().positive("Member ID is required"),
      invoiceNumber: z.string().min(1, "Invoice number is required").max(255),
      invoiceDate: z.preprocess(
        (v) => new Date(v),
        z.date({ required_error: "Invoice date is required" })
      ),
      packageId: z.number().int().positive("Package ID is required"),
      basicFees: z.number().positive("Basic fees must be positive"),
      cgstRate: z.number().min(0, "CGST rate cannot be negative").optional().nullable(),
      sgstRate: z.number().min(0, "SGST rate cannot be negative").optional().nullable(),
      igstRate: z.number().min(0, "IGST rate cannot be negative").optional().nullable(),
      paymentDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      paymentMode: z.string().optional().nullable(),
    })
    .superRefine(async (data, ctx) => {
      // Check if member exists
      const member = await prisma.member.findUnique({
        where: { id: data.memberId },
      });
      if (!member) {
        ctx.addIssue({
          path: ["memberId"],
          message: "Member not found",
          code: z.ZodIssueCode.custom,
        });
        return;
      }

      // Check if package exists
      const packageData = await prisma.package.findUnique({
        where: { id: data.packageId },
      });
      if (!packageData) {
        ctx.addIssue({
          path: ["packageId"],
          message: "Package not found",
          code: z.ZodIssueCode.custom,
        });
        return;
      }
      
      // Check if invoice number is unique
      const invoiceExists = await prisma.membership.findUnique({
        where: { invoiceNumber: data.invoiceNumber },
      });
      if (invoiceExists) {
        ctx.addIssue({
          path: ["invoiceNumber"],
          message: "Invoice number already exists",
          code: z.ZodIssueCode.custom,
        });
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Get package details to calculate dates
  const packageData = await prisma.package.findUnique({
    where: { id: req.body.packageId },
  });

  // Get member details to check expiry dates
  const member = await prisma.member.findUnique({
    where: { id: req.body.memberId },
  });

  // Determine package start and end dates
  let packageStartDate = new Date();
  let packageEndDate;

  if (packageData.isVenueFee) {
    // For venue fee packages, use venueExpiryDate
    if (member.venueExpiryDate && new Date(member.venueExpiryDate) > new Date()) {
      packageStartDate = new Date(member.venueExpiryDate);
    }
  } else {
    // For non-venue fee packages, use hoExpiryDate
    if (member.hoExpiryDate && new Date(member.hoExpiryDate) > new Date()) {
      packageStartDate = new Date(member.hoExpiryDate);
    }
  }

  // Calculate the package end date (packageStartDate + periodMonths - 1 day)
  packageEndDate = subDays(addMonths(packageStartDate, packageData.periodMonths), 1);

  // Calculate GST amounts and total fees
  const basicFees = parseFloat(req.body.basicFees);
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  
  if (req.body.cgstRate) {
    cgstAmount = (basicFees * parseFloat(req.body.cgstRate)) / 100;
  }
  
  if (req.body.sgstRate) {
    sgstAmount = (basicFees * parseFloat(req.body.sgstRate)) / 100;
  }
  
  if (req.body.igstRate) {
    igstAmount = (basicFees * parseFloat(req.body.igstRate)) / 100;
  }
  
  const totalFees = basicFees + cgstAmount + sgstAmount + igstAmount;

  // Prepare data for creating membership
  const membershipData = {
    ...req.body,
    packageStartDate,
    packageEndDate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalFees,
  };

  // Create membership record
  const membership = await prisma.membership.create({
    data: membershipData,
  });
  
  // Update member expiry dates based on package type
  const updateData = {};
  
  if (packageData.isVenueFee) {
    updateData.venueExpiryDate = packageEndDate;
  } else {
    updateData.hoExpiryDate = packageEndDate;
  }
  
  await prisma.member.update({
    where: { id: req.body.memberId },
    data: updateData,
  });

  res.status(201).json(membership);
});

/** GET /api/memberships/:id
 * Retrieve a membership
 */
const getMembershipById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { 
      member: true, 
      package: { include: { chapter: true } }
    },
  });
  
  if (!membership) throw createError(404, "Membership not found");

  res.json(membership);
});

/** PUT /api/memberships/:id
 * Update a membership
 */
const updateMembership = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  const schema = z
    .object({
      invoiceNumber: z.string().min(1).max(255).optional(),
      invoiceDate: z.preprocess(
        (v) => (v ? new Date(v) : undefined),
        z.date().optional()
      ),
      basicFees: z.number().positive().optional(),
      cgstRate: z.number().min(0).optional().nullable(),
      sgstRate: z.number().min(0).optional().nullable(),
      igstRate: z.number().min(0).optional().nullable(),
      paymentDate: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      paymentMode: z.string().optional().nullable(),
      active: z.boolean().optional(),
      // Don't allow changing memberId or packageId as they affect expiry dates
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    })
    .superRefine(async (data, ctx) => {
      // If invoice number is changed, check if it's unique
      if (data.invoiceNumber) {
        const existingInvoice = await prisma.membership.findFirst({
          where: { 
            invoiceNumber: data.invoiceNumber,
            id: { not: id }
          },
        });
        
        if (existingInvoice) {
          ctx.addIssue({
            path: ["invoiceNumber"],
            message: "Invoice number already exists",
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Get existing membership
  const existingMembership = await prisma.membership.findUnique({
    where: { id },
  });
  
  if (!existingMembership) {
    throw createError(404, "Membership not found");
  }

  // Calculate new GST amounts and total fees if needed
  let membershipData = { ...req.body };
  
  if (req.body.basicFees !== undefined || 
      req.body.cgstRate !== undefined || 
      req.body.sgstRate !== undefined || 
      req.body.igstRate !== undefined) {
    
    const basicFees = req.body.basicFees !== undefined 
      ? parseFloat(req.body.basicFees) 
      : parseFloat(existingMembership.basicFees);
      
    const cgstRate = req.body.cgstRate !== undefined 
      ? req.body.cgstRate === null ? 0 : parseFloat(req.body.cgstRate) 
      : existingMembership.cgstRate === null ? 0 : parseFloat(existingMembership.cgstRate);
      
    const sgstRate = req.body.sgstRate !== undefined 
      ? req.body.sgstRate === null ? 0 : parseFloat(req.body.sgstRate) 
      : existingMembership.sgstRate === null ? 0 : parseFloat(existingMembership.sgstRate);
      
    const igstRate = req.body.igstRate !== undefined 
      ? req.body.igstRate === null ? 0 : parseFloat(req.body.igstRate) 
      : existingMembership.igstRate === null ? 0 : parseFloat(existingMembership.igstRate);
    
    const cgstAmount = (basicFees * cgstRate) / 100;
    const sgstAmount = (basicFees * sgstRate) / 100;
    const igstAmount = (basicFees * igstRate) / 100;
    const totalFees = basicFees + cgstAmount + sgstAmount + igstAmount;
    
    membershipData = {
      ...membershipData,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalFees,
    };
  }

  const updated = await prisma.membership.update({
    where: { id },
    data: membershipData,
  });

  res.json(updated);
});

/** DELETE /api/memberships/:id
 * Delete a membership
 */
const deleteMembership = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid membership ID");

  // Get membership details
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { package: true },
  });
  
  if (!membership) {
    throw createError(404, "Membership not found");
  }

  // Get member details
  const member = await prisma.member.findUnique({
    where: { id: membership.memberId },
  });

  // Check if we need to update expiry dates
  const updateMemberData = {};
  
  // If this membership's end date is the same as the member's current expiry date,
  // we need to reset it or find the next most recent membership end date
  if (membership.package.isVenueFee && 
      member.venueExpiryDate && 
      new Date(member.venueExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
    
    // Find the most recent active membership for this member with the same package type
    const mostRecentMembership = await prisma.membership.findFirst({
      where: {
        memberId: membership.memberId,
        id: { not: id },
        package: { isVenueFee: true },
        active: true,
      },
      orderBy: { packageEndDate: 'desc' },
      include: { package: true },
    });
    
    updateMemberData.venueExpiryDate = mostRecentMembership 
      ? mostRecentMembership.packageEndDate 
      : null;
  } 
  else if (!membership.package.isVenueFee && 
           member.hoExpiryDate && 
           new Date(member.hoExpiryDate).getTime() === new Date(membership.packageEndDate).getTime()) {
    
    // Find the most recent active membership for this member with the same package type
    const mostRecentMembership = await prisma.membership.findFirst({
      where: {
        memberId: membership.memberId,
        id: { not: id },
        package: { isVenueFee: false },
        active: true,
      },
      orderBy: { packageEndDate: 'desc' },
      include: { package: true },
    });
    
    updateMemberData.hoExpiryDate = mostRecentMembership 
      ? mostRecentMembership.packageEndDate 
      : null;
  }

  // Begin a transaction to update member and delete membership
  await prisma.$transaction([
    prisma.member.update({
      where: { id: membership.memberId },
      data: updateMemberData,
    }),
    prisma.membership.delete({
      where: { id },
    }),
  ]);

  res.json({ message: "Membership deleted successfully" });
});

/** GET /api/memberships/member/:memberId
 * Get all memberships for a specific member
 */
const getMembershipsByMemberId = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.memberId);
  if (!memberId) throw createError(400, "Invalid member ID");

  // Check if member exists
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  
  if (!member) {
    throw createError(404, "Member not found");
  }

  const memberships = await prisma.membership.findMany({
    where: { memberId },
    include: { 
      package: { include: { chapter: true } }
    },
    orderBy: { invoiceDate: 'desc' },
  });

  res.json(memberships);
});

module.exports = {
  getMemberships,
  createMembership,
  getMembershipById,
  updateMembership,
  deleteMembership,
  getMembershipsByMemberId,
}; 