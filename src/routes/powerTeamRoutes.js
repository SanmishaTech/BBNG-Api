/**
 * Express Router configuration for PowerTeam management endpoints.
 *
 * @module routes/powerTeamRoutes
 */

const express = require("express");
const router = express.Router();
const powerTeamController = require("../controllers/powerTeamController");
const auth = require("../middleware/auth"); // Assuming you have standard auth middleware
// const acl = require("../middleware/acl"); // Uncomment if you use ACL and want to apply it

/**
 * @swagger
 * tags:
 *   name: PowerTeams
 *   description: PowerTeam management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PowerTeamCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *     PowerTeam:
 *       type: object
 *       required:
 *         - name
 *         - categoryIds
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         categories:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PowerTeamCategory'
 *     PowerTeamInput:
 *       type: object
 *       required:
 *         - name
 *         - categoryIds
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the PowerTeam.
 *         categoryIds:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of Category IDs to associate with the PowerTeam.
 */

/**
 * @swagger
 * /api/powerteams:
 *   get:
 *     summary: List all power teams
 *     tags: [PowerTeams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 powerTeams:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PowerTeam'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalPowerTeams:
 *                   type: integer
 */
router.get("/", auth, /* acl.can('read', 'powerteam'), */ powerTeamController.getPowerTeams);

/**
 * @swagger
 * /api/powerteams/{id}:
 *   get:
 *     summary: Get power team by ID
 *     tags: [PowerTeams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PowerTeam'
 *       404:
 *         description: PowerTeam not found
 */
router.get("/:id", auth, /* acl.can('read', 'powerteam'), */ powerTeamController.getPowerTeamById);

/**
 * @swagger
 * /api/powerteams:
 *   post:
 *     summary: Create a new power team
 *     tags: [PowerTeams]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PowerTeamInput'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PowerTeam'
 *       400:
 *         description: Bad request (e.g., validation error, duplicate name)
 */
router.post("/", auth, /* acl.can('create', 'powerteam'), */ powerTeamController.createPowerTeam);

/**
 * @swagger
 * /api/powerteams/{id}:
 *   put:
 *     summary: Update a power team
 *     tags: [PowerTeams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PowerTeam'
 *       404:
 *         description: PowerTeam not found
 *       400:
 *         description: Bad request
 */
router.put("/:id", auth, /* acl.can('update', 'powerteam'), */ powerTeamController.updatePowerTeam);

/**
 * @swagger
 * /api/powerteams/{id}:
 *   delete:
 *     summary: Delete a power team
 *     tags: [PowerTeams]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PowerTeam deleted successfully
 *       404:
 *         description: PowerTeam not found
 */
router.delete("/:id", auth, /* acl.can('delete', 'powerteam'), */ powerTeamController.deletePowerTeam);

module.exports = router;
