const prisma = require("../config/db");
const { z } = require("zod");
const createError = require("http-errors");
const validateRequest = require("../utils/validateRequest");

// Zod schema
const requirementSchema = z.object({
  memberId: z.number().int().positive(),
  heading: z.string().min(1, "Heading is required"),
  requirement: z.string().min(1, "Requirement is required"),
});

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create Requirement
exports.createRequirement = asyncHandler(async (req, res) => {
  const parsedData = await validateRequest(requirementSchema, req.body);
  if (!parsedData) return;
  const newReq = await prisma.requirement.create({ data: parsedData });
  res.status(201).json(newReq);
});

// Get requirements for member
exports.getRequirementsByMember = asyncHandler(async (req, res) => {
  const memberId = parseInt(req.params.memberId, 10);
  if (isNaN(memberId)) throw createError(400, "Invalid memberId");
  const list = await prisma.requirement.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
  });
  res.json(list);
});

// Get all requirements
exports.getAllRequirements = asyncHandler(async (req, res) => {
  const requirements = await prisma.requirement.findMany({
    include: {
      member: {
        select: {
          id: true,
          memberName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(requirements);
});

// Delete requirement
exports.deleteRequirement = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw createError(400, "Invalid id");
  await prisma.requirement.delete({ where: { id } });
  res.json({ message: "Requirement deleted" });
});
