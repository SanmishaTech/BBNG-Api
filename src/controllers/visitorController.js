const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");
const { getUserAccessibleChapters } = require("../services/chapterService");

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

/** GET /api/visitors
 * List visitors (pagination, filters, sort)
 */
const getVisitors = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", meetingId, status, chapterId, fromDate, toDate, isCrossChapter } = req.query;
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const user = req.user;
  const userRoles = Array.isArray(user.roles) ? user.roles.map(r => r.toLowerCase()) : [String(user.role || "").toLowerCase()];
  const adminRoles = ["admin", "super_admin"];
  const isAdmin = userRoles.some(role => adminRoles.includes(role));

  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { name: { contains: search } },
        { email: { contains: search } },
        { mobile1: { contains: search } },
        { chapter: { contains: search } },
      ],
    });
  }

  // Date range filter
  if (fromDate && toDate) {
    filters.push({ meeting: { date: { gte: new Date(fromDate), lte: new Date(toDate) } } });
  } else if (fromDate) {
    filters.push({ meeting: { date: { gte: new Date(fromDate) } } });
  } else if (toDate) {
    filters.push({ meeting: { date: { lte: new Date(toDate) } } });
  }
  
  if (status) {
    filters.push({ status });
  }

  // Filter by isCrossChapter flag
  if (isCrossChapter !== undefined && isCrossChapter !== '') {
    filters.push({ isCrossChapter: isCrossChapter === 'true' });
  }

  // Chapter and Meeting filtering logic
  if (isAdmin) {
    if (meetingId) {
      filters.push({ meetingId: parseInt(meetingId) });
    } else if (chapterId) {
      filters.push({ chapterId: parseInt(chapterId) });
    }
  } else {
    const accessibleChapters = await getUserAccessibleChapters(user.id);
    const accessibleChapterIds = accessibleChapters.flatMap(group => group.chapters);

    if (accessibleChapterIds.length === 0) {
      return res.json({ visitors: [], page, totalPages: 0, totalVisitors: 0 });
    }

    // Include visitors whose own chapterId or their meeting's chapterId is within the user's accessible chapters
    filters.push({
      OR: [
        { chapterId: { in: accessibleChapterIds } },
        { meeting: { is: { chapterId: { in: accessibleChapterIds } } } },
      ],
    });

    if (meetingId) {
        filters.push({ meetingId: parseInt(meetingId) });
    } else if (chapterId) {
        // Allow filtering by either visitor's chapter or meeting's chapter
        const chapIdInt = parseInt(chapterId);
        filters.push({
          OR: [
            { chapterId: chapIdInt },
            { meeting: { is: { chapterId: chapIdInt } } },
          ],
        });
    }
  }

  const where = filters.length ? { AND: filters } : {};

  const [visitors, total] = await Promise.all([
    prisma.visitor.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        meeting: true,
        invitedByMember: {
          include: {
            chapter: true
          }
        },
        homeChapter: true
      },
    }),
    prisma.visitor.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    visitors,
    page,
    totalPages,
    totalVisitors: total,
  });
});

/** POST /api/visitors
 * Create a new visitor
 */
const createVisitor = asyncHandler(async (req, res) => {
  const schema = z.object({
      name: z.string().optional(),
      email: z.string().optional().nullable(), // Email completely optional with no validation
      gender: z.string().optional(),
      dateOfBirth: z.preprocess(
        (v) => (v ? new Date(v) : null),
        z.date().optional().nullable()
      ),
      mobile1: z.string().optional(),
      mobile2: z.string().optional().nullable(),
      isCrossChapter: z.boolean().optional().default(false),
    
      meetingId: z.number().int("Meeting ID is required"),
      chapterId: z.number().int("Chapter ID is required").nullable().optional(),
      chapter: z.string().optional().nullable(),
    
      invitedById: z.number().int("Invited by member ID is required").nullable().optional(),
    
      category: z.string().optional().nullable(),
      businessDetails: z.string().optional().nullable(),
    
      addressLine1: z.string().optional().nullable(),
      addressLine2: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      pincode: z.string().optional().nullable(),
    
      status: z.string().optional().nullable(),
  }).superRefine(async (data, ctx) => {
    // Check if meeting exists and get its chapter
    const meeting = await prisma.chapterMeeting.findUnique({
      where: { id: data.meetingId },
      include: { chapter: true }
    });
    if (!meeting) {
      ctx.addIssue({
        path: ["meetingId"],
        message: `Meeting with ID ${data.meetingId} does not exist`,
        code: z.ZodIssueCode.custom,
      });
    }
    
    // For non-cross-chapter visitors, chapter selection is manual
    // Removed automatic chapter assignment - users should select the chapter themselves

    // Validate required fields based on isCrossChapter flag
    if (data.isCrossChapter) {
      // For cross-chapter visitors, only chapterId and invitedById are required
      if (!data.chapterId) {
        ctx.addIssue({
          path: ["chapterId"],
          message: "Home Chapter is required for cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.invitedById) {
        ctx.addIssue({
          path: ["invitedById"],
          message: "Invited By is required for cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
    } else {
      // For non-cross-chapter visitors, all regular fields are required
      if (!data.name) {
        ctx.addIssue({
          path: ["name"],
          message: "Name is required",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.chapter) {
        ctx.addIssue({
          path: ["chapter"],
          message: "Chapter name is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.chapterId) {
        ctx.addIssue({
          path: ["chapterId"],
          message: "Chapter selection is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.gender) {
        ctx.addIssue({
          path: ["gender"],
          message: "Gender is required",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.mobile1) {
        ctx.addIssue({
          path: ["mobile1"],
          message: "Primary mobile number is required",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.category) {
        ctx.addIssue({
          path: ["category"],
          message: "Category is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.addressLine1) {
        ctx.addIssue({
          path: ["addressLine1"],
          message: "Address line 1 is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.city) {
        ctx.addIssue({
          path: ["city"],
          message: "City is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.pincode) {
        ctx.addIssue({
          path: ["pincode"],
          message: "Pincode is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (!data.status) {
        ctx.addIssue({
          path: ["status"],
          message: "Status is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
    }

    // Check if invitedBy member exists if provided
    if (data.invitedById) {
      const member = await prisma.member.findUnique({
        where: { id: data.invitedById },
      });
      if (!member) {
        ctx.addIssue({
          path: ["invitedById"],
          message: `Member with ID ${data.invitedById} does not exist`,
          code: z.ZodIssueCode.custom,
        });
      }
    }
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Get meeting data to ensure we have the correct chapter information
  const meeting = await prisma.chapterMeeting.findUnique({
    where: { id: req.body.meetingId },
    include: { chapter: true }
  });
  
  // Prepare visitor data
  const visitorData = {
    ...req.body,
    dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
  };
  
  // For non-cross-chapter visitors, use the chapter selected by the user
  // No automatic assignment - the chapter should come from the form submission
  
  // Clean up empty fields for all visitors - now all fields are optional in the schema
  const fieldsToNullify = ['name', 'email', 'gender', 'mobile1', 'mobile2', 'businessDetails', 'addressLine1', 'addressLine2', 'city', 'pincode', 'category', 'status'];
  fieldsToNullify.forEach(field => {
    if (visitorData[field] === '' || visitorData[field] === undefined) {
      visitorData[field] = null;
    }
  });

  const visitor = await prisma.visitor.create({
    data: visitorData,
    include: {
      meeting: true,
      invitedByMember: true,
      homeChapter: true
    },
  });
  res.status(201).json(visitor);
});

/** GET /api/visitors/:id
 * Retrieve a visitor
 */
const getVisitorById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid visitor ID");

  const visitor = await prisma.visitor.findUnique({
    where: { id },
    include: {
      meeting: true,
      invitedByMember: true,
      homeChapter: true
    },
  });
  if (!visitor) throw createError(404, "Visitor not found");

  const user = req.user;
  const userRoles = Array.isArray(user.roles) ? user.roles.map(r => r.toLowerCase()) : [String(user.role || "").toLowerCase()];
  const adminRoles = ["admin", "super_admin"];
  const isAdmin = userRoles.some(role => adminRoles.includes(role));

  if (!isAdmin) {
      const accessibleChapters = await getUserAccessibleChapters(user.id);
      const accessibleChapterIds = accessibleChapters.flatMap(group => group.chapters);
      const hasAccess = (
        visitor.chapterId && accessibleChapterIds.includes(visitor.chapterId)
      ) || (
        visitor.meeting?.chapterId && accessibleChapterIds.includes(visitor.meeting.chapterId)
      );
      if (!hasAccess) {
          throw createError(403, "Forbidden: You do not have access to this visitor's chapter.");
      }
  }

  // Convert null values to empty strings for frontend form handling
  const sanitizedVisitor = {
    ...visitor,
    name: visitor.name || '',
    email: visitor.email || '',
    gender: visitor.gender || '',
    mobile1: visitor.mobile1 || '',
    mobile2: visitor.mobile2 || '',
    chapter: visitor.chapter || '',
    category: visitor.category || '',
    businessDetails: visitor.businessDetails || '',
    addressLine1: visitor.addressLine1 || '',
    addressLine2: visitor.addressLine2 || '',
    city: visitor.city || '',
    pincode: visitor.pincode || '',
    status: visitor.status || '',
  };
  
  res.json(sanitizedVisitor);
});

/** PUT /api/visitors/:id
 * Update a visitor
 */
const updateVisitor = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid visitor ID");

  const schema = z.object({
    name: z.string().optional(),
    email: z.string().optional().nullable(), // Email completely optional with no validation
    gender: z.string().optional(),
    dateOfBirth: z.preprocess(
      (v) => (v ? new Date(v) : undefined),
      z.date().optional()
    ),
    mobile1: z.string().min(1).optional(),
    mobile2: z.string().optional().nullable(),
    isCrossChapter: z.boolean().optional(),
    
    meetingId: z.number().int().optional(),
    chapterId: z.number().int().optional().nullable(),
    chapter: z.string().optional().nullable(),
    
    invitedById: z.number().int().optional().nullable(),
    
    category: z.string().optional().nullable(),
    businessDetails: z.string().optional().nullable(),
    
    addressLine1: z.string().optional().nullable(),
    addressLine2: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    
    status: z.string().optional().nullable(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  }).superRefine(async (data, ctx) => {
    // Check if meeting exists if provided
    if (data.meetingId) {
      const meeting = await prisma.chapterMeeting.findUnique({
        where: { id: data.meetingId },
      });
      if (!meeting) {
        ctx.addIssue({
          path: ["meetingId"],
          message: `Meeting with ID ${data.meetingId} does not exist`,
          code: z.ZodIssueCode.custom,
        });
      }
    }

    // Get existing visitor to check if isCrossChapter is being changed
    const existingVisitor = await prisma.visitor.findUnique({
      where: { id },
      include: { meeting: { include: { chapter: true } } }
    });

    const isCrossChapter = data.isCrossChapter !== undefined ? data.isCrossChapter : existingVisitor?.isCrossChapter;

    // Validate required fields based on isCrossChapter flag
    if (data.isCrossChapter !== undefined && data.isCrossChapter === true) {
      // When switching to cross-chapter, ensure only chapterId and invitedById are required
      if (data.chapterId === undefined && !existingVisitor?.chapterId) {
        ctx.addIssue({
          path: ["chapterId"],
          message: "Home Chapter is required for cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.invitedById === undefined && !existingVisitor?.invitedById) {
        ctx.addIssue({
          path: ["invitedById"],
          message: "Invited By is required for cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
    } else if (data.isCrossChapter !== undefined && data.isCrossChapter === false) {
      // When switching to non-cross-chapter, validate required fields
      if (data.name === "") {
        ctx.addIssue({
          path: ["name"],
          message: "Name is required",
          code: z.ZodIssueCode.custom,
        });
      }
      // No validation for email - it's completely optional
      
      if (data.gender === "") {
        ctx.addIssue({
          path: ["gender"],
          message: "Gender is required",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.mobile1 === "") {
        ctx.addIssue({
          path: ["mobile1"],
          message: "Primary mobile number is required",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.chapter === "") {
        ctx.addIssue({
          path: ["chapter"],
          message: "Chapter name is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.category === "") {
        ctx.addIssue({
          path: ["category"],
          message: "Category is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.addressLine1 === "") {
        ctx.addIssue({
          path: ["addressLine1"],
          message: "Address line 1 is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.city === "") {
        ctx.addIssue({
          path: ["city"],
          message: "City is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.pincode === "") {
        ctx.addIssue({
          path: ["pincode"],
          message: "Pincode is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
      
      if (data.status === "") {
        ctx.addIssue({
          path: ["status"],
          message: "Status is required for non-cross-chapter visitors",
          code: z.ZodIssueCode.custom,
        });
      }
    }

    // Check if invitedBy member exists if provided
    if (data.invitedById) {
      const member = await prisma.member.findUnique({
        where: { id: data.invitedById },
      });
      if (!member) {
        ctx.addIssue({
          path: ["invitedById"],
          message: `Member with ID ${data.invitedById} does not exist`,
          code: z.ZodIssueCode.custom,
        });
      }
    }
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  const existing = await prisma.visitor.findUnique({ 
    where: { id },
    include: { meeting: { include: { chapter: true } } }
  });
  if (!existing) throw createError(404, "Visitor not found");

  const user = req.user;
  const userRoles = Array.isArray(user.roles) ? user.roles.map(r => r.toLowerCase()) : [String(user.role || "").toLowerCase()];
  const adminRoles = ["admin", "super_admin"];
  const isAdmin = userRoles.some(role => adminRoles.includes(role));

  if (!isAdmin) {
      const accessibleChapters = await getUserAccessibleChapters(user.id);
      const accessibleChapterIds = accessibleChapters.flatMap(group => group.chapters);
      if (!existing.chapterId || !accessibleChapterIds.includes(existing.chapterId)) {
          throw createError(403, "Forbidden: You do not have permission to update visitors for this chapter.");
      }
  }

  // Handle dateOfBirth properly when it's included in the update
  const updateData = { ...req.body };
  if (updateData.dateOfBirth) {
    updateData.dateOfBirth = new Date(updateData.dateOfBirth);
  }

  // For non-cross-chapter visitors, use the chapter selected by the user
  // No automatic assignment - the chapter should come from the form submission
  
  // Clean up empty fields for update - convert empty strings to null
  const fieldsToNullify = ['name', 'email', 'gender', 'mobile1', 'mobile2', 'businessDetails', 'addressLine1', 'addressLine2', 'city', 'pincode', 'category', 'status', 'chapter'];
  fieldsToNullify.forEach(field => {
    if (updateData[field] === '' || updateData[field] === undefined) {
      updateData[field] = null;
    }
  });

  const updated = await prisma.visitor.update({
    where: { id },
    data: updateData,
    include: {
      meeting: true,
      invitedByMember: true,
      homeChapter: true
    },
  });
  res.json(updated);
});

/** DELETE /api/visitors/:id
 * Delete a visitor
 */
const deleteVisitor = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid visitor ID");

  const existing = await prisma.visitor.findUnique({ where: { id } });
  if (!existing) throw createError(404, "Visitor not found");

  const user = req.user;
  const userRoles = Array.isArray(user.roles) ? user.roles.map(r => r.toLowerCase()) : [String(user.role || "").toLowerCase()];
  const adminRoles = ["admin", "super_admin"];
  const isAdmin = userRoles.some(role => adminRoles.includes(role));

  if (!isAdmin) {
      const accessibleChapters = await getUserAccessibleChapters(user.id);
      const accessibleChapterIds = accessibleChapters.flatMap(group => group.chapters);
      if (!existing.chapterId || !accessibleChapterIds.includes(existing.chapterId)) {
          throw createError(403, "Forbidden: You do not have permission to delete visitors for this chapter.");
      }
  }

  await prisma.visitor.delete({ where: { id } });
  res.json({ message: "Visitor deleted successfully" });
});

module.exports = {
  getVisitors,
  createVisitor,
  getVisitorById,
  updateVisitor,
  deleteVisitor,
};