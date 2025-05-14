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
  date: z.string().refine(val => !isNaN(new Date(val).getTime()), {
    message: 'Invalid date format',
  }),
  chapterId: z.string().or(z.number()).transform(val => parseInt(val)),
  toWhom: z.string().min(1, 'To Whom is required'),
  amount: z.string().min(1, 'Amount is required'),
  narration: z.string().min(1, 'Narration is required'),
  testimony: z.string().min(1, 'Testimony is required'),
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
    
    const { referenceId, date, chapterId, toWhom, amount, narration, testimony } = validatedData;

    // Parse date
    const parsedDate = new Date(date);

    // Get the current user's member ID
    const userId = req.user.id;
    const member = await prisma.member.findFirst({
      where: { userId: userId },
      select: { id: true, chapterId: true, memberName: true }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found for current user' });
    }
    
    if (!member.id) {
      return res.status(400).json({ error: 'Invalid member ID provided' });
    }

    // Verify chapter exists
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
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

    // Construct thank you slip data
    const thankYouSlipData = {
      date: parsedDate,
      chapterId,
      toWhom,
      amount,
      narration,
      testimony
    };
    
    // Add the fromMemberId if we have it
    if (member && member.id) {
      thankYouSlipData.fromMemberId = member.id; // Store who created this slip
      console.log(`Adding member ID ${member.id} as sender`);
    } else {
      console.log('Creating thank you slip without sender ID');
    }

    // Only add referenceId if it exists
    if (referenceId) {
      thankYouSlipData.referenceId = referenceId;
    }

    const newThankYouSlip = await prisma.thankYouSlip.create({
      data: thankYouSlipData,
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
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
      // Thank you slips created by the user's chapter (given)
      where.chapterId = memberDetails.chapterId;
    } else if (type === 'received') {
      // Thank you slips where the user is the recipient (received)
      // Use exact match for the member name since case-insensitive contains is not supported
      where.toWhom = memberDetails.memberName;
    } else {
      // If type is 'all' or not specified, show thank you slips from user's chapter
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
            organizationName: true
          }
        }
      }
    });

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
