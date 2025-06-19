const express = require("express");
const router = express.Router();
const visitorController = require("../controllers/visitorController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");
const { requireChapterRole } = require("../middleware/requireChapterRole");


// GET /api/visitors - List all visitors with pagination & filters
router.get("/", auth,  requireChapterRole('OB'),visitorController.getVisitors);

// POST /api/visitors - Create a new visitor
router.post("/", auth, requireChapterRole('OB'), visitorController.createVisitor);

// GET /api/visitors/:id - Get a specific visitor
router.get("/:id", auth, requireChapterRole('OB'), visitorController.getVisitorById);

// PUT /api/visitors/:id - Update a visitor
router.put("/:id", auth, requireChapterRole('OB'), visitorController.updateVisitor);

// DELETE /api/visitors/:id - Delete a visitor
router.delete("/:id", auth, requireChapterRole('OB'), visitorController.deleteVisitor);

module.exports = router;
