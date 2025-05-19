const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const createError = require("http-errors");

/**
 * Wrap async route handlers and funnel errors through Express error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Handle Prisma errors or other specific errors as needed
    if (err.name === "PrismaClientKnownRequestError" || err.name === "PrismaClientValidationError") {
      console.error("Prisma Error:", err.message);
      return res.status(400).json({ errors: { message: "Database error: " + err.message } });
    }
    if (err.status) {
      return res.status(err.status).json({ errors: { message: err.message } });
    }
    console.error("Unhandled Error:", err);
    return res.status(500).json({ errors: { message: "Internal Server Error" } });
  });
};

/**
 * GET /api/zones/:zoneId/chapters
 * Fetches all chapters belonging to a specific zone.
 */
const getChaptersByZone = asyncHandler(async (req, res) => {
  const zoneId = parseInt(req.params.zoneId);
  if (isNaN(zoneId)) {
    throw createError(400, "Invalid Zone ID.");
  }

  const chapters = await prisma.chapter.findMany({
    where: {
      zoneId: zoneId,
    },
    select: {
      // Select only the fields needed by the frontend ChapterOption interface
      id: true,
      name: true,
    },
  });

  if (!chapters) {
    // This case might not be strictly necessary if an empty array is acceptable
    // but good for clarity if a zone MUST have chapters or if zoneId itself is invalid
    // However, findMany returns [] if no records, not null.
    // So, a check for zone existence might be better if needed.
  }

  res.json({ chapters }); // Ensure the response is { chapters: [...] }
});

module.exports = {
  getChaptersByZone,
};
