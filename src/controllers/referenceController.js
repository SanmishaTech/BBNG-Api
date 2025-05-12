const { PrismaClient, Prisma } = require("@prisma/client");
const createError = require("http-errors");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 * Converts Zod validation errors and known request errors into structured 400 responses.
 */
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch((err) => {
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

// Parse integer helper function
const int = (v) => parseInt(v, 10);

/**
 * GET /references
 *  – giverId   → references I have GIVEN
 *  – receiverId→ references I have RECEIVED
 *  – no id     → admin list / full search
 */
const listReferences = asyncHandler(async (req, res, next) => {
  try {
    let {
      page = 1,
      limit = 10,
      giverId,
      receiverId,
      search = "",
      status,
      self,
      sortBy = "date",
      sortOrder = "desc",
      exportData = false,
    } = req.query;

    const where = {};
    if (giverId) {
      where.giverId = int(giverId);

      // Handle self-reference filtering when a giverId is specified
      if (self === "false" || self === false) {
        where.NOT = {
          receiverId: int(giverId), // Don't include references where receiver is same as giver
        };
      } else if (self === "true" || self === true) {
        where.receiverId = int(giverId); // Only include references where receiver is same as giver
      }
    }

    if (receiverId) where.receiverId = int(receiverId);
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { nameOfReferral: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { remarks: { contains: search, mode: "insensitive" } },
        { mobile1: { contains: search } },
      ];
    }

    const skip = (int(page) - 1) * int(limit);
    const total = await prisma.reference.count({ where });

    const rows = await prisma.reference.findMany({
      where,
      skip: exportData ? undefined : skip,
      take: exportData ? undefined : int(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        giver: { select: { id: true, memberName: true, email: true } },
        receiver: { select: { id: true, memberName: true, email: true } },
        chapter: { select: { id: true, name: true } },
      },
    });

    const payload =
      exportData === "true"
        ? { references: rows }
        : {
            references: rows,
            page: int(page),
            totalPages: Math.ceil(total / int(limit)),
            total,
          };

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * Get a single reference by ID
 */
const getReferenceById = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const reference = await prisma.reference.findUnique({
      where: { id: int(id) },
      include: {
        giver: {
          select: {
            id: true,
            memberName: true,
            email: true,
            organizationName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            memberName: true,
            email: true,
            organizationName: true,
          },
        },
        chapter: {
          select: {
            id: true,
            name: true,
          },
        },
        statusHistory: {
          orderBy: {
            date: "desc",
          },
        },
      },
    });

    if (!reference) {
      return next(createError(404, "Reference not found"));
    }

    res.json(reference);
  } catch (err) {
    next(err);
  }
});

/**
 * Create a new reference
 */
const createReference = asyncHandler(async (req, res, next) => {
  try {
    // Define Zod schema for reference validation
    const schema = z.object({
      date: z.string().nonempty("Date is required."),
      noOfReferences: z.string().optional(),
      chapterId: z.number().int().positive("Chapter ID is required."),
      memberId: z.number().int().positive("Member ID (receiver) is required."),
      urgency: z.string().optional(),
      self: z.union([z.boolean(), z.string()]).optional(),
      nameOfReferral: z.string().nonempty("Name of referral is required."),
      mobile1: z.string().nonempty("Primary mobile number is required."),
      mobile2: z.string().optional(),
      email: z
        .string()
        .email("Must be a valid email address.")
        .optional()
        .nullable(),
      remarks: z.string().optional(),
      addressLine1: z.string().optional(),
      location: z.string().optional(),
      addressLine2: z.string().optional(),
      pincode: z.string().optional(),
      status: z.string().optional(),
    });

    // Use validateRequest utility for validation
    const validatedData = await validateRequest(schema, req.body, res, next);
    if (validatedData.errors) {
      return res.status(400).json({ errors: validatedData.errors });
    }

    // Check if the current user has a corresponding member record
    const member = await prisma.member.findFirst({
      where: { userId: req.user.id },
    });

    if (!member) {
      return next(
        createError(
          400,
          "Current user does not have a corresponding member record. Cannot create reference."
        )
      );
    }

    // Create the reference
    const reference = await prisma.reference.create({
      data: {
        date: new Date(validatedData.date),
        noOfReferences: validatedData.noOfReferences
          ? int(validatedData.noOfReferences)
          : null,
        chapterId: int(validatedData.chapterId),
        giverId: member.id, // Use the member ID, not the user ID
        receiverId: int(validatedData.memberId), // memberId in request is receiverId
        urgency: validatedData.urgency,
        self: validatedData.self === true || validatedData.self === "true",
        nameOfReferral: validatedData.nameOfReferral,
        mobile1: validatedData.mobile1,
        mobile2: validatedData.mobile2,
        email: validatedData.email,
        remarks: validatedData.remarks,
        addressLine1: validatedData.addressLine1,
        location: validatedData.location,
        addressLine2: validatedData.addressLine2,
        pincode: validatedData.pincode,
        status: validatedData.status || "pending",
      },
    });

    res.status(201).json(reference);
  } catch (err) {
    next(err);
  }
});

/**
 * Update an existing reference
 */
const updateReference = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return next(createError(400, "Invalid reference ID"));
    }

    // Define Zod schema for reference update validation
    const schema = z.object({
      date: z.string().optional(),
      noOfReferences: z.string().optional(),
      chapterId: z.number().int().positive().optional(),
      memberId: z.number().int().positive().optional(), // This is the receiverId in the database
      urgency: z.string().optional(),
      self: z.union([z.boolean(), z.string()]).optional(),
      nameOfReferral: z.string().optional(),
      mobile1: z.string().optional(),
      mobile2: z.string().optional(),
      email: z
        .string()
        .email("Must be a valid email address.")
        .optional()
        .nullable(),
      remarks: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      location: z.string().optional(),
      pincode: z.string().optional(),
      status: z.string().optional(),
    });

    // Use validateRequest utility for validation
    const validatedData = await validateRequest(schema, req.body);

    // Prepare data for update, only including fields that are provided
    const updateData = {};

    if (validatedData.date) updateData.date = new Date(validatedData.date);
    if (validatedData.noOfReferences !== undefined) {
      updateData.noOfReferences = validatedData.noOfReferences
        ? int(validatedData.noOfReferences)
        : null;
    }
    if (validatedData.chapterId)
      updateData.chapterId = int(validatedData.chapterId);
    if (validatedData.memberId)
      updateData.receiverId = int(validatedData.memberId); // memberId in request maps to receiverId
    if (validatedData.urgency !== undefined)
      updateData.urgency = validatedData.urgency;
    if (validatedData.self !== undefined) {
      updateData.self =
        validatedData.self === true || validatedData.self === "true";
    }
    if (validatedData.nameOfReferral)
      updateData.nameOfReferral = validatedData.nameOfReferral;
    if (validatedData.mobile1) updateData.mobile1 = validatedData.mobile1;
    if (validatedData.mobile2 !== undefined)
      updateData.mobile2 = validatedData.mobile2;
    if (validatedData.email !== undefined)
      updateData.email = validatedData.email;
    if (validatedData.remarks !== undefined)
      updateData.remarks = validatedData.remarks;
    if (validatedData.addressLine1 !== undefined)
      updateData.addressLine1 = validatedData.addressLine1;
    if (validatedData.location !== undefined)
      updateData.location = validatedData.location;
    if (validatedData.addressLine2 !== undefined)
      updateData.addressLine2 = validatedData.addressLine2;
    if (validatedData.pincode !== undefined)
      updateData.pincode = validatedData.pincode;
    if (validatedData.status) updateData.status = validatedData.status;

    const updated = await prisma.reference.update({
      where: { id: int(id) },
      data: updateData,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete a reference
 */
const deleteReference = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if reference exists
    const existingReference = await prisma.reference.findUnique({
      where: { id: int(id) },
    });

    if (!existingReference) {
      return next(createError(404, "Reference not found"));
    }

    // Delete the reference
    await prisma.reference.delete({
      where: { id: int(id) },
    });

    res.json({ success: true, message: "Reference deleted successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * Update reference status
 */
const updateReferenceStatus = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return next(createError(400, "Invalid reference ID"));
    }

    // Define Zod schema for status update validation
    const schema = z.object({
      status: z.enum(["pending", "contacted", "converted", "rejected"], {
        errorMap: () => ({
          message:
            "Status must be one of: pending, contacted, converted, rejected",
        }),
      }),
      date: z.string().optional(),
      comment: z.string().optional(),
    });

    // Use validateRequest utility for validation
    const validatedData = await validateRequest(schema, req.body);

    // Check if reference exists
    const existingReference = await prisma.reference.findUnique({
      where: { id: int(id) },
    });

    if (!existingReference) {
      return next(createError(404, "Reference not found"));
    }

    // Create a transaction to update both reference status and add history entry
    const result = await prisma.$transaction(async (prisma) => {
      // Update the reference status
      const updatedReference = await prisma.reference.update({
        where: { id: int(id) },
        data: {
          status: validatedData.status,
          // You could add more fields here if needed
        },
      });

      // Create a status history entry
      const statusHistory = await prisma.referenceStatusHistory.create({
        data: {
          referenceId: int(id),
          date: validatedData.date ? new Date(validatedData.date) : new Date(),
          status: validatedData.status,
          comment: validatedData.comment || null,
          userId: req.user.id, // Record which user made the status change
        },
      });

      return { reference: updatedReference, statusHistory };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Get all references given by a member
 */
const getGivenReferences = asyncHandler(async (req, res, next) => {
  try {
    let { memberId } = req.params;

    if (!memberId && req.user) {
      // If no member ID is provided, use the current user's member ID
      const member = await prisma.member.findFirst({
        where: { userId: req.user.id },
      });

      if (!member) {
        return next(
          createError(400, "No member profile found for current user")
        );
      }

      memberId = member.id;
    }

    // Use the listReferences function with the giverId parameter
    req.query.giverId = memberId;
    return listReferences(req, res, next);
  } catch (err) {
    next(err);
  }
});

/**
 * Get all references received by a member
 */
const getReceivedReferences = asyncHandler(async (req, res, next) => {
  try {
    let { memberId } = req.params;

    if (!memberId && req.user) {
      // If no member ID is provided, use the current user's member ID
      const member = await prisma.member.findFirst({
        where: { userId: req.user.id },
      });

      if (!member) {
        return next(
          createError(400, "No member profile found for current user")
        );
      }

      memberId = member.id;
    }

    // Use the listReferences function with the receiverId parameter
    req.query.receiverId = memberId;
    return listReferences(req, res, next);
  } catch (err) {
    next(err);
  }
});

/**
 * Get member information for reference dropdown
 */
const getMemberInfoForReference = asyncHandler(async (req, res, next) => {
  try {
    // Get current user's member ID
    const currentMember = await prisma.member.findFirst({
      where: { userId: req.user.id },
      select: { id: true, chapterId: true },
    });

    if (!currentMember) {
      return next(createError(400, "No member profile found for current user"));
    }

    // Get member list from the same chapter
    const members = await prisma.member.findMany({
      where: {
        chapterId: currentMember.chapterId,
        active: true,
      },
      select: {
        id: true,
        memberName: true,
        email: true,
        organizationName: true,
        businessCategory: true,
      },
      orderBy: { memberName: "asc" },
    });

    res.json({
      currentMemberId: currentMember.id,
      members,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get reference performance metrics for a user
 */
const getReferenceMetrics = asyncHandler(async (req, res, next) => {
  try {
    // Extract parameters
    let { memberId, startDate, endDate } = req.query;

    // Default to current user's member ID if not specified
    if (!memberId) {
      const member = await prisma.member.findFirst({
        where: { userId: req.user.id },
      });

      if (!member) {
        return next(
          createError(400, "No member profile found for current user")
        );
      }

      memberId = member.id;
    } else {
      memberId = int(memberId);
    }

    // Default date range to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end);
    if (!startDate) {
      start.setDate(start.getDate() - 30); // Default to 30 days ago
    }

    // Query for references given
    const referencesGiven = await prisma.reference.count({
      where: {
        giverId: memberId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Query for references received
    const referencesReceived = await prisma.reference.count({
      where: {
        receiverId: memberId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Query for reference conversions
    const referencesConverted = await prisma.reference.count({
      where: {
        receiverId: memberId,
        status: "converted",
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Calculate conversion rate
    const conversionRate =
      referencesReceived > 0
        ? (referencesConverted / referencesReceived) * 100
        : 0;

    // Status breakdown for given references
    const givenStatusBreakdown = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count
      FROM Reference
      WHERE giverId = ${memberId}
      AND date >= ${start}
      AND date <= ${end}
      GROUP BY status
    `;

    // Status breakdown for received references
    const receivedStatusBreakdown = await prisma.$queryRaw`
      SELECT status, COUNT(*) as count
      FROM Reference
      WHERE receiverId = ${memberId}
      AND date >= ${start}
      AND date <= ${end}
      GROUP BY status
    `;

    res.json({
      memberId,
      dateRange: {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      },
      referencesGiven,
      referencesReceived,
      referencesConverted,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      givenStatusBreakdown,
      receivedStatusBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  listReferences,
  getReferenceById,
  createReference,
  updateReference,
  deleteReference,
  updateReferenceStatus,
  getGivenReferences,
  getReceivedReferences,
  getMemberInfoForReference,
  getReferenceMetrics,
};
