const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const createError = require("http-errors");

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
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

  // === START NEW VALIDATION ===
  const { roleType } = req.body;
  const restrictedRoles = ["chapterHead", "secretary", "treasurer"];

  if (restrictedRoles.includes(roleType)) {
    if (member.chapterId !== chapterId) { // chapterId is from req.params
      return res.status(400).json({
        errors: {
          message: `For role '${roleType}', the member must belong to the same chapter.`,
        },
      });
    }
  }
  // === END NEW VALIDATION ===

  // Check if role already assigned to someone else in this chapter
  const existingRole = await prisma.chapterRole.findFirst({
    where: {
      chapterId,
      roleType: req.body.roleType,
    },
  });

  // If role exists, update it; otherwise create a new one
  let role;
  if (existingRole) {
    role = await prisma.chapterRole.update({
      where: { id: existingRole.id },
      data: { 
        memberId: req.body.memberId,
        updatedAt: new Date()
      },
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
  } else {
    role = await prisma.chapterRole.create({
      data: {
        roleType: req.body.roleType,
        memberId: req.body.memberId,
        chapterId,
      },
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
  }

  res.status(201).json(role);
});

/** DELETE /api/chapters/:chapterId/roles/:roleId
 * Remove a role assignment
 */
const removeChapterRole = asyncHandler(async (req, res) => {
  const roleId = parseInt(req.params.roleId);
  if (!roleId) throw createError(400, "Invalid role ID");

  const role = await prisma.chapterRole.findUnique({
    where: { id: roleId },
  });
  if (!role) throw createError(404, "Role assignment not found");

  await prisma.chapterRole.delete({
    where: { id: roleId },
  });

  res.json({ message: "Role assignment removed successfully" });
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
  getChapterRoles,
  assignChapterRole,
  removeChapterRole,
  getMemberRoles,
};
