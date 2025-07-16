const express = require("express");
const router = express.Router();
const performanceDashboardController = require("../controllers/performanceDashboardController");

// Get user's inferred role and access scope
router.get("/user-role-info", performanceDashboardController.getUserRoleInfo);

// Get performance data based on user's role
router.get(
  "/performance-data",
  performanceDashboardController.getPerformanceData
);

// Get chapter performance summary
router.get(
  "/chapter-summary/:chapterId",
  performanceDashboardController.getChapterSummary
);

// Get member performance details
router.get(
  "/member-performance/:memberId",
  performanceDashboardController.getMemberPerformance
);

// Get chapters in a specific zone
router.get(
  "/chapters-in-zone",
  performanceDashboardController.getChaptersInZone
);

module.exports = router;
