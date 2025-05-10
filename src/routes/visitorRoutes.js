const express = require("express");
const router = express.Router();
const visitorController = require("../controllers/visitorController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

// GET /api/visitors - List all visitors with pagination & filters
router.get("/", auth, visitorController.getVisitors);

// POST /api/visitors - Create a new visitor
router.post("/", auth, visitorController.createVisitor);

// GET /api/visitors/:id - Get a specific visitor
router.get("/:id", auth, visitorController.getVisitorById);

// PUT /api/visitors/:id - Update a visitor
router.put("/:id", auth, visitorController.updateVisitor);

// DELETE /api/visitors/:id - Delete a visitor
router.delete("/:id", auth, visitorController.deleteVisitor);

module.exports = router;
