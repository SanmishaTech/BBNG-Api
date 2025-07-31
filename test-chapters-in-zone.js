const prisma = require("./src/config/db");

async function testChaptersInZone() {
  try {
    console.log("Testing Chapters in Zone functionality...");

    // Test 1: Check available zones
    const zones = await prisma.zone.findMany({
      include: {
        chapters: {
          where: { status: true },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    console.log(`Found ${zones.length} zones:`);
    zones.forEach((zone) => {
      console.log(`  - ${zone.name}: ${zone.chapters.length} chapters`);
      zone.chapters.forEach((chapter) => {
        console.log(`    * ${chapter.name} (ID: ${chapter.id})`);
      });
    });

    // Test 2: Check users with zone roles
    const usersWithZoneRoles = await prisma.user.findMany({
      where: {
        member: {
          zoneRoles: {
            some: {},
          },
        },
      },
      include: {
        member: {
          include: {
            zoneRoles: {
              include: {
                zone: true,
              },
            },
          },
        },
      },
      take: 3,
    });

    console.log(`\nFound ${usersWithZoneRoles.length} users with zone roles:`);
    usersWithZoneRoles.forEach((user) => {
      console.log(`  - ${user.name} (${user.member?.memberName}):`);
      user.member?.zoneRoles.forEach((zoneRole) => {
        console.log(`    * ${zoneRole.roleType} in ${zoneRole.zone.name}`);
      });
    });

    // Test 3: Simulate the getChaptersInZone functionality
    if (zones.length > 0) {
      const testZone = zones[0];
      console.log(`\nTesting chapters in zone: ${testZone.name}`);

      const zoneWithChapters = await prisma.zone.findFirst({
        where: { name: testZone.name },
        include: {
          chapters: {
            where: { status: true },
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
          },
        },
      });

      if (zoneWithChapters) {
        console.log(`Zone: ${zoneWithChapters.name}`);
        console.log(`Chapters in zone: ${zoneWithChapters.chapters.length}`);

        zoneWithChapters.chapters.forEach((chapter) => {
          console.log(`  - ${chapter.name}: ${chapter.members.length} members`);
          chapter.members.slice(0, 2).forEach((member) => {
            console.log(
              `    * ${member.memberName} (${member.organizationName})`
            );
          });
        });
      }
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testChaptersInZone();
