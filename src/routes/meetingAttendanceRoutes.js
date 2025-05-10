const express = require("express");
const router = express.Router();
const meetingAttendanceController = require("../controllers/meetingAttendanceController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

// GET /api/meeting-attendance - Get attendance for a specific meeting
router.get(
  "/",
  auth,
  meetingAttendanceController.getMeetingAttendance
);

// POST /api/meeting-attendance/bulk - Update attendance for multiple members at once
router.post(
  "/bulk",
  auth,
  meetingAttendanceController.updateBulkAttendance
);

// GET /api/meeting-attendance/member/:memberId - Get attendance history for a specific member
router.get(
  "/member/:memberId",
  auth,
  meetingAttendanceController.getMemberAttendance
);

// GET /api/meeting-attendance/:meetingId/:memberId - Get specific attendance record
router.get(
  "/:meetingId/:memberId",
  auth,
  meetingAttendanceController.getAttendanceRecord
);

// PUT /api/meeting-attendance/:meetingId/:memberId - Update a specific attendance record
router.put(
  "/:meetingId/:memberId",
  auth,
  meetingAttendanceController.updateAttendanceRecord
);

module.exports = router;
