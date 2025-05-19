const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/sitesettingsController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * tags:
 *   name: SiteSettings
 *   description: Site settings management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SiteSetting:
 *       type: object
 *       required:
 *         - key
 *         - value
 *       properties:
 *         key:
 *           type: string
 *           description: Setting key
 *           example: "siteName"
 *         value:
 *           type: string
 *           description: Setting value
 *           example: "My Awesome Site"
 */

/**
 * @swagger
 * /sites:
 *   get:
 *     summary: Retrieve all site settings
 *     tags: [SiteSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all site settings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SiteSetting'
 *       500:
 *         description: Server error
 */
router.get("/", auth, settingsController.getSettings);

/**
 * @swagger
 * /sites:
 *   post:
 *     summary: Create a new site setting
 *     tags: [SiteSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       201:
 *         description: Site setting created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSetting'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post("/", auth, settingsController.createSetting);

/**
 * @swagger
 * /sites/{key}:
 *   get:
 *     summary: Retrieve a site setting by key
 *     tags: [SiteSettings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *         description: Setting key
 *     responses:
 *       200:
 *         description: Site setting data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSetting'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Setting not found
 *       500:
 *         description: Server error
 */
router.get("/:key", auth, settingsController.getSettingByKey);

/**
 * @swagger
 * /sites/{id}:
 *   put:
 *     summary: Update a site setting by ID
 *     tags: [SiteSettings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Setting ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 description: The new key for the setting
 *               value:
 *                 type: string
 *                 description: The new value for the setting
 *     responses:
 *       200:
 *         description: Site setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSetting'
 *       400:
 *         description: Bad request (e.g., invalid ID, missing key/value, duplicate key)
 *       404:
 *         description: Setting not found
 *       500:
 *         description: Server error
 */
router.put("/:id", auth, settingsController.updateSetting);

/**
 * @swagger
 * /sites/{id}:
 *   delete:
 *     summary: Delete a site setting by ID
 *     tags: [SiteSettings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Setting ID
 *     responses:
 *       200:
 *         description: Site setting deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Setting 'siteName' (ID: 123) deleted successfully"
 *       400:
 *         description: Bad request (e.g., invalid ID)
 *       404:
 *         description: Setting not found
 *       500:
 *         description: Server error
 */
router.delete("/:id", auth, settingsController.deleteSetting);

module.exports = router;