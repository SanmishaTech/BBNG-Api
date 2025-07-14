/**
 * Express router for state operations.
 * @module routes/state
 */

const express = require('express');
const router = express.Router();
const { getStates, getState, createState, updateState, deleteState } = require('../controllers/stateController');
const auth = require('../middleware/auth'); // Auth middleware as default export

/**
 * @swagger
 * components:
 *   schemas:
 *     State:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the state
 *         name:
 *           type: string
 *           description: Name of the state
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Record last update timestamp
 *       example:
 *         id: 1
 *         name: "Maharashtra"
 *         createdAt: "2024-07-07T10:30:00Z"
 *         updatedAt: "2024-07-07T10:30:00Z"
 *     
 *     CreateStateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the state
 *           minLength: 1
 *       example:
 *         name: "Karnataka"
 *     
 *     UpdateStateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Updated name of the state
 *           minLength: 1
 *       example:
 *         name: "Tamil Nadu"
 *     
 *     StateListResponse:
 *       type: object
 *       properties:
 *         states:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/State'
 *         page:
 *           type: integer
 *           description: Current page number
 *         totalPages:
 *           type: integer
 *           description: Total number of pages
 *         totalStates:
 *           type: integer
 *           description: Total number of states
 *       example:
 *         states:
 *           - id: 1
 *             name: "Maharashtra"
 *             createdAt: "2024-07-07T10:30:00Z"
 *             updatedAt: "2024-07-07T10:30:00Z"
 *           - id: 2
 *             name: "Karnataka"
 *             createdAt: "2024-07-06T15:45:00Z"
 *             updatedAt: "2024-07-06T15:45:00Z"
 *         page: 1
 *         totalPages: 5
 *         totalStates: 29
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             status:
 *               type: integer
 */

/**
 * @swagger
 * /api/states:
 *   get:
 *     summary: Get all states with pagination, search, and sorting
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter states by name
 *         example: "Maha"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: name
 *         description: Field to sort by
 *         example: "name"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of states retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StateListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Failed to fetch states"
 *                 status: 500
 */
router.get('/', auth, getStates);

/**
 * @swagger
 * /api/states/{id}:
 *   get:
 *     summary: Get a specific state by ID
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: State ID
 *         example: 1
 *     responses:
 *       200:
 *         description: State retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
 *       400:
 *         description: Bad request - Invalid state ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Invalid state ID"
 *                 status: 400
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: State not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "State not found"
 *                 status: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Failed to fetch state"
 *                 status: 500
 */
router.get('/:id', auth, getState);

/**
 * @swagger
 * /api/states:
 *   post:
 *     summary: Create a new state
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStateRequest'
 *     responses:
 *       200:
 *         description: State created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Failed to create state"
 *                 status: 500
 */
router.post('/', auth, createState);

/**
 * @swagger
 * /api/states/{id}:
 *   put:
 *     summary: Update an existing state
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: State ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStateRequest'
 *     responses:
 *       200:
 *         description: State updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
 *       400:
 *         description: Bad request - Invalid state ID or input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Name is required and must be a string"
 *                 status: 400
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: State not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "State not found"
 *                 status: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Failed to update state"
 *                 status: 500
 */
router.put('/:id', auth, updateState);

/**
 * @swagger
 * /api/states/{id}:
 *   delete:
 *     summary: Delete a state
 *     tags: [States]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: State ID
 *         example: 1
 *     responses:
 *       200:
 *         description: State deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "State deleted successfully"
 *       400:
 *         description: Bad request - Invalid state ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Invalid state ID"
 *                 status: 400
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: State not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "State not found"
 *                 status: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Failed to delete state"
 *                 status: 500
 */
router.delete('/:id', auth, deleteState);

module.exports = router;
