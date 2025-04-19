/**
 * Express Router configuration for Zone management endpoints.
 *
 * This file defines the routes for handling CRUD operations on zones,
 * including fetching, creating, updating, and deleting zones.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/zoneRoutes
 */

const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zonesController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * tags:
 *   name: Zones
 *   description: Zone management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Zone:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the zone
 *           example: 1
 *         name:
 *           type: string
 *           description: The name of the zone
 *           example: "North Zone"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the zone was created
 *           example: "2023-10-27T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the zone was last updated
 *           example: "2023-10-27T10:00:00.000Z"
 *     ZoneListResponse:
 *       type: object
 *       properties:
 *         totalZones:
 *           type: integer
 *           description: Total number of zones matching the query
 *         page:
 *           type: integer
 *           description: Current page number
 *         totalPages:
 *           type: integer
 *           description: Total number of pages available
 *         zones:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Zone'
 */

/**
 * @swagger
 * /zones:
 *   get:
 *     summary: Retrieve a list of zones
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of zones per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for zone name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: id
 *         description: Field to sort by (e.g., 'id', 'name', 'createdAt')
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *       - in: query
 *         name: export
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Set to true to export zone data
 *     responses:
 *       200:
 *         description: A list of zones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZoneListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('zones.read')
 *
 *   post:
 *     summary: Create a new zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name for the new zone. Must be unique
 *     responses:
 *       201:
 *         description: Zone created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Zone'
 *       400:
 *         description: Bad Request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('zones.write')
 */
router.get("/", auth, zoneController.getZones);
router.post("/", auth, zoneController.createZone);

/**
 * @swagger
 * /zones/{id}:
 *   get:
 *     summary: Get a zone by its ID
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the zone to retrieve
 *     responses:
 *       200:
 *         description: Zone data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Zone'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('zones.read')
 *       404:
 *         description: Not Found - Zone with the specified ID does not exist
 *
 *   put:
 *     summary: Update a zone by its ID
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the zone to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: The updated name for the zone. Must be unique
 *     responses:
 *       200:
 *         description: Zone updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Zone'
 *       400:
 *         description: Bad Request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('zones.write')
 *       404:
 *         description: Not Found - Zone with the specified ID does not exist
 *
 *   delete:
 *     summary: Delete a zone by its ID
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the zone to delete
 *     responses:
 *       200:
 *         description: Zone deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Zone deleted successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('zones.delete')
 *       404:
 *         description: Not Found - Zone with the specified ID does not exist
 */
router.get("/:id", auth, zoneController.getZoneById);
router.put("/:id", auth, zoneController.updateZone);
router.delete("/:id", auth, zoneController.deleteZone);

module.exports = router;
