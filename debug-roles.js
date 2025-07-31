const prisma = require("./src/config/db");

async function debugRoles() {
  try {
    console.log("=== DEBUGGING ROLE TYPES ===\n");

    // Check all unique chapter role types
    const chapterRoles = await prisma.chapterRole.findMany({
      select: {
        roleType: true,
        member: {
          select: {
            memberName: true,
          },
        },
        chapter: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log("CHAPTER ROLES:");
    const uniqueChapterRoles = [
      ...new Set(chapterRoles.map((r) => r.roleType)),
    ];
    console.log("Unique Chapter Role Types:", uniqueChapterRoles);

    chapterRoles.forEach((role) => {
      console.log(
        `  - ${role.member.memberName}: ${role.roleType} of ${role.chapter.name}`
      );
    });

    // Check all unique zone role types
    const zoneRoles = await prisma.zoneRole.findMany({
      select: {
        roleType: true,
        member: {
          select: {
            memberName: true,
          },
        },
        zone: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log("\nZONE ROLES:");
    const uniqueZoneRoles = [...new Set(zoneRoles.map((r) => r.roleType))];
    console.log("Unique Zone Role Types:", uniqueZoneRoles);

    zoneRoles.forEach((role) => {
      console.log(
        `  - ${role.member.memberName}: ${role.roleType} of ${role.zone.name}`
      );
    });

    console.log("\n=== ROLE SUMMARY ===");
    console.log("Chapter Role Types:", uniqueChapterRoles);
    console.log("Zone Role Types:", uniqueZoneRoles);
  } catch (error) {
    console.error("Debug failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRoles();
