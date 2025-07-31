const { getUserChapterRoles } = require("./src/services/chapterService");

async function testLoginRoles() {
  try {
    console.log("=== TESTING LOGIN ROLES RESPONSE ===\n");

    // Test for users with different role types
    const testUsers = [
      { name: "Ankit Patel", userId: 4 },
      { name: "Deepa Reddy", userId: 5 },
      { name: "Priya Singh", userId: 6 }, // Regional Director
      { name: "Neha Joshi", userId: 8 },
    ];

    for (const testUser of testUsers) {
      console.log(`=== ${testUser.name} (User ID: ${testUser.userId}) ===`);

      try {
        const roles = await getUserChapterRoles(testUser.userId);
        console.log("Roles returned by getUserChapterRoles:");

        if (roles.length === 0) {
          console.log("  No roles found");
        } else {
          roles.forEach((role) => {
            if (role.chapterId) {
              console.log(
                `  - Chapter Role: ${role.roleType} (Chapter ID: ${role.chapterId})`
              );
            } else if (role.zoneId) {
              console.log(
                `  - Zone Role: ${role.roleType} (Zone ID: ${role.zoneId})`
              );
            } else {
              console.log(`  - Unknown Role: ${role.roleType}`);
            }
          });
        }

        // Simulate sidebar logic
        const obRoles = ["chapterHead", "secretary", "treasurer"];
        const coordinatorRoles = [
          "guardian",
          "districtCoordinator",
          "regionalCoordinator",
          "developmentCoordinator",
        ];
        const zoneRoles = ["Regional Director", "Joint Secretary"];

        const isOB = roles.some(
          (role) => obRoles.includes(role.roleType) && role.chapterId
        );

        const isCoordinator = roles.some(
          (role) => coordinatorRoles.includes(role.roleType) && role.chapterId
        );

        const hasZoneRole = roles.some(
          (role) => zoneRoles.includes(role.roleType) && role.zoneId
        );

        console.log("\nSidebar Logic Results:");
        console.log(`  - Is Office Bearer: ${isOB}`);
        console.log(`  - Is Coordinator (chapter): ${isCoordinator}`);
        console.log(`  - Has Zone Role: ${hasZoneRole}`);
        console.log(`  - Final isCoordinator: ${isCoordinator || hasZoneRole}`);
        console.log(
          `  - Should see Performance Dashboard: ${
            isOB || isCoordinator || hasZoneRole
          }`
        );
      } catch (error) {
        console.log(`  Error fetching roles: ${error.message}`);
      }

      console.log("\n" + "=".repeat(50) + "\n");
    }

    console.log("Test completed!");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit(0);
  }
}

testLoginRoles();
