const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const validateRequest  = require('../utils/validateRequest');
const { z } = require('zod');

// Get user's chapters
exports.getUserChapters = async (req, res) => {
  try {
    // Get the current user's member ID
    const userId = req.user.id;
    const member = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true, chapterId: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }

    // Get the chapter details
    const chapter = await prisma.chapter.findUnique({
      where: { id: member.chapterId },
      select: {
        id: true,
        name: true,
        members: {
          select: {
            id: true,
            memberName: true
          }
        }
      }
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found for this member' });
    }

    res.status(200).json({ chapter });
  } catch (error) {
    console.error('Error fetching user\'s chapter:', error);
    res.status(500).json({ error: 'Failed to fetch chapter details' });
  }
};

// Get all chapters
exports.getAllChapters = async (req, res) => {
  try {
    const chapters = await prisma.chapter.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      },
    });

    res.status(200).json({ chapters });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
};

// Get members by chapter ID
exports.getMembersByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    if (!chapterId) {
      return res.status(400).json({ error: 'Chapter ID is required' });
    }

    const members = await prisma.member.findMany({
      where: { 
        chapterId: parseInt(chapterId),
        active: true 
      },
      select: {
        id: true,
        memberName: true,
        organizationName: true,
      },
      orderBy: {
        memberName: 'asc'
      },
    });

    res.status(200).json({ members });
  } catch (error) {
    console.error('Error fetching members by chapter:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

// Thank you slip validation schema
const thankYouSlipSchema = z.object({
  referenceId: z.string().or(z.number()).transform(val => parseInt(val)).optional(),
  date: z.string().transform(str => new Date(str)).refine(dt => dt instanceof Date && !isNaN(dt.valueOf()), {
    message: 'Invalid date format. Please provide a valid date string.',
  }),
  chapterId: z.string().or(z.number()).transform(val => parseInt(val)).optional(),
  toWhom: z.string().optional(), // Made optional, allows empty string if provided
  toWhomId: z.string().or(z.number()).transform(val => parseInt(val)).optional(),
  amount: z.string().min(1, 'Amount is required'), // Amount remains required and non-empty
  narration: z.string().optional(), // Made optional, allows empty string if provided
  testimony: z.string().optional(), // Made optional, allows empty string if provided
});

// Create a new thank you slip
exports.createThankYouSlip = async (req, res) => {
  try {
    // Validate request data
    const validatedData = await validateRequest(thankYouSlipSchema, req.body,res);
    
    // If validation returned errors
    if (validatedData.type === 'validation') {
      return res.status(400).json({ errors: validatedData });
    }
    
    const { referenceId, date, chapterId, toWhom, toWhomId, amount, narration, testimony } = validatedData;

    // Additional explicit checks for critical fields
    const fieldErrors = {};
    if (!(date instanceof Date) || isNaN(date.valueOf())) {
      fieldErrors.date = 'Date is invalid or could not be processed correctly.';
    }
    if (validatedData.toWhom !== undefined && typeof validatedData.toWhom !== 'string') { // Check type if provided
      fieldErrors.toWhom = 'If To Whom is provided, it must be a string.';
    }
    if (typeof amount !== 'string' || amount.trim() === '') { // Amount remains strictly checked
      fieldErrors.amount = 'Amount is required and must be a non-empty string.';
    }
    if (validatedData.narration !== undefined && typeof validatedData.narration !== 'string') { // Check type if provided
      fieldErrors.narration = 'If Narration is provided, it must be a string.';
    }
    if (validatedData.testimony !== undefined && typeof validatedData.testimony !== 'string') { // Check type if provided
      fieldErrors.testimony = 'If Testimony is provided, it must be a string.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: "Validation failed due to invalid field data", errors: fieldErrors });
    }

    // 'date' is already a Date object due to Zod transform if validation passed
    const parsedDate = date;

    // Get the current user's member ID
    const userId = req.user.id;
    const member = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }

    // Verify chapter exists, only if chapterId is provided
    if (chapterId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
      });

      if (!chapter) {
        return res.status(404).json({ error: 'Chapter not found' });
      }
    }

    let reference = null;
    let previousThankYouSlips = [];

    // If referenceId is provided, verify reference exists
    if (referenceId) {
      reference = await prisma.reference.findUnique({
        where: { id: referenceId },
        include: {
          giver: {
            select: {
              id: true,
              memberName: true,
            }
          },
          receiver: {
            select: {
              id: true,
              memberName: true,
            }
          }
        }
      });

      if (!reference) {
        return res.status(404).json({ error: 'Reference not found' });
      }
      
      // Get history of thank you slips for this reference
      previousThankYouSlips = await prisma.thankYouSlip.findMany({
        where: { referenceId },
        orderBy: { createdAt: 'desc' },
        include: {
          chapter: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });
    }

    // Determine the true giver and receiver for the thank you slip
    let slipGiverMemberId;
    let slipReceiverMemberId;
    let slipReceiverName;
    let slipAmount = amount; // Default to form amount
    let slipNarration = narration; // Default to form narration
    let slipTestimony = testimony; // Default to form testimony

    if (referenceId && reference) { // This is a "Done Deal" slip tied to a reference
      if (!reference.giver || !reference.receiver) {
        return res.status(404).json({ error: 'Reference giver or receiver not found for the Done Deal.' });
      }
      slipGiverMemberId = reference.giver.id;
      slipReceiverMemberId = reference.receiver.id;
      slipReceiverName = reference.receiver.memberName;
      // For Done Deals, you might have specific logic for amount, narration, testimony
      // For now, we'll still use the values from the form (validatedData)
      // If these should also come from the reference or have defaults, that logic would be added here.
    } else { // This is a direct thank you slip
      slipGiverMemberId = member.id; // Logged-in user is the giver
      slipReceiverMemberId = toWhomId; // From form input
      slipReceiverName = toWhom;     // From form input
    }

    // Create the thank you slip data object
    const thankYouSlipData = {
      date: parsedDate,
      fromMemberId: slipGiverMemberId,
      toWhom: slipReceiverName,
      toWhomId: slipReceiverMemberId,
      amount: slipAmount,
      narration: slipNarration,
      testimony: slipTestimony,
    };

    // Only add referenceId if it exists (it will if it's a Done Deal)
    if (referenceId) {
      thankYouSlipData.referenceId = referenceId;
    }

    // Only add chapterId if it exists (relevant if schema makes it optional)
    if (chapterId) {
      thankYouSlipData.chapterId = chapterId;
    }

    const newThankYouSlip = await prisma.thankYouSlip.create({
      data: thankYouSlipData,
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
          }
        },
        fromMember: {
          select: {
            id: true,
            memberName: true,
          }
        }
      }
    });

    res.status(201).json({
      thankYouSlip: newThankYouSlip,
      reference,
      previousThankYouSlips
    });
  } catch (error) {
    console.error('Error creating thank you slip:', error);
    res.status(500).json({ error: 'Failed to create thank you slip' });
  }
};

// Get all thank you slips with type filter (given, received, or all)
exports.getAllThankYouSlips = async (req, res) => {
  try {
    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type || 'all'; // 'given', 'received', or 'all'

    // Filter setup
    const where = {};

    // Get user's member profile
    const userId = req.user.id;
    const member = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true, chapterId: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }
    
    // Get the member's details for filtering
    const memberDetails = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true, chapterId: true, memberName: true }
    });
    
    if (!memberDetails) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }
    
    // Apply different filtering based on the type
    if (type === 'given') {
      // Thank you slips created by the user (given)
      where.fromMemberId = memberDetails.id;
    } else if (type === 'received') {
      // Thank you slips where the user is the recipient (received)
      // This branch might be superseded by getReceivedThankYouSlips, but let's correct it too.
      where.toWhomId = memberDetails.id;
    } else {
      // If type is 'all' or not specified, show thank you slips from user's chapter
      // This 'all' logic might need review based on desired behavior.
      // For now, it remains filtering by chapterId.
      where.chapterId = memberDetails.chapterId;
    }

    // Get thank you slips with pagination
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        reference: {
          select: {
            id: true,
            nameOfReferral: true,
            status: true,
            giver: {
              select: {
                id: true,
                memberName: true
              }
            },
            receiver: {
              select: {
                id: true,
                memberName: true
              }
            }
          }
        },
        chapter: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.thankYouSlip.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      thankYouSlips,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
      }
    });
  } catch (error) {
    console.error('Error getting thank you slips:', error);
    res.status(500).json({ error: 'Failed to get thank you slips' });
  }
};

// Get thank you slips given by the user's chapter
exports.getGivenThankYouSlips = async (req, res) => {
  try {
    // Redirect to the main endpoint with the 'given' filter
    req.query.type = 'given';
    return await exports.getAllThankYouSlips(req, res);
  } catch (error) {
    console.error('Error getting given thank you slips:', error);
    res.status(500).json({ error: 'Failed to get given thank you slips' });
  }
};

// Get thank you slips received by the current user
exports.getReceivedThankYouSlips = async (req, res) => {
  try {
    // Pagination setup
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get user's member profile
    const userId = req.user.id;
    const member = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true, chapterId: true, memberName: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }
    
    // Filter for thank you slips where the user is the recipient
    const where = {
      toWhom: member.memberName,
    };

    // Get received thank you slips with pagination
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        reference: {
          select: {
            id: true,
            nameOfReferral: true,
            status: true,
            giver: {
              select: {
                id: true,
                memberName: true,
              }
            },
            receiver: {
              select: {
                id: true,
                memberName: true,
              }
            }
          }
        },
        chapter: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.thankYouSlip.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      thankYouSlips,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
      }
    });
  } catch (error) {
    console.error('Error getting received thank you slips:', error);
    res.status(500).json({ error: 'Failed to get received thank you slips' });
  }
};

// Get a specific thank you slip by ID
exports.getThankYouSlipById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if the thank you slip exists
    const thankYouSlipCheck = await prisma.thankYouSlip.findUnique({
      where: { id: parseInt(id) },
      select: { id: true }
    });

    if (!thankYouSlipCheck) {
      return res.status(404).json({ error: 'Thank you slip not found' });
    }
    
    // Get the thank you slip with all necessary data
    const thankYouSlip = await prisma.thankYouSlip.findUnique({
      where: { id: parseInt(id) },
      include: {
        reference: {
          select: {
            id: true,
            nameOfReferral: true,
            status: true,
            giver: {
              select: {
                id: true,
                memberName: true,
              }
            },
            receiver: {
              select: {
                id: true,
                memberName: true,
              }
            }
          }
        },
        chapter: {
          select: {
            id: true,
            name: true,
          }
        },
        fromMember: {
          select: {
            id: true,
            memberName: true,
          }
        }
      }
    });

    // If toWhomId exists, fetch the member data
    if (thankYouSlip.toWhomId) {
      const toWhomMember = await prisma.member.findUnique({
        where: { id: thankYouSlip.toWhomId },
        select: {
          id: true,
          memberName: true,
        }
      });
      
      // Attach to the response
      if (toWhomMember) {
        thankYouSlip.toWhomMember = toWhomMember;
      }
    }

    // Return the thank you slip with chapter info
    res.status(200).json(thankYouSlip);
  } catch (error) {
    console.error('Error getting thank you slip:', error);
    res.status(500).json({ error: 'Failed to get thank you slip' });
  }
};

// Get thank you slips for a specific reference
exports.getThankYouSlipsForReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    
    // Find the reference to include details
    const reference = await prisma.reference.findUnique({
      where: { id: parseInt(referenceId) },
      include: {
        giver: {
          select: {
            id: true,
            memberName: true,
          }
        },
        receiver: {
          select: {
            id: true,
            memberName: true,
          }
        }
      }
    });

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where: { referenceId: parseInt(referenceId) },
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    res.status(200).json({
      thankYouSlips,
      reference
    });
  } catch (error) {
    console.error('Error getting thank you slips for reference:', error);
    res.status(500).json({ error: 'Failed to get thank you slips for reference' });
  }
};

// Update thank you slip validation schema
const updateThankYouSlipSchema = z.object({
  date: z.string().optional().refine(val => !val || !isNaN(new Date(val).getTime()), {
    message: 'Invalid date format',
  }),
  amount: z.string().optional(),
  narration: z.string().optional(),
  testimony: z.string().optional(),
});

// Update a thank you slip
exports.updateThankYouSlip = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request data
    const validatedData = await validateRequest(updateThankYouSlipSchema, req.body);
    
    // If validation returned errors
    if (validatedData.type === 'validation') {
      return res.status(400).json({ errors: validatedData });
    }
    
    const { date, amount, narration, testimony } = validatedData;

    // Find the thank you slip
    const thankYouSlip = await prisma.thankYouSlip.findUnique({
      where: { id: parseInt(id) },
    });

    if (!thankYouSlip) {
      return res.status(404).json({ error: 'Thank you slip not found' });
    }

    // Parse date if provided
    let parsedDate;
    if (date) {
      parsedDate = new Date(date);
    }

    // Update the thank you slip
    const updatedThankYouSlip = await prisma.thankYouSlip.update({
      where: { id: parseInt(id) },
      data: {
        ...(date && { date: parsedDate }),
        ...(amount && { amount }),
        ...(narration && { narration }),
        ...(testimony && { testimony }),
      },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
          }
        },
        reference: {
          include: {
            giver: {
              select: {
                id: true,
                memberName: true,
              }
            },
            receiver: {
              select: {
                id: true,
                memberName: true,
              }
            }
          }
        }
      }
    });

    res.status(200).json(updatedThankYouSlip);
  } catch (error) {
    console.error('Error updating thank you slip:', error);
    res.status(500).json({ error: 'Failed to update thank you slip' });
  }
};

// Delete a thank you slip
exports.deleteThankYouSlip = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the thank you slip
    const thankYouSlip = await prisma.thankYouSlip.findUnique({
      where: { id: parseInt(id) },
    });

    if (!thankYouSlip) {
      return res.status(404).json({ error: 'Thank you slip not found' });
    }

    // Delete the thank you slip
    await prisma.thankYouSlip.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: 'Thank you slip deleted successfully' });
  } catch (error) {
    console.error('Error deleting thank you slip:', error);
    res.status(500).json({ error: 'Failed to delete thank you slip' });
  }
};
