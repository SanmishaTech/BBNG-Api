const prisma = require("./src/config/db");

async function debugPriyaRoles() {
  try {
    console.log("=== DEBUGGING PRIYA SINGH ROLES ===\n");

    // First, let's find Priya Singh's user record
    const user = await prisma.user.findFirst({
      where: { name: "Priya Singh" },
      include: {
        member: {
          include: {
            chapterRoles: true,
            zoneRoles: {
              include: {
                zone: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log("Priya Singh user not found");
      return;
    }

    console.log(`User ID: ${user.id}`);
    console.log(`Member ID: ${user.member?.id || "No member record"}`);

    if (!user.member) {
      console.log("No member record found for Priya Singh");
      return;
    }

    console.log("\nChapter Roles:");
    if (user.member.chapterRoles && user.member.chapterRoles.length > 0) {
      user.member.chapterRoles.forEach((role) => {
        console.log(`  - ${role.roleType} (Chapter ID: ${role.chapterId})`);
      });
    } else {
      console.log("  No chapter roles");
    }

    console.log("\nZone Roles:");
    if (user.member.zoneRoles && user.member.zoneRoles.length > 0) {
      user.member.zoneRoles.forEach((role) => {
        console.log(
          `  - ${role.roleType} (Zone: ${role.zone.name}, Zone ID: ${role.zoneId})`
        );
      });
    } else {
      console.log("  No zone roles");
    }

    // Let's also check the ZoneRole table directly
    console.log("\nDirect ZoneRole query:");
    const directZoneRoles = await prisma.zoneRole.findMany({
      where: {
        member: {
          userId: user.id,
        },
      },
      include: {
        zone: true,
        member: true,
      },
    });

    if (directZoneRoles.length > 0) {
      directZoneRoles.forEach((role) => {
        console.log(
          `  - ${role.member.memberName}: ${role.roleType} of ${role.zone.name}`
        );
      });
    } else {
      console.log("  No zone roles found in direct query");
    }

    // Let's check if there are any zone roles for any member with userId 6
    console.log("\nAll zone roles for members with userId 6:");
    const allZoneRoles = await prisma.zoneRole.findMany({
      where: {
        memberId: user.member.id,
      },
      include: {
        zone: true,
        member: true,
      },
    });

    if (allZoneRoles.length > 0) {
      allZoneRoles.forEach((role) => {
        console.log(
          `  - Member ${role.member.memberName} (ID: ${role.memberId}): ${role.roleType} of ${role.zone.name}`
        );
      });
    } else {
      console.log("  No zone roles found for this member ID");
    }
  } catch (error) {
    console.error("Debug failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPriyaRoles();
