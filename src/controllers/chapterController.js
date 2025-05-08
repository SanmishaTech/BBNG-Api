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
      monthlyVenue: z.number().int().nonnegative(),
      quarterlyVenue: z.number().int().nonnegative(),
      halfYearlyVenue: z.number().int().nonnegative(),
      yearlyVenue: z.number().int().nonnegative(),
      earlybirdVenue: z.number().int().nonnegative(),
      quarterlyHo: z.number().int().nonnegative(),
      halfyearlyHo: z.number().int().nonnegative(),
      yearlyHo: z.number().int().nonnegative(),
      earlybirdHo: z.number().int().nonnegative(),
      bankopeningbalance: z.number().int(),
      bankclosingbalance: z.number().int(),
      cashopeningbalance: z.number().int(),
      cashclosingbalance: z.number().int(),
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
      monthlyVenue: z.number().int().nonnegative().optional(),
      quarterlyVenue: z.number().int().nonnegative().optional(),
      halfYearlyVenue: z.number().int().nonnegative().optional(),
      yearlyVenue: z.number().int().nonnegative().optional(),
      earlybirdVenue: z.number().int().nonnegative().optional(),
      quarterlyHo: z.number().int().nonnegative().optional(),
      halfyearlyHo: z.number().int().nonnegative().optional(),
      yearlyHo: z.number().int().nonnegative().optional(),
      earlybirdHo: z.number().int().nonnegative().optional(),
      bankopeningbalance: z.number().int().optional(),
      bankclosingbalance: z.number().int().optional(),
      cashopeningbalance: z.number().int().optional(),
      cashclosingbalance: z.number().int().optional(),
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

module.exports = {
  getChapters,
  createChapter,
  getChapterById,
  updateChapter,
  deleteChapter,
};
