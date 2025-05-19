const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const memberReportController = require("../controllers/memberReportController");

// GET /memberreports (authenticated, super-admin only)
router.get("/", auth, memberReportController.exportMembers);

module.exports = router;
