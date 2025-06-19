const prisma = require("../config/db");

/**
 * Helper function to get user's chapter roles
 * @param {string} userId - User ID to check roles for
 * @returns {Promise<Array>} Array of role objects { roleType, chapterId }
 */
const getUserChapterRoles = async (userId) => {
  try {
    const member = await prisma.member.findUnique({
      where: { userId },
      include: {
        chapterRoles: {
          select: {
            roleType: true,
            chapterId: true,
          },
        },
      },
    });

    if (member && member.chapterRoles) {
      return member.chapterRoles.map(role => ({ 
        roleType: role.roleType, 
        chapterId: role.chapterId 
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching user chapter roles:", error);
    return []; 
  }
};

/**
 * Get chapters accessible by user based on their roles
 * Groups chapters by role categories:
 * - OB: Office Bearers (chapterHead, secretary, treasurer)
 * - RD: Regional Directors (connected to zones)
 * - DC: Development Coordinators (districtCoordinator, guardian)
 * 
 * @param {string} userId - User ID to check roles for
 * @returns {Promise<Array>} Array containing role categories and accessible chapter IDs
 */
const getUserAccessibleChapters = async (userId) => {
  try {
    const result = [
      { role: 'OB', chapters: [] },
      { role: 'RD', chapters: [] },
      { role: 'DC', chapters: [] }
    ];
    
    const member = await prisma.member.findUnique({
      where: { userId },
      include: {
        chapterRoles: {
          select: {
            roleType: true,
            chapterId: true,
          },
        },
        chapter: {
          select: {
            id: true,
            zoneId: true
          }
        }
      },
    });

    if (!member) {
      return result;
    }
    
    const obRoles = ['chapterHead', 'secretary', 'treasurer'];
    const obChapters = member.chapterRoles
      .filter(role => obRoles.includes(role.roleType))
      .map(role => role.chapterId);
    
    result[0].chapters = [...new Set(obChapters)];

    const dcRoles = ['districtCoordinator', 'guardian', 'developmentCoordinator'];
    const dcChapters = member.chapterRoles
      .filter(role => dcRoles.includes(role.roleType))
      .map(role => role.chapterId);
    
    result[2].chapters = [...new Set(dcChapters)];

    const zoneRoles = await prisma.zoneRole.findMany({
      where: { member: { userId: userId } },
      select: { roleType: true, zoneId: true }
    });

    if (zoneRoles.length > 0) {
      const rdRoles = ['regionalDirector'];
      const userZoneIds = zoneRoles
        .filter(role => rdRoles.includes(role.roleType))
        .map(role => role.zoneId);

      if (userZoneIds.length > 0) {
        const chaptersInZones = await prisma.chapter.findMany({
          where: { zoneId: { in: userZoneIds } },
          select: { id: true },
        });
        
        result[1].chapters = [...new Set(chaptersInZones.map(c => c.id))];
      }
    }
    
    return result;

  } catch (error) {
    console.error("Error in getUserAccessibleChapters:", error);
    throw error;
  }
};

module.exports = {
  getUserChapterRoles,
  getUserAccessibleChapters,
};
