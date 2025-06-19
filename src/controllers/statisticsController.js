const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

 
/**
 * Get total amount from thank you slips
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date for filtering
 * @param {Date} [options.endDate] - End date for filtering
 * @returns {Promise<Object>} Total amount statistics
 */
const getBusinessGenerated = async (options = {}) => {
  try {
    const { startDate, endDate } = options;
    
    let whereClause = {};
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }
    
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where: whereClause
    });
    
    const totalAmount = thankYouSlips.reduce((sum, slip) => {
      // Convert string amount to number, removing any non-numeric characters except decimal point
      const numericAmount = parseFloat(slip.amount.replace(/[^0-9.]/g, '')) || 0;
      return sum + numericAmount;
    }, 0);
    
    return {
      total: totalAmount,
      count: thankYouSlips.length,
      // slips: thankYouSlips
    };
  } catch (error) {
    // console.error('Error in getThankYouSlipsTotal:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get total count of references
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date for filtering
 * @param {Date} [options.endDate] - End date for filtering
 * @returns {Promise<Object>} Total reference count statistics
 */
const getReferencesCount = async (options = {}) => {
  try {
    const { startDate, endDate } = options;
    
    let whereClause = {};
    
    // if (startDate || endDate) {
    //   whereClause.date = {};
    //   if (startDate) whereClause.date.gte = startDate;
    //   if (endDate) whereClause.date.lte = endDate;
    // }
    
    const count = await prisma.reference.count({
      where: whereClause
    });
    
    return {
      total: count
    };
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};


/**
 * Get total count of references
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date for filtering
 * @param {Date} [options.endDate] - End date for filtering
 * @returns {Promise<Object>} Total visitors statistics
 */
const getTotalVisitors = async (options = {}) => {
  try {
    const { startDate, endDate } = options;
    
    let whereClause = {};
    
    // if (startDate || endDate) {
    //   whereClause.date = {};
    //   if (startDate) whereClause.date.gte = startDate;
    //   if (endDate) whereClause.date.lte = endDate;
    // }
    
    const count = await prisma.visitor.count({
      where: whereClause
    });
    
    return {
      total: count
    };
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};


const getOneToOne = async (options = {}) => {
  try {
    // const { startDate, endDate } = options;
    
    let whereClause = {
      status: "accepted" // Only count one-to-ones with "accepted" status
    };
    
    // if (startDate || endDate) {
    //   whereClause.date = {};
    //   if (startDate) whereClause.date.gte = startDate;
    //   if (endDate) whereClause.date.lte = endDate;
    // }
    
    const count = await prisma.oneToOne.count({
      where: whereClause
    });
    
    return {
      total: count
    };
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get count of references given by a specific member
 * @param {Object} options - Query options
 * @param {number} options.memberId - Member ID to count references for
 * @returns {Promise<Object>} Count of references given by the member
 */
const getMemberGivenReferences = async (options = {}) => {
  try {
    const { memberId } = options;
    
    if (!memberId) {
      throw new Error('Member ID is required');
    }
    
    const count = await prisma.reference.count({
      where: {
        giverId: parseInt(memberId)
      }
    });
    
    return {
      total: count
    };
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};


/**
 * Get count of references given by a specific member
 * @param {Object} options - Query options
 * @param {number} options.memberId - Member ID to count references for
 * @returns {Promise<Object>} Count of references given by the member
 */
const getMemberReceivedReferences = async (options = {}) => {
  try {
    const { memberId } = options;
    
    if (!memberId) {
      throw new Error('Member ID is required');
    }
    
    const count = await prisma.reference.count({
      where: {
        receiverId: parseInt(memberId)
      }
    });
    
    return {
      total: count
    };
  } catch (error) {
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

 
/**
 * Get total amount from thank you slips for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to get thank you slips for
 * @returns {Promise<Object>} Total amount statistics for the chapter
 */
const getChapterBusinessGenerated = async (options = {}) => {
  try {
    const { chapterId } = options;

    if (!chapterId) {
      throw new Error('Chapter ID is required');
    }

    // Find all thankYouSlips directly by chapterId
    const thankYouSlips = await prisma.thankYouSlip.findMany({
      where: {
        chapterId: parseInt(chapterId)
      },
      select: {
        amount: true
      }
    });

    // Sum the amounts
    const totalAmount = thankYouSlips.reduce((sum, slip) => {
      const numericAmount = parseFloat(slip.amount?.replace(/[^0-9.]/g, '')) || 0;
      return sum + numericAmount;
    }, 0);

    return {
      total: totalAmount,
      count: thankYouSlips.length
    };
  } catch (error) {
    console.error('Error in getChapterBusinessGenerated:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};





/**
 * Get count of references for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to count references for
 * @returns {Promise<Object>} Count of references for the chapter
 */
const getChapterReferencesCount = async (options = {}) => {
  try {
    const { chapterId } = options;
    
    if (!chapterId) {
      throw new Error('Chapter ID is required');
    }
    
    const count = await prisma.reference.count({
      where: {
        chapterId: parseInt(chapterId)
      }
    });
    
    return {
      total: count
    };
  } catch (error) {
    console.error('Error in getChapterReferencesCount:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get count of visitors for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to count visitors for
 * @returns {Promise<Object>} Count of visitors for the chapter
 */
const getChapterVisitorsCount = async (options = {}) => {
  try {
    const { chapterId } = options;
    
    if (!chapterId) {
      throw new Error('Chapter ID is required');
    }
    
    const count = await prisma.visitor.count({
      where: {
        chapterId: parseInt(chapterId)
      }
    });
    
    return {
      total: count
    };
  } catch (error) {
    console.error('Error in getChapterVisitorsCount:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get count of one-to-one meetings for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to count one-to-one meetings for
 * @returns {Promise<Object>} Count of one-to-one meetings for the chapter
 */
const getChapterOneToOneCount = async (options = {}) => {
  try {
    const { chapterId } = options;
    
    if (!chapterId) {
      throw new Error('Chapter ID is required');
    }
    
    const count = await prisma.oneToOne.count({
      where: {
        chapterId: parseInt(chapterId),
        status: "accepted" // Only count one-to-ones with "accepted" status, same as global count
      }
    });
    
    return {
      total: count
    };
  } catch (error) {
    console.error('Error in getChapterOneToOneCount:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get recent messages
 * @param {Object} options - Query options
 * @param {number} [options.memberId] - Member ID to find user's chapter and filter messages
 * @param {number} [options.chapterId] - Optional chapter ID to filter messages (overrides memberId if provided)
 * @param {number} [options.limit=5] - Maximum number of messages to return
 * @returns {Promise<Object>} Recent messages
 */
const getRecentMessages = async (options = {}) => {
  try {
    const { memberId, chapterId: explicitChapterId, limit = 5 } = options;
    let userChapterId = null;
    
    // If memberId is provided, get the chapterId for that member
    if (memberId && !explicitChapterId) {
      const member = await prisma.member.findUnique({
        where: { id: parseInt(memberId) },
        select: { chapterId: true }
      });
      if (member) {
        userChapterId = member.chapterId;
      }
    } else if (explicitChapterId) {
      userChapterId = parseInt(explicitChapterId);
    }
    
    let messages = [];
    
    if (userChapterId) {
      // Find messages that are either global (chapterId is null) or specific to user's chapter
      messages = await prisma.message.findMany({
        where: {
          OR: [
            { chapterId: userChapterId },
            { chapterId: null }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit)
      });
    } else {
      // If no chapter ID, just get global messages
      messages = await prisma.message.findMany({
        where: {
          chapterId: null
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: parseInt(limit)
      });
    }
    
    return {
      messages: messages,
      count: messages.length
    };
  } catch (error) {
    console.error('Error in getRecentMessages:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get recent chapter meetings for a member's chapter
 * @param {Object} options - Query options
 * @param {number} [options.memberId] - Member ID to find user's chapter
 * @param {number} [options.chapterId] - Optional chapter ID to filter meetings (overrides memberId if provided)
 * @param {number} [options.limit=3] - Maximum number of meetings to return
 * @returns {Promise<Object>} Recent chapter meetings
 */
const getRecentChapterMeetings = async (options = {}) => {
  try {
    const { memberId, chapterId: explicitChapterId } = options;
    // Force limit to exactly 3
    const limit = 3;
    let userChapterId = null;
    
    // If memberId is provided, get the chapterId for that member
    if (memberId && !explicitChapterId) {
      const member = await prisma.member.findUnique({
        where: { id: parseInt(memberId) },
        select: { chapterId: true }
      });
      if (member) {
        userChapterId = member.chapterId;
      }
    } else if (explicitChapterId) {
      userChapterId = parseInt(explicitChapterId);
    }
    
    if (!userChapterId) {
      return {
        meetings: [],
        count: 0
      };
    }
    
    const currentDate = new Date();
    
    // Find upcoming meetings for the chapter
    const meetings = await prisma.chapterMeeting.findMany({
      where: {
        chapterId: userChapterId,
        date: {
          gte: currentDate // Only get meetings with dates in the future (including today)
        }
      },
      orderBy: {
        date: 'asc' // Order by closest date first
      },
      take: limit // Always take exactly 3
    });
    
    return {
      meetings: meetings.slice(0, 3), // Double ensure we have exactly 3 max
      count: Math.min(meetings.length, 3)
    };
  } catch (error) {
    console.error('Error in getRecentChapterMeetings:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get all trainings
 * @param {Object} options - Query options
 * @param {number} [options.limit=5] - Maximum number of trainings to return
 * @returns {Promise<Object>} All trainings
 */
const getTrainings = async (options = {}) => {
  try {
    const { limit = 5 } = options;
    
    const trainings = await prisma.training.findMany({
      orderBy: {
        trainingDate: 'asc'
      },
      take: parseInt(limit)
    });
    
    return {
      trainings,
      count: trainings.length
    };
  } catch (error) {
    console.error('Error in getTrainings:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get upcoming birthdays
 * @param {Object} options - Query options
 * @param {number} [options.daysAhead=180] - Number of days ahead to check for birthdays
 * @param {number} [options.limit=5] - Maximum number of birthdays to return
 * @returns {Promise<Object>} Upcoming birthdays
 */
const getUpcomingBirthdays = async (options = {}) => {
  try {
    const { daysAhead = 180, limit = 5 } = options;
    
    // Current date
    const today = new Date();
    
    // Get all members
    const members = await prisma.member.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        memberName: true,
        dateOfBirth: true,
        chapterId: true,
        organizationName: true,
        businessCategory: true,
        chapter: {
          select: {
            name: true
          }
        }
      }
    });
    
    // Process members to find upcoming birthdays
    const upcomingBirthdays = members
      .map(member => {
        const birthDate = new Date(member.dateOfBirth);
        const birthdayThisYear = new Date(
          today.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate()
        );
        
        // If birthday already passed this year, look at next year's birthday
        if (birthdayThisYear < today) {
          birthdayThisYear.setFullYear(birthdayThisYear.getFullYear() + 1);
        }
        
        // Calculate days until birthday
        const daysUntilBirthday = Math.ceil(
          (birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return {
          ...member,
          daysUntilBirthday,
          upcomingBirthday: birthdayThisYear
        };
      })
      .filter(member => member.daysUntilBirthday <= daysAhead) // Filter for birthdays within the next 'daysAhead' days
      .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday) // Sort by closest birthday
      .slice(0, parseInt(limit)); // Limit results
    
    return {
      birthdays: upcomingBirthdays,
      count: upcomingBirthdays.length
    };
  } catch (error) {
    console.error('Error in getUpcomingBirthdays:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get recent transactions for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to get transactions for
 * @returns {Promise<Object>} Recent transactions for the chapter
 */
const getChapterTransactions = async (options = {}) => {
  try {
    const { chapterId } = options;

    if (!chapterId) {
      throw new Error("Chapter ID is required");
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        chapterId: parseInt(chapterId),
      },
      orderBy: {
        date: 'desc',
      },
      take: 10, // Limit to 10 recent transactions
    });

    const formattedTransactions = transactions.map(t => ({
      ...t,
      memberName: t.partyName || 'N/A', // Use partyName from the transaction
    }));

    return {
      transactions: formattedTransactions,
      count: formattedTransactions.length,
    };
  } catch (error) {
    console.error('Error in getChapterTransactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get bank and cash balances for a specific chapter
 * @param {Object} options - Query options
 * @param {number} options.chapterId - Chapter ID to get balances for
 * @returns {Promise<Object>} Bank and cash balances for the chapter
 */
const getChapterBalances = async (options = {}) => {
  try {
    const { chapterId } = options;

    if (!chapterId) {
      throw new Error("Chapter ID is required");
    }

    const chapter = await prisma.chapter.findUnique({
      where: {
        id: parseInt(chapterId),
      },
      select: {
        bankclosingbalance: true,
        cashclosingbalance: true,
      },
    });

    if (!chapter) {
      return {
        bankBalance: 0,
        cashBalance: 0,
      };
    }

    return {
      bankBalance: parseFloat(chapter.bankclosingbalance) || 0,
      cashBalance: parseFloat(chapter.cashclosingbalance) || 0,
    };
  } catch (error) {
    console.error('Error in getChapterBalances:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

module.exports = {
  getBusinessGenerated,
  getReferencesCount,
  getTotalVisitors,
  getOneToOne,
  getMemberGivenReferences,
  getMemberReceivedReferences,
  getChapterBusinessGenerated,
  getChapterReferencesCount,
  getChapterVisitorsCount,
  getChapterOneToOneCount,
  getRecentMessages,
  getRecentChapterMeetings,
  getTrainings,
  getUpcomingBirthdays,
  getChapterTransactions,
  getChapterBalances
};