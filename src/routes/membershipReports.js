const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const membershipReportController = require("../controllers/membershipReportController");

// GET /membershipsreports (authenticated route) - now exports member-focused report
router.get("/", auth, membershipReportController.exportMembers);

module.exports = router;
