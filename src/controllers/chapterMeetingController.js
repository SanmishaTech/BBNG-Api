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

/** GET /api/chapter-meetings
 * List chapter meetings (pagination, filters, sort)
 */
const getChapterMeetings = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 10);
  const skip = (page - 1) * limit;

  const { search = "", chapterId } = req.query;
  const sortBy = req.query.sortBy || "date";
  const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

  const filters = [];
  if (search) {
    filters.push({
      OR: [
        { meetingTitle: { contains: search } },
        { meetingVenue: { contains: search } },
      ],
    });
  }
  if (chapterId) {
    filters.push({
      chapterId: parseInt(chapterId),
    });
  }
  const where = filters.length ? { AND: filters } : {};

  const [meetings, total] = await Promise.all([
    prisma.chapterMeeting.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: { chapter: true },
    }),
    prisma.chapterMeeting.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    meetings,
    page,
    totalPages,
    totalMeetings: total,
  });
});

/** POST /api/chapter-meetings
 * Create a new chapter meeting
 */
const createChapterMeeting = asyncHandler(async (req, res) => {
  // Get the member associated with the logged-in user to find their chapter
  const member = await prisma.member.findFirst({
    where: { userId: req.user.id },
    select: { chapterId: true }
  });

  if (!member || !member.chapterId) {
    throw createError(400, "No chapter associated with your account");
  }

  // Use the chapter ID from the member record
  const chapterId = member.chapterId;

  const schema = z.object({
    date: z.preprocess(
      (v) => new Date(v),
      z.date({ required_error: "Date is required" })
    ),
    meetingTime: z.string().min(1, "Meeting time is required").max(50),
    meetingTitle: z.string().min(1, "Meeting title is required").max(255),
    meetingVenue: z.string().min(1, "Meeting venue is required").max(255),
  }).superRefine(async (data, ctx) => {
    // Verify the chapter exists (using the one from the member)
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) {
      ctx.addIssue({
        message: `Your associated chapter (ID: ${chapterId}) does not exist`,
        code: z.ZodIssueCode.custom,
      });
    }
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Add the chapter ID from the member to the request data
  const meeting = await prisma.chapterMeeting.create({
    data: { 
      ...req.body, 
      date: new Date(req.body.date),
      chapterId: chapterId  // Use the chapter ID from the member
    },
    include: { chapter: true },
  });
  res.status(201).json(meeting);
});

/** GET /api/chapter-meetings/:id
 * Retrieve a chapter meeting
 */
const getChapterMeetingById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid meeting ID");

  const meeting = await prisma.chapterMeeting.findUnique({
    where: { id },
    include: { chapter: true },
  });
  if (!meeting) throw createError(404, "Meeting not found");

  res.json(meeting);
});

/** PUT /api/chapter-meetings/:id
 * Update a chapter meeting
 */
const updateChapterMeeting = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid meeting ID");

  // Get the member associated with the logged-in user to find their chapter
  const member = await prisma.member.findFirst({
    where: { userId: req.user.id },
    select: { chapterId: true }
  });

  if (!member || !member.chapterId) {
    throw createError(400, "No chapter associated with your account");
  }

  // Use the chapter ID from the member record
  const chapterId = member.chapterId;

  // Verify user is updating a meeting from their own chapter
  const meeting = await prisma.chapterMeeting.findUnique({ 
    where: { id },
    select: { chapterId: true }
  });
  
  if (!meeting) {
    throw createError(404, "Meeting not found");
  }
  
  if (meeting.chapterId !== chapterId) {
    throw createError(403, "You can only update meetings for your own chapter");
  }

  const schema = z.object({
    date: z.preprocess(
      (v) => (v ? new Date(v) : undefined),
      z.date().optional()
    ),
    meetingTime: z.string().min(1).max(50).optional(),
    meetingTitle: z.string().min(1).max(255).optional(),
    meetingVenue: z.string().min(1).max(255).optional(),
    // chapterId field removed as it's determined from the user's membership
  }).refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

  const valid = await validateRequest(schema, req.body, res);
  if (!valid) return;

  // Don't allow changing the chapterId - ensure it stays with the user's chapter
  const dataToUpdate = { ...req.body };
  delete dataToUpdate.chapterId; // Remove chapterId if it was included in the request

  const updated = await prisma.chapterMeeting.update({
    where: { id },
    data: dataToUpdate,
    include: { chapter: true },
  });
  res.json(updated);
});

/** DELETE /api/chapter-meetings/:id
 * Delete a chapter meeting
 */
const deleteChapterMeeting = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw createError(400, "Invalid meeting ID");

  const existing = await prisma.chapterMeeting.findUnique({ where: { id } });
  if (!existing) throw createError(404, "Meeting not found");

  await prisma.chapterMeeting.delete({ where: { id } });
  res.json({ message: "Meeting deleted successfully" });
});

module.exports = {
  getChapterMeetings,
  createChapterMeeting,
  getChapterMeetingById,
  updateChapterMeeting,
  deleteChapterMeeting,
};