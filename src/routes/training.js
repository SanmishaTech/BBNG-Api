const express = require("express");
const router = express.Router();
const trainingController = require("../controllers/trainingController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * tags:
 *   name: Trainings
 *   description: Training schedule endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Training:
 *       type: object
 *       required:
 *         - trainingDate
 *         - trainingTopic
 *       properties:
 *         id:
 *           type: integer
 *         trainingDate:
 *           type: string
 *           format: date-time
 *         trainingTopic:
 *           type: string
 */

/**
 * @swagger
 * /trainings:
 *   get:
 *     summary: List all trainings
 *     tags: [Trainings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order (ascending or descending)
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 trainings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Training'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalTrainings:
 *                   type: integer
 */
router.get("/", auth, acl("trainings.read"), trainingController.getTrainings);

/**
 * @swagger
 * /trainings/{id}:
 *   get:
 *     summary: Get training by ID
 *     tags: [Trainings]
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
 *               $ref: '#/components/schemas/Training'
 *       404:
 *         description: Training not found
 */
router.get("/:id", auth, acl("trainings.read"), trainingController.getTrainingById);

/**
 * @swagger
 * /trainings:
 *   post:
 *     summary: Schedule a new training
 *     tags: [Trainings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trainingDate, trainingTopic]
 *             properties:
 *               trainingDate: 
 *                 type: string
 *                 format: date-time
 *                 description: Date of the training
 *               trainingTopic: 
 *                 type: string
 *                 description: Topic of the training
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Training'
 *       400:
 *         description: Bad request
 */
router.post("/", auth, acl("trainings.write"), trainingController.createTraining);

/**
 * @swagger
 * /trainings/{id}:
 *   put:
 *     summary: Update a training schedule
 *     tags: [Trainings]
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
 *               trainingDate: 
 *                 type: string
 *                 format: date-time
 *                 description: Date of the training
 *               trainingTopic: 
 *                 type: string
 *                 description: Topic of the training
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Training'
 *       404:
 *         description: Training not found
 */
router.put("/:id", auth, acl("trainings.update"), trainingController.updateTraining);

/**
 * @swagger
 * /trainings/{id}:
 *   delete:
 *     summary: Cancel a training
 *     tags: [Trainings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Training deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Training not found
 */
router.delete("/:id", auth, acl("trainings.delete"), trainingController.deleteTraining);

module.exports = router;