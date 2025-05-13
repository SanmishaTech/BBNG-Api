const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const validateRequest  = require('../utils/validateRequest');
const { z } = require('zod');

// Thank you slip validation schema
const thankYouSlipSchema = z.object({
  referenceId: z.string().or(z.number()).transform(val => parseInt(val)),
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

    // Verify reference exists
    const reference = await prisma.reference.findUnique({
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

    // Verify chapter exists
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Get history of thank you slips for this reference
    const previousThankYouSlips = await prisma.thankYouSlip.findMany({
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

    // Create the thank you slip
    const newThankYouSlip = await prisma.thankYouSlip.create({
      data: {
        date: parsedDate,
        referenceId,
        chapterId,
        toWhom,
        amount,
        narration,
        testimony,
      },
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
    })
  } catch (error) {
    console.error('Error creating thank you slip:', error);
    res.status(500).json({ error: 'Failed to create thank you slip' });
  }
};

// Get all thank you slips
exports.getAllThankYouSlips = async (req, res) => {
  try {
    const { page = 1, limit = 10, chapterId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {};
    if (chapterId) {
      where.chapterId = parseInt(chapterId);
    }

    // Get thank you slips with pagination
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
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

    // Get total count
    const totalCount = await prisma.thankYouSlip.count({ where });
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      thankYouSlips,
      totalCount,
      totalPages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Error getting thank you slips:', error);
    res.status(500).json({ error: 'Failed to get thank you slips' });
  }
};

// Get a specific thank you slip by ID
exports.getThankYouSlipById = async (req, res) => {
  try {
    const { id } = req.params;
    
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
        }
      }
    });

    if (!thankYouSlip) {
      return res.status(404).json({ error: 'Thank you slip not found' });
    }

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
