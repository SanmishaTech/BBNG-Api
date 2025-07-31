const prisma = require("./src/config/db");

async function testPerformanceDashboard() {
  try {
    console.log("Testing Performance Dashboard API...");

    // Test 1: Check if we can find users with member records
    const usersWithMembers = await prisma.user.findMany({
      where: {
        member: {
          isNot: null,
        },
      },
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
      take: 5,
    });

    console.log(`Found ${usersWithMembers.length} users with member records`);

    if (usersWithMembers.length > 0) {
      const testUser = usersWithMembers[0];
      console.log(`Test user: ${testUser.name} (ID: ${testUser.id})`);
      console.log(
        `Member: ${testUser.member?.memberName} (ID: ${testUser.member?.id})`
      );
      console.log(`Zone roles: ${testUser.member?.zoneRoles?.length || 0}`);
      console.log(
        `Chapter roles: ${testUser.member?.chapterRoles?.length || 0}`
      );
      console.log(
        `Member chapter: ${testUser.member?.chapter?.name || "None"}`
      );
    }

    // Test 2: Check performance data availability
    const [totalThankYouSlips, totalReferences, totalOneToOnes, totalChapters] =
      await Promise.all([
        prisma.thankYouSlip.count(),
        prisma.reference.count(),
        prisma.oneToOne.count(),
        prisma.chapter.count(),
      ]);

    console.log("\nPerformance Data Summary:");
    console.log(`Total Thank You Slips: ${totalThankYouSlips}`);
    console.log(`Total References: ${totalReferences}`);
    console.log(`Total One-to-Ones: ${totalOneToOnes}`);
    console.log(`Total Chapters: ${totalChapters}`);

    // Test 3: Sample performance calculation for first chapter
    const firstChapter = await prisma.chapter.findFirst({
      include: {
        members: {
          where: { active: true },
          take: 3,
        },
      },
    });

    if (firstChapter && firstChapter.members.length > 0) {
      console.log(`\nSample performance for chapter: ${firstChapter.name}`);

      for (const member of firstChapter.members) {
        const [businessGenerated, referencesGiven] = await Promise.all([
          prisma.thankYouSlip.aggregate({
            where: {
              fromMemberId: member.id,
              chapterId: firstChapter.id,
            },
            _sum: { amount: true },
            _count: true,
          }),
          prisma.reference.count({
            where: {
              giverId: member.id,
              chapterId: firstChapter.id,
            },
          }),
        ]);

        console.log(`  ${member.memberName}:`);
        console.log(
          `    Business Generated: ₹${businessGenerated._sum.amount || 0} (${
            businessGenerated._count
          } transactions)`
        );
        console.log(`    References Given: ${referencesGiven}`);
      }
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPerformanceDashboard();
