const prisma = require("../config/db");
const asyncHandler = require("express-async-handler");
const createError = require("http-errors");

// Helper function to determine user's inferred role and access scope
const getUserRoleAndAccess = async (userId) => {
  // Find user's member record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      member: {
        include: {
          zoneRoles: {
            include: {
              zone: {
                include: {
                  chapters: true,
                },
              },
            },
          },
          chapterRoles: {
            include: {
              chapter: true,
            },
          },
          chapter: true,
        },
      },
    },
  });

  if (!user || !user.member) {
    throw createError(404, "Member record not found");
  }

  const member = user.member;
  let inferredRole = "member";
  let accessScope = [];
  let roleDetails = {};

  // 1. Check Zone-Level Assignments (Regional Director / Joint Secretary)
  if (member.zoneRoles && member.zoneRoles.length > 0) {
    inferredRole = "regional_director";
    roleDetails.zoneRoles = member.zoneRoles.map((zr) => ({
      roleType: zr.roleType,
      zoneName: zr.zone.name,
      zoneId: zr.zone.id,
    }));

    // Access to all chapters under assigned zones
    member.zoneRoles.forEach((zoneRole) => {
      accessScope.push(
        ...zoneRole.zone.chapters.map((chapter) => ({
          chapterId: chapter.id,
          chapterName: chapter.name,
          accessType: "zone",
          zoneName: zoneRole.zone.name,
        }))
      );
    });
  }

  // 2. Check Chapter-Level Assignments (All Chapter Roles)
  if (member.chapterRoles && member.chapterRoles.length > 0) {
    // Include ALL chapter role types
    const guardianRoles = member.chapterRoles.filter(
      (cr) =>
        cr.roleType === "guardian" ||
        cr.roleType === "districtCoordinator" ||
        cr.roleType === "regionalCoordinator" ||
        cr.roleType === "developmentCoordinator"
    );

    const obRoles = member.chapterRoles.filter(
      (cr) =>
        cr.roleType === "secretary" ||
        cr.roleType === "treasurer" ||
        cr.roleType === "chapterHead"
    );

    // Combine all chapter roles
    const allChapterRoles = [...guardianRoles, ...obRoles];

    if (allChapterRoles.length > 0) {
      // Determine primary role based on hierarchy
      if (guardianRoles.length > 0) {
        if (inferredRole === "member") inferredRole = "development_coordinator";
      } else if (obRoles.length > 0) {
        if (inferredRole === "member") inferredRole = "office_bearer";
      }

      roleDetails.chapterRoles = allChapterRoles.map((cr) => ({
        roleType: cr.roleType,
        chapterName: cr.chapter.name,
        chapterId: cr.chapter.id,
      }));

      // Add unique chapters to access scope
      const chapterMap = new Map();
      allChapterRoles.forEach((role) => {
        if (!chapterMap.has(role.chapter.id)) {
          chapterMap.set(role.chapter.id, {
            chapterId: role.chapter.id,
            chapterName: role.chapter.name,
            accessType: guardianRoles.some(
              (gr) => gr.chapter.id === role.chapter.id
            )
              ? "chapter_guardian"
              : "office_bearer",
            roles: [],
          });
        }
        chapterMap.get(role.chapter.id).roles.push(role.roleType);
      });

      accessScope.push(...Array.from(chapterMap.values()));
    }
  }

  // 3. Always include member's own chapter if they belong to one
  if (member.chapter) {
    // Check if this chapter is already in accessScope
    const alreadyIncluded = accessScope.some(
      (scope) => scope.chapterId === member.chapter.id
    );

    if (!alreadyIncluded) {
      accessScope.push({
        chapterId: member.chapter.id,
        chapterName: member.chapter.name,
        accessType: "own_chapter",
      });
    }
  }

  return {
    inferredRole,
    accessScope,
    roleDetails,
    memberId: member.id,
    memberName: member.memberName,
  };
};

// Get user's role information and access scope
const getUserRoleInfo = asyncHandler(async (req, res) => {
  const roleInfo = await getUserRoleAndAccess(req.user.id);
  res.json(roleInfo);
});

// Get performance data based on user's access
const getPerformanceData = asyncHandler(async (req, res) => {
  const { startDate, endDate, chapterId } = req.query;
  const roleInfo = await getUserRoleAndAccess(req.user.id);

  // Filter chapters based on access scope
  let chaptersToQuery = roleInfo.accessScope.map((scope) => scope.chapterId);

  if (chapterId && chaptersToQuery.includes(parseInt(chapterId))) {
    chaptersToQuery = [parseInt(chapterId)];
  }

  if (chaptersToQuery.length === 0) {
    return res.json({ chapters: [], summary: {} });
  }

  // Build date filter
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Get performance data for accessible chapters
  const performanceData = await Promise.all(
    chaptersToQuery.map(async (chapterId) => {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          members: {
            where: { active: true },
            select: {
              id: true,
              memberName: true,
              organizationName: true,
              category: true,
            },
          },
        },
      });

      if (!chapter) return null;

      // Get member performance data
      const memberPerformance = await Promise.all(
        chapter.members.map(async (member) => {
          const [
            businessGeneratedSlips,
            businessReceivedSlips,
            oneToOneMeetings,
            referencesGiven,
            referencesReceived,
          ] = await Promise.all([
            // Business Generated (Thank You Slips sent by this member)
            prisma.thankYouSlip.findMany({
              where: {
                fromMemberId: member.id,
                chapterId: chapterId,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
              },
              select: { amount: true },
            }),

            // Business Received (Thank You Slips where this member is mentioned in toWhom)
            prisma.thankYouSlip.findMany({
              where: {
                toWhom: { contains: member.memberName },
                chapterId: chapterId,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
              },
              select: { amount: true },
            }),

            // One-to-One Meetings
            prisma.oneToOne.count({
              where: {
                OR: [{ requesterId: member.id }, { requestedId: member.id }],
                chapterId: chapterId,
                status: "completed",
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
              },
            }),

            // References Given
            prisma.reference.count({
              where: {
                giverId: member.id,
                chapterId: chapterId,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
              },
            }),

            // References Received
            prisma.reference.count({
              where: {
                receiverId: member.id,
                chapterId: chapterId,
                ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
              },
            }),
          ]);

          // Calculate totals from the fetched slips
          const businessGeneratedAmount = businessGeneratedSlips.reduce(
            (sum, slip) => {
              const amount = parseFloat(slip.amount) || 0;
              return sum + amount;
            },
            0
          );

          const businessReceivedAmount = businessReceivedSlips.reduce(
            (sum, slip) => {
              const amount = parseFloat(slip.amount) || 0;
              return sum + amount;
            },
            0
          );

          return {
            memberId: member.id,
            memberName: member.memberName,
            organizationName: member.organizationName,
            category: member.category,
            businessGenerated: {
              amount: businessGeneratedAmount,
              count: businessGeneratedSlips.length,
            },
            businessReceived: {
              amount: businessReceivedAmount,
              count: businessReceivedSlips.length,
            },
            oneToOneMeetings: oneToOneMeetings,
            referencesGiven: referencesGiven,
            referencesReceived: referencesReceived,
          };
        })
      );

      return {
        chapterId: chapter.id,
        chapterName: chapter.name,
        members: memberPerformance,
        summary: {
          totalMembers: chapter.members.length,
          totalBusinessGenerated: memberPerformance.reduce(
            (sum, m) => sum + parseFloat(m.businessGenerated.amount),
            0
          ),
          totalBusinessReceived: memberPerformance.reduce(
            (sum, m) => sum + parseFloat(m.businessReceived.amount),
            0
          ),
          totalOneToOnes: memberPerformance.reduce(
            (sum, m) => sum + m.oneToOneMeetings,
            0
          ),
          totalReferencesGiven: memberPerformance.reduce(
            (sum, m) => sum + m.referencesGiven,
            0
          ),
          totalReferencesReceived: memberPerformance.reduce(
            (sum, m) => sum + m.referencesReceived,
            0
          ),
        },
      };
    })
  );

  const validChapters = performanceData.filter(Boolean);

  // Calculate overall summary
  const overallSummary = {
    totalChapters: validChapters.length,
    totalMembers: validChapters.reduce(
      (sum, c) => sum + c.summary.totalMembers,
      0
    ),
    totalBusinessGenerated: validChapters.reduce(
      (sum, c) => sum + c.summary.totalBusinessGenerated,
      0
    ),
    totalBusinessReceived: validChapters.reduce(
      (sum, c) => sum + c.summary.totalBusinessReceived,
      0
    ),
    totalOneToOnes: validChapters.reduce(
      (sum, c) => sum + c.summary.totalOneToOnes,
      0
    ),
    totalReferencesGiven: validChapters.reduce(
      (sum, c) => sum + c.summary.totalReferencesGiven,
      0
    ),
    totalReferencesReceived: validChapters.reduce(
      (sum, c) => sum + c.summary.totalReferencesReceived,
      0
    ),
  };

  res.json({
    roleInfo,
    chapters: validChapters,
    summary: overallSummary,
    dateRange: { startDate, endDate },
  });
});

// Get detailed chapter summary
const getChapterSummary = asyncHandler(async (req, res) => {
  const { chapterId } = req.params;
  const { startDate, endDate } = req.query;
  const roleInfo = await getUserRoleAndAccess(req.user.id);

  // Check if user has access to this chapter
  const hasAccess = roleInfo.accessScope.some(
    (scope) => scope.chapterId === parseInt(chapterId)
  );
  if (!hasAccess) {
    throw createError(403, "Access denied to this chapter");
  }

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const chapter = await prisma.chapter.findUnique({
    where: { id: parseInt(chapterId) },
    include: {
      members: {
        where: { active: true },
      },
      zones: true,
      location: true,
    },
  });

  if (!chapter) {
    throw createError(404, "Chapter not found");
  }

  // Get detailed metrics
  const [totalThankYouSlips, totalReferences, totalOneToOnes, recentActivity] =
    await Promise.all([
      prisma.thankYouSlip.findMany({
        where: {
          chapterId: parseInt(chapterId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          fromMember: {
            select: { memberName: true },
          },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),

      prisma.reference.findMany({
        where: {
          chapterId: parseInt(chapterId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          giver: { select: { memberName: true } },
          receiver: { select: { memberName: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),

      prisma.oneToOne.findMany({
        where: {
          chapterId: parseInt(chapterId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          requester: { select: { memberName: true } },
          requested: { select: { memberName: true } },
        },
        orderBy: { date: "desc" },
        take: 10,
      }),

      // Recent activity across all metrics
      Promise.all([
        prisma.thankYouSlip.findMany({
          where: { chapterId: parseInt(chapterId) },
          select: {
            date: true,
            amount: true,
            fromMember: { select: { memberName: true } },
          },
          orderBy: { date: "desc" },
          take: 5,
        }),
        prisma.reference.findMany({
          where: { chapterId: parseInt(chapterId) },
          select: {
            date: true,
            giver: { select: { memberName: true } },
            nameOfReferral: true,
          },
          orderBy: { date: "desc" },
          take: 5,
        }),
      ]),
    ]);

  res.json({
    chapter: {
      id: chapter.id,
      name: chapter.name,
      zone: chapter.zones.name,
      location: chapter.location.location,
      totalMembers: chapter.members.length,
    },
    metrics: {
      thankYouSlips: totalThankYouSlips,
      references: totalReferences,
      oneToOnes: totalOneToOnes,
    },
    recentActivity: {
      thankYouSlips: recentActivity[0],
      references: recentActivity[1],
    },
  });
});

// Get individual member performance
const getMemberPerformance = asyncHandler(async (req, res) => {
  const { memberId } = req.params;
  const { startDate, endDate } = req.query;
  const roleInfo = await getUserRoleAndAccess(req.user.id);

  const member = await prisma.member.findUnique({
    where: { id: parseInt(memberId) },
    include: {
      chapter: true,
    },
  });

  if (!member) {
    throw createError(404, "Member not found");
  }

  // Check if user has access to this member's chapter
  const hasAccess = roleInfo.accessScope.some(
    (scope) => scope.chapterId === member.chapterId
  );
  if (!hasAccess) {
    throw createError(403, "Access denied to this member");
  }

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  // Get detailed performance data
  const [thankYouSlips, referencesGiven, referencesReceived, oneToOnes] =
    await Promise.all([
      prisma.thankYouSlip.findMany({
        where: {
          fromMemberId: parseInt(memberId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        orderBy: { date: "desc" },
      }),

      prisma.reference.findMany({
        where: {
          giverId: parseInt(memberId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          receiver: { select: { memberName: true } },
        },
        orderBy: { date: "desc" },
      }),

      prisma.reference.findMany({
        where: {
          receiverId: parseInt(memberId),
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          giver: { select: { memberName: true } },
        },
        orderBy: { date: "desc" },
      }),

      prisma.oneToOne.findMany({
        where: {
          OR: [
            { requesterId: parseInt(memberId) },
            { requestedId: parseInt(memberId) },
          ],
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          requester: { select: { memberName: true } },
          requested: { select: { memberName: true } },
        },
        orderBy: { date: "desc" },
      }),
    ]);

  res.json({
    member: {
      id: member.id,
      name: member.memberName,
      organizationName: member.organizationName,
      category: member.category,
      chapter: member.chapter?.name,
    },
    performance: {
      thankYouSlips,
      referencesGiven,
      referencesReceived,
      oneToOnes,
    },
    summary: {
      totalBusinessGenerated: thankYouSlips.reduce(
        (sum, t) => sum + parseFloat(t.amount || 0),
        0
      ),
      totalReferencesGiven: referencesGiven.length,
      totalReferencesReceived: referencesReceived.length,
      totalOneToOnes: oneToOnes.length,
    },
  });
});

module.exports = {
  getUserRoleInfo,
  getPerformanceData,
  getChapterSummary,
  getMemberPerformance,
};
