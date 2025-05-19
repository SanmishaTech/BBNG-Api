const express = require("express");
const router = express.Router();
const chapterRoleController = require("../controllers/chapterRoleController");
const auth = require("../middleware/auth");

// Chapter-specific role routes
router.get(
  "/chapters/:chapterId/roles",
  auth,
  chapterRoleController.getChapterRoles
);

router.post(
  "/chapters/:chapterId/roles",
  auth,
  chapterRoleController.assignChapterRole
);

router.delete(
  "/chapters/:chapterId/roles/:roleId",
  auth,
  chapterRoleController.removeChapterRole
);

// Member-specific role routes
router.get(
  "/members/:memberId/roles",
  auth,
  chapterRoleController.getMemberRoles
);

module.exports = router;
