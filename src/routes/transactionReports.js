const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const transactionReportController = require("../controllers/transactionReportController");

// GET /transactionreports (authenticated, permission-based)
router.get("/", auth, transactionReportController.exportTransactions);

module.exports = router;
