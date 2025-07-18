const express = require("express");

const router = express.Router();
const authController = require("../controllers/authController");
const auth = require('../middleware/auth'); // Assuming middleware path and name

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and user management endpoints
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the user
 *               email:
 *                 type: string
 *                 description: Email address of the user
 *               password:
 *                 type: string
 *                 description: Password for the user account
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request (e.g., email already exists)
 *       403:
 *         description: Registration is disabled
 */
router.post("/register", authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email address of the user
 *               password:
 *                 type: string
 *                 description: Password for the user account
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     active:
 *                       type: boolean
 *                     lastLogin:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account is inactive
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email address of the user
 *     responses:
 *       200:
 *         description: Password reset link sent successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 */
router.post("/forgot-password", authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Reset the password using the reset token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: New password for the user account
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post("/reset-password/:token", authController.resetPassword);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
/**
 * @swagger
 * /api/auth/policy-text:
 *   get:
 *     summary: Get the site policy text
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Successfully retrieved policy text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policyText:
 *                   type: string
 *                   description: The site policy text
 *       404:
 *         description: Policy text not found
 *       500:
 *         description: Internal server error
 */
router.get("/policy-text", authController.getPolicyText);

/**
 * @swagger
 * /api/auth/accept-policy:
 *   patch:
 *     summary: Accept the site policy
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: [] # Indicates that this endpoint requires Bearer token authentication
 *     responses:
 *       200:
 *         description: Policy accepted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   description: Updated user object
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       500:
 *         description: Internal server error
 */
router.patch("/accept-policy", auth, authController.acceptPolicy);

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

module.exports = router;
