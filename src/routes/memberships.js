const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const authMiddleware = require("../middleware/auth");

/**
 * @route   GET /api/memberships
 * @desc    Get all memberships with pagination, filtering, and sorting
 * @access  Private
 */
router.get("/", authMiddleware, membershipController.getMemberships);

/**
 * @route   POST /api/memberships
 * @desc    Create a new membership and update member's expiry dates
 * @access  Private
 */
router.post("/", authMiddleware, membershipController.createMembership);

/**
 * @route   GET /api/memberships/:id
 * @desc    Get membership by ID
 * @access  Private
 */
router.get("/:id", authMiddleware, membershipController.getMembershipById);

/**
 * @route   PUT /api/memberships/:id
 * @desc    Update a membership
 * @access  Private
 */
router.put("/:id", authMiddleware, membershipController.updateMembership);

/**
 * @route   DELETE /api/memberships/:id
 * @desc    Delete a membership and update member's expiry dates if needed
 * @access  Private
 */
router.delete("/:id", authMiddleware, membershipController.deleteMembership);

/**
 * @route   GET /api/memberships/member/:memberId
 * @desc    Get all memberships for a specific member
 * @access  Private
 */
router.get("/member/:memberId", authMiddleware, membershipController.getMembershipsByMemberId);

module.exports = router; 