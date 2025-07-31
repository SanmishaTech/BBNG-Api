const prisma = require("./src/config/db");

async function testRoleInference() {
  try {
    console.log("Testing Role Inference Logic...\n");

    // Find users with multiple chapter roles
    const usersWithMultipleRoles = await prisma.user.findMany({
      where: {
        member: {
          chapterRoles: {
            some: {},
          },
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

    console.log(
      `Found ${usersWithMultipleRoles.length} users with chapter roles\n`
    );

    for (const user of usersWithMultipleRoles) {
      if (!user.member) continue;

      console.log(`=== User: ${user.name} (ID: ${user.id}) ===`);
      console.log(`Member: ${user.member.memberName} (ID: ${user.member.id})`);
      console.log(
        `Member's Home Chapter: ${user.member.chapter?.name || "None"} (ID: ${
          user.member.chapter?.id || "N/A"
        })`
      );

      console.log("\nChapter Roles:");
      if (user.member.chapterRoles && user.member.chapterRoles.length > 0) {
        user.member.chapterRoles.forEach((role) => {
          console.log(
            `  - ${role.roleType} of ${role.chapter.name} (ID: ${role.chapter.id})`
          );
        });
      } else {
        console.log("  No chapter roles");
      }

      console.log("\nZone Roles:");
      if (user.member.zoneRoles && user.member.zoneRoles.length > 0) {
        user.member.zoneRoles.forEach((role) => {
          console.log(
            `  - ${role.roleType} of ${role.zone.name} (ID: ${role.zone.id})`
          );
          console.log(
            `    Chapters in zone: ${role.zone.chapters
              .map((c) => c.name)
              .join(", ")}`
          );
        });
      } else {
        console.log("  No zone roles");
      }

      // Simulate the role inference logic
      let inferredRole = "member";
      let accessScope = [];
      let roleDetails = {};

      // Zone roles
      if (user.member.zoneRoles && user.member.zoneRoles.length > 0) {
        inferredRole = "regional_director";
        roleDetails.zoneRoles = user.member.zoneRoles.map((zr) => ({
          roleType: zr.roleType,
          zoneName: zr.zone.name,
          zoneId: zr.zone.id,
        }));

        user.member.zoneRoles.forEach((zoneRole) => {
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

      // Chapter roles
      if (user.member.chapterRoles && user.member.chapterRoles.length > 0) {
        const guardianRoles = user.member.chapterRoles.filter(
          (cr) =>
            cr.roleType === "guardian" ||
            cr.roleType === "districtCoordinator" ||
            cr.roleType === "regionalCoordinator"
        );

        const obRoles = user.member.chapterRoles.filter(
          (cr) =>
            cr.roleType === "secretary" ||
            cr.roleType === "treasurer" ||
            cr.roleType === "chapterHead"
        );

        const allChapterRoles = [...guardianRoles, ...obRoles];

        if (allChapterRoles.length > 0) {
          if (guardianRoles.length > 0) {
            if (inferredRole === "member")
              inferredRole = "development_coordinator";
          } else if (obRoles.length > 0) {
            if (inferredRole === "member") inferredRole = "office_bearer";
          }

          roleDetails.chapterRoles = allChapterRoles.map((cr) => ({
            roleType: cr.roleType,
            chapterName: cr.chapter.name,
            chapterId: cr.chapter.id,
          }));

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

      // Always include member's own chapter
      if (user.member.chapter) {
        const alreadyIncluded = accessScope.some(
          (scope) => scope.chapterId === user.member.chapter.id
        );

        if (!alreadyIncluded) {
          accessScope.push({
            chapterId: user.member.chapter.id,
            chapterName: user.member.chapter.name,
            accessType: "own_chapter",
          });
        }
      }

      console.log("\n--- INFERRED ROLE INFO ---");
      console.log(`Inferred Role: ${inferredRole}`);
      console.log(`Access Scope (${accessScope.length} chapters):`);
      accessScope.forEach((scope) => {
        console.log(
          `  - ${scope.chapterName} (ID: ${scope.chapterId}) - ${
            scope.accessType
          }${scope.zoneName ? ` (Zone: ${scope.zoneName})` : ""}`
        );
      });

      console.log("\n" + "=".repeat(50) + "\n");
    }

    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoleInference();
