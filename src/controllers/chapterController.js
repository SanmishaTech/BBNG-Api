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

/** GET /api/chapters
 * List chapters (pagination, filters, sort)
 */
const getChapters = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", city = "", status } = req.query;
  const parsedStatus =
    status != null ? ["true", "1"].includes(status.toString()) : undefined;
  const sortBy = req.query.sortBy || "name";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const filters = [];
  if (search) {
    filters.push({
      name: {
        contains: search,
      },
    });
  }
  if (city) {
    filters.push({
      location: {
        location: {
          contains: city,
        },
      },
    });
  }
  if (parsedStatus !== undefined) filters.push({ status: parsedStatus });
  const where = filters.length ? { AND: filters } : {};

  const [chapters, total] = await Promise.all([
    prisma.chapter.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { zones: true, location: true },
    }),
    prisma.chapter.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    chapters,
    page,
    totalPages,
    totalChapters: total,
  });
});

/** POST /api/chapters
 * Create a new chapter
 */
const createChapter = asyncHandler(async (req, res) => {
  const schema = z
    .object({
      name: z.string().min(1, "Name is required").max(255),
      zoneId: z.number().int("zoneId must be an integer"),
      locationId: z.number().int("locationId must be an integer"),
      date: z.preprocess(
        (v) => new Date(v),
        z.date({ required_error: "Date is required" })
      ),
      meetingday: z.string().min(1, "Meeting day is required").max(50),
      status: z.boolean().optional(),
      venue: z.string().min(1, "Venue is required").max(255),
      bankopeningbalance: z.number().nullable(),
      bankclosingbalance: z.number().nullable(),
      cashopeningbalance: z.number().nullable(),
      cashclosingbalance: z.number().nullable(),
    })
    .superRefine(async (data, ctx) => {
      const exists = await prisma.chapter.findFirst({
        where: { name: data.name, zoneId: data.zoneId },
      });
      if (exists) {
        ctx.addIssue({
          path: ["name"],
          message: `Chapter '${data.name}' already exists in zone ${data.zoneId}`,
          code: z.ZodIssueCode.custom,
        });
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  const chapter = await prisma.chapter.create({
    data: { ...req.body, date: new Date(req.body.date) },
  });
  res.status(201).json(chapter);
});

/** GET /api/chapters/:id
 * Retrieve a chapter
 */
const getChapterById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid chapter ID");

  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: { zones: true, location: true },
  });
  if (!chapter) throw createError(404, "Chapter not found");

  res.json(chapter);
});

/** PUT /api/chapters/:id
 * Update a chapter
 */
const updateChapter = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid chapter ID");

  const schema = z
    .object({
      name: z.string().min(1).max(255).optional(),
      zoneId: z.number().int().optional(),
      locationId: z.number().int().optional(),
      date: z.preprocess(
        (v) => (v ? new Date(v) : undefined),
        z.date().optional()
      ),
      meetingday: z.string().min(1).max(50).optional(),
      status: z.boolean().optional(),
      venue: z.string().min(1).max(255).optional(),
      bankopeningbalance: z.number().nullable().optional(),
      bankclosingbalance: z.number().nullable().optional(),
      cashopeningbalance: z.number().nullable().optional(),
      cashclosingbalance: z.number().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required",
    })
    .superRefine(async (data, ctx) => {
      if (data.name && data.zoneId) {
        const exists = await prisma.chapter.findFirst({
          where: { name: data.name, zoneId: data.zoneId, id: { not: id } },
        });
        if (exists) {
          ctx.addIssue({
            path: ["name"],
            message: `Another chapter named '${data.name}' exists in zone ${data.zoneId}`,
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  const existing = await prisma.chapter.findUnique({ where: { id } });
  if (!existing) throw createError(404, "Chapter not found");

  const updated = await prisma.chapter.update({
    where: { id },
    data: req.body,
  });
  res.json(updated);
});

/** DELETE /api/chapters/:id
 * Delete a chapter
 */
const deleteChapter = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid chapter ID");

  const existing = await prisma.chapter.findUnique({ where: { id } });
  if (!existing) throw createError(404, "Chapter not found");

  await prisma.chapter.delete({ where: { id } });
  res.json({ message: "Chapter deleted successfully" });
});

/** GET /api/chapters/:chapterId/roles
 * List all roles for a specific chapter
 */
const getChapterRoles = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (!chapterId) throw createError(400, "Invalid chapter ID");

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
  });
  if (!chapter) throw createError(404, "Chapter not found");

  const roles = await prisma.chapterRole.findMany({
    where: { chapterId },
    include: {
      member: {
        select: {
          id: true,
          memberName: true,
          email: true,
          mobile1: true,
          organizationName: true,
          profilePicture1: true,
        },
      },
    },
  });

  res.json(roles);
});

// Get chapter role history
const getChapterRoleHistory = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (!chapterId) throw createError(400, "Invalid chapter ID");

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) throw createError(404, "Chapter not found");

  try {
    // Try to get history directly using raw query to avoid prisma model issues
    const history = await prisma.$queryRaw`
      SELECT 
        crh.id, 
        crh.roleId, 
        crh.memberId, 
        crh.action, 
        crh.performedById, 
        crh.performedByName, 
        crh.chapterId, 
        crh.roleType, 
        crh.startDate, 
        crh.endDate,
        m.memberName, 
        m.email, 
        m.mobile1
      FROM 
        chapter_role_history crh
      JOIN 
        members m ON crh.memberId = m.id
      WHERE 
        crh.chapterId = ${chapterId}
      ORDER BY 
        crh.roleType ASC, 
        crh.startDate DESC
    `;
    
    // Transform the result to match the expected format
    const formattedHistory = history.map(item => ({
      id: item.id,
      roleId: item.roleId,
      memberId: item.memberId,
      action: item.action,
      performedById: item.performedById,
      performedByName: item.performedByName,
      chapterId: item.chapterId,
      roleType: item.roleType,
      startDate: item.startDate,
      endDate: item.endDate,
      member: {
        id: item.memberId,
        memberName: item.memberName,
        email: item.email,
        mobile1: item.mobile1
      }
    }));
    
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching chapter role history:', error);
    res.status(500).json({ message: 'Failed to fetch role history', error: error.message });
  }
});

/** POST /api/chapters/:chapterId/roles
 * Assign a role to a member in a chapter
 */
const assignChapterRole = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  if (!chapterId) throw createError(400, "Invalid chapter ID");

  const schema = z.object({
    memberId: z.number().int().positive("Member ID must be a positive integer"),
    roleType: z.enum([
      "chapterHead",
      "secretary",
      "treasurer",
      "guardian",
      "districtCoordinator", 
      "regionalCoordinator"
    ], {
      errorMap: () => ({ 
        message: "Role type must be one of: chapterHead, secretary, treasurer, guardian, districtCoordinator, regionalCoordinator" 
      }),
    }),
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Check if chapter exists
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
  });
  if (!chapter) throw createError(404, "Chapter not found");

  // Check if member exists
  const member = await prisma.member.findUnique({
    where: { id: req.body.memberId },
  });
  if (!member) throw createError(404, "Member not found");

  // Check if role already assigned to someone else in this chapter
  const existingRole = await prisma.chapterRole.findFirst({
    where: {
      chapterId,
      roleType: req.body.roleType,
    },
  });

  // Get the current user making the change
  const performedById = req.user?.id;
  const performedByName = req.user?.name;

  // Handle role assignment and history tracking
  try {
    let role;
    let createdHistory;
    
    // Using sequential operations instead of transaction due to potential issues
    // with the prisma client in transaction mode
    
    if (existingRole) {
      // DO NOT close previous history records - we want to keep full history
      // Just create a new history record for the changed assignment
      
      // First, create a new history record for the changed assignment
      await prisma.$executeRawUnsafe(
        `INSERT INTO chapter_role_history 
        (roleId, memberId, action, performedById, performedByName, chapterId, roleType, startDate) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        existingRole.id,
        req.body.memberId,
        "reassigned", // Changed from 'assigned' to indicate it's a reassignment
        performedById || null,
        performedByName || null,
        chapterId,
        req.body.roleType
      );

      // Update the role assignment
      role = await prisma.chapterRole.update({
        where: { id: existingRole.id },
        data: { 
          memberId: req.body.memberId,
          updatedAt: new Date()
        },
      });
      
      // Set createdHistory to true to indicate success
      createdHistory = true;
    } else {
      // Create a new role assignment
      role = await prisma.chapterRole.create({
        data: {
          roleType: req.body.roleType,
          memberId: req.body.memberId,
          chapterId,
        },
      });

      // Create initial history record directly using Prisma $executeRawUnsafe
      // This bypasses potential issues with model recognition
      await prisma.$executeRawUnsafe(
        `INSERT INTO chapter_role_history 
        (roleId, memberId, action, performedById, performedByName, chapterId, roleType, startDate) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        role.id,
        req.body.memberId,
        "assigned",
        performedById || null,
        performedByName || null,
        chapterId,
        req.body.roleType
      );
      
      // Set createdHistory to true to indicate success
      createdHistory = true;
    }
    
    // Verify that both operations succeeded
    if (!role || !createdHistory) {
      throw new Error("Failed to complete role assignment process");
    }

    // Fetch the complete role info with member details for response
    const completeRole = await prisma.chapterRole.findUnique({
      where: { id: role.id },
      include: {
        member: {
          select: {
            id: true,
            memberName: true,
            email: true,
            mobile1: true,
          },
        },
      },
    });

    res.status(201).json(completeRole);
  } catch (error) {
    console.error("Error in role assignment:", error);
    throw createError(500, "Failed to assign role");
  }
});

/** DELETE /api/chapters/:chapterId/roles/:roleId
 * Remove a role assignment
 */
const removeChapterRole = asyncHandler(async (req, res) => {
  const chapterId = parseInt(req.params.chapterId);
  const roleId = parseInt(req.params.roleId);
  
  if (!chapterId) throw createError(400, "Invalid chapter ID");
  if (!roleId) throw createError(400, "Invalid role ID");

  const role = await prisma.chapterRole.findUnique({
    where: { id: roleId },
  });
  if (!role) throw createError(404, "Role assignment not found");
  if (role.chapterId !== chapterId) throw createError(400, "Role does not belong to the specified chapter");

  // Get the current user making the change
  const performedById = req.user?.id;
  const performedByName = req.user?.name;

  try {
    // Sequential operations instead of transaction to avoid Prisma model issues
    
    // DO NOT close previous history records - we want to keep full history
    // Just create a new history record for the removal

    // Create a history record for the removal using raw SQL
    await prisma.$executeRawUnsafe(
      `INSERT INTO chapter_role_history 
      (roleId, memberId, action, performedById, performedByName, chapterId, roleType, startDate) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      roleId,
      role.memberId,
      "removed",
      performedById || null,
      performedByName || null,
      chapterId,
      role.roleType
    );

    // Delete the role
    await prisma.chapterRole.delete({
      where: { id: roleId },
    });

    res.json({ message: "Role assignment removed successfully" });
  } catch (error) {
    console.error("Error removing role:", error);
    throw createError(500, "Failed to remove role");
  }
});

/** GET /api/members/:memberId/roles
 * Get all roles assigned to a specific member across chapters
 */
const getMemberRoles = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.memberId);
  if (!memberId) throw createError(400, "Invalid member ID");

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  if (!member) throw createError(404, "Member not found");

  const roles = await prisma.chapterRole.findMany({
    where: { memberId },
    include: {
      chapter: {
        select: {
          id: true,
          name: true,
          zoneId: true,
          zones: true,
        },
      },
    },
  });

  res.json(roles);
});

module.exports = {
  getChapters,
  createChapter,
  getChapterById,
  updateChapter,
  deleteChapter,
  getChapterRoles,
  assignChapterRole,
  removeChapterRole,
  getChapterRoleHistory,
  getMemberRoles,
};
