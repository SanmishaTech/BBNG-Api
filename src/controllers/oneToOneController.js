const { PrismaClient } = require("@prisma/client");
const createError = require("http-errors");
const prisma = new PrismaClient();

// Parse integer helper function
const int = (v) => parseInt(v, 10);

/**
 * List one-to-one meetings with filtering options
 */
const listOneToOnes = async (req, res, next) => {
  try {
    let {
      page = 1,
      limit = 10,
      requesterId,
      requestedId,
      status,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    const where = {};
    
    // Filter by requester (the member who requested the one-to-one)
    if (requesterId) {
      where.requesterId = int(requesterId);
    }
    
    // Filter by requested (the member who was requested for one-to-one)
    if (requestedId) {
      where.requestedId = int(requestedId);
    }
    
    // Filter by status
    if (status) {
      where.status = status;
    }

    const skip = (int(page) - 1) * int(limit);
    const total = await prisma.oneToOne.count({ where });

    const oneToOnes = await prisma.oneToOne.findMany({
      where,
      skip,
      take: int(limit),
      orderBy: { [sortBy]: sortOrder },
      include: {
        requester: {
          select: {
            id: true,
            memberName: true,
            email: true,
            organizationName: true,
          },
        },
        requested: {
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
      },
    });

    res.json({
      oneToOnes,
      page: int(page),
      totalPages: Math.ceil(total / int(limit)),
      total,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a single one-to-one by ID
 */
const getOneToOneById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const oneToOne = await prisma.oneToOne.findUnique({
      where: { id: int(id) },
      include: {
        requester: {
          select: {
            id: true,
            memberName: true,
            email: true,
            organizationName: true,
          },
        },
        requested: {
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
      },
    });

    if (!oneToOne) {
      return next(createError(404, "One-to-One meeting not found"));
    }

    res.json({ oneToOne });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new one-to-one meeting
 */
const createOneToOne = async (req, res, next) => {
  try {
    const {
      date,
      requestedId,
      chapterId,
      remarks,
      status = "pending",
    } = req.body;

    // Validate required fields
    if (!date || !requestedId || !chapterId) {
      return next(createError(400, "Missing required fields"));
    }

    // Check if the current user has a corresponding member record
    const member = await prisma.member.findFirst({
      where: { userId: req.user.id }
    });

    if (!member) {
      return next(createError(400, "Current user does not have a corresponding member record. Cannot create one-to-one meeting."));
    }

    // Create the one-to-one meeting
    const oneToOne = await prisma.oneToOne.create({
      data: {
        date: new Date(date),
        requesterId: member.id,
        requestedId: int(requestedId),
        chapterId: int(chapterId),
        remarks,
        status,
      },
    });

    res.status(201).json({ oneToOne });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing one-to-one meeting
 */
const updateOneToOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      date,
      requestedId,
      chapterId,
      remarks,
      status,
    } = req.body;

    // Check if one-to-one exists
    const existingOneToOne = await prisma.oneToOne.findUnique({
      where: { id: int(id) },
    });

    if (!existingOneToOne) {
      return next(createError(404, "One-to-One meeting not found"));
    }

    // Update the one-to-one meeting
    const updated = await prisma.oneToOne.update({
      where: { id: int(id) },
      data: {
        ...(date && { date: new Date(date) }),
        ...(requestedId && { requestedId: int(requestedId) }),
        ...(chapterId && { chapterId: int(chapterId) }),
        ...(remarks !== undefined && { remarks }),
        ...(status && { status }),
      },
    });

    res.json({ oneToOne: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Update the status of a one-to-one meeting
 */
const updateOneToOneStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ["pending", "accepted", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return next(createError(400, "Invalid status value"));
    }

    // Check if one-to-one exists
    const existingOneToOne = await prisma.oneToOne.findUnique({
      where: { id: int(id) },
    });

    if (!existingOneToOne) {
      return next(createError(404, "One-to-One meeting not found"));
    }

    // Update status
    const updated = await prisma.oneToOne.update({
      where: { id: int(id) },
      data: { status },
    });

    res.json({ oneToOne: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a one-to-one meeting
 */
const deleteOneToOne = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if one-to-one exists
    const existingOneToOne = await prisma.oneToOne.findUnique({
      where: { id: int(id) },
    });

    if (!existingOneToOne) {
      return next(createError(404, "One-to-One meeting not found"));
    }

    // Delete the one-to-one meeting
    await prisma.oneToOne.delete({
      where: { id: int(id) },
    });

    res.json({ message: "One-to-One meeting deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Get received one-to-one requests for a member
 */
const getReceivedOneToOnes = async (req, res, next) => {
  try {
    let {
      memberId,
      page = 1,
      limit = 10,
      status,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    if (!memberId) {
      return next(createError(400, "Member ID is required"));
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const parsedMemberId = parseInt(memberId, 10);

    const where = {
      requestedId: parsedMemberId,
    };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Count total one-to-ones with the filter
    const totalOneToOnes = await prisma.oneToOne.count({ where });

    // Fetch the one-to-ones with pagination, sorting, and filtering
    const oneToOnes = await prisma.oneToOne.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: {
        [sortBy.trim()]: sortOrder.trim(),
      },
      include: {
        requester: {
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
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalOneToOnes / parsedLimit);

    res.json({
      oneToOnes,
      page: parsedPage,
      totalPages,
      totalOneToOnes,
    });
  } catch (error) {
    console.error("Error in getReceivedOneToOnes:", error);
    next(error);
  }
};

/**
 * Get requested one-to-one meetings by a member
 */
const getRequestedOneToOnes = async (req, res, next) => {
  try {
    let {
      memberId,
      page = 1,
      limit = 10,
      status,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    if (!memberId) {
      return next(createError(400, "Member ID is required"));
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const parsedMemberId = parseInt(memberId, 10);

    const where = {
      requesterId: parsedMemberId,
    };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Count total one-to-ones with the filter
    const totalOneToOnes = await prisma.oneToOne.count({ where });

    // Fetch the one-to-ones with pagination, sorting, and filtering
    const oneToOnes = await prisma.oneToOne.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: {
        [sortBy.trim()]: sortOrder.trim(),
      },
      include: {
        requested: {
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
      },
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalOneToOnes / parsedLimit);

    res.json({
      oneToOnes,
      page: parsedPage,
      totalPages,
      totalOneToOnes,
    });
  } catch (error) {
    console.error("Error in getRequestedOneToOnes:", error);
    next(error);
  }
};

module.exports = {
  listOneToOnes,
  getOneToOneById,
  createOneToOne,
  updateOneToOne,
  updateOneToOneStatus,
  deleteOneToOne,
  getReceivedOneToOnes,
  getRequestedOneToOnes,
}; 