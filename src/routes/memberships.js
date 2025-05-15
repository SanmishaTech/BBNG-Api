const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const authMiddleware = require("../middleware/auth");
const createError = require("http-errors");

// Admin check middleware
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.role.includes('admin')) {
    return next(createError(403, "You don't have permission to perform this action"));
  }
  next();
};

/**
 * @route   GET /api/memberships
 * @desc    Get all memberships with pagination, filtering, and sorting
 * @access  Private
 */
router.get("/", authMiddleware, membershipController.getMemberships);

/**
 * @route   POST /api/memberships
 * @desc    Create a new membership and update member's expiry dates
 * @access  Admin only
 */
router.post("/", authMiddleware, isAdmin, membershipController.createMembership);

/**
 * @route   GET /api/memberships/:id
 * @desc    Get membership by ID
 * @access  Private
 */
router.get("/:id", authMiddleware, membershipController.getMembershipById);

/**
 * @route   PUT /api/memberships/:id
 * @desc    Update a membership
 * @access  Admin only
 */
router.put("/:id", authMiddleware, isAdmin, membershipController.updateMembership);

/**
 * @route   DELETE /api/memberships/:id
 * @desc    Delete a membership and update member's expiry dates if needed
 * @access  Admin only
 */
router.delete("/:id", authMiddleware, isAdmin, membershipController.deleteMembership);

/**
 * @route   GET /api/memberships/member/:memberId
 * @desc    Get all memberships for a specific member
 * @access  Private
 */
router.get("/member/:memberId", authMiddleware, membershipController.getMembershipsByMemberId);

module.exports = router; 