/**
 * Express Router configuration for Location management endpoints.
 *
 * This file defines the routes for handling CRUD operations on locations,
 * including fetching, creating, updating, and deleting locations.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/locationRoutes
 */

const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Location management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Location:
 *       type: object
 *       required:
 *         - zoneId
 *         - location
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the location
 *           example: 1
 *         zoneId:
 *           type: integer
 *           description: The ID of the zone this location belongs to
 *           example: 1
 *         location:
 *           type: string
 *           description: The name of the location
 *           example: "New York"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the location was created
 *           example: "2023-10-27T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the location was last updated
 *           example: "2023-10-27T10:00:00.000Z"
 *         zone:
 *           $ref: '#/components/schemas/Zone'
 *     LocationListResponse:
 *       type: object
 *       properties:
 *         totalLocations:
 *           type: integer
 *           description: Total number of locations matching the query
 *         page:
 *           type: integer
 *           description: Current page number
 *         totalPages:
 *           type: integer
 *           description: Total number of pages available
 *         locations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Location'
 */

/**
 * @swagger
 * /locations:
 *   get:
 *     summary: Retrieve a list of locations
 *     tags: [Locations]
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
 *         description: Number of locations per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for location name or zone name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: id
 *         description: Field to sort by (e.g., 'id', 'location', 'createdAt')
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
 *         description: Set to true to export location data
 *     responses:
 *       200:
 *         description: A list of locations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LocationListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('locations.read')
 *
 *   post:
 *     summary: Create a new location
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zoneId
 *               - location
 *             properties:
 *               zoneId:
 *                 type: integer
 *                 description: The ID of the zone this location belongs to
 *               location:
 *                 type: string
 *                 description: The name of the location
 *     responses:
 *       201:
 *         description: Location created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       400:
 *         description: Bad Request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('locations.write')
 */
router.get("/", auth, locationController.getLocations);
router.post("/", auth, locationController.createLocation);

/**
 * @swagger
 * /locations/{id}:
 *   get:
 *     summary: Get a location by its ID
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the location to retrieve
 *     responses:
 *       200:
 *         description: Location data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('locations.read')
 *       404:
 *         description: Not Found - Location with the specified ID does not exist
 *
 *   put:
 *     summary: Update a location by its ID
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the location to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               zoneId:
 *                 type: integer
 *                 description: The ID of the zone this location belongs to
 *               location:
 *                 type: string
 *                 description: The name of the location
 *     responses:
 *       200:
 *         description: Location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       400:
 *         description: Bad Request - Invalid input
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('locations.write')
 *       404:
 *         description: Not Found - Location with the specified ID does not exist
 *
 *   delete:
 *     summary: Delete a location by its ID
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Numeric ID of the location to delete
 *     responses:
 *       200:
 *         description: Location deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Location deleted successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *       403:
 *         description: Forbidden - User does not have permission ('locations.delete')
 *       404:
 *         description: Not Found - Location with the specified ID does not exist
 */
router.get("/:id", auth, locationController.getLocationById);
router.put("/:id", auth, locationController.updateLocation);
router.delete("/:id", auth, locationController.deleteLocation);

module.exports = router;
