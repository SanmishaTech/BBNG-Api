const express = require("express");
const router = express.Router();
const packageController = require("../controllers/packageController");
const authMiddleware = require("../middleware/auth");

/**
 * @route   GET /api/packages
 * @desc    Get all packages with pagination, filtering, and sorting
 * @access  Private
 */
router.get("/", authMiddleware, packageController.getPackages);

/**
 * @route   POST /api/packages
 * @desc    Create a new package
 * @access  Private
 */
router.post("/", authMiddleware, packageController.createPackage);

/**
 * @route   GET /api/packages/:id
 * @desc    Get package by ID
 * @access  Private
 */
router.get("/:id", authMiddleware, packageController.getPackageById);

/**
 * @route   PUT /api/packages/:id
 * @desc    Update a package
 * @access  Private
 */
router.put("/:id", authMiddleware, packageController.updatePackage);

/**
 * @route   DELETE /api/packages/:id
 * @desc    Delete a package (or deactivate if in use)
 * @access  Private
 */
router.delete("/:id", authMiddleware, packageController.deletePackage);

module.exports = router; 