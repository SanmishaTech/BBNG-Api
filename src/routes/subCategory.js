/**
 * Express Router configuration for SubCategory management endpoints.
 *
 * This file defines the routes for handling CRUD operations on subcategories,
 * including fetching, creating, updating, and deleting subcategories.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/subCategoryRoutes
 */

const express = require("express");
const router = express.Router();
const subCategoryController = require("../controllers/subCategoryController");
const auth = require("../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: SubCategories
 *   description: SubCategory management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SubCategory:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - categoryId
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         categoryId:
 *           type: integer
 *         category:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 */

/**
 * @swagger
 * /subcategories:
 *   get:
 *     summary: Get all subcategories
 *     tags: [SubCategories]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of subcategories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubCategory'
 */
router.get("/", auth, subCategoryController.getSubCategories);

/**
 * @swagger
 * /subcategories/{id}:
 *   get:
 *     summary: Get a subcategory by ID
 *     tags: [SubCategories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: SubCategory data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubCategory'
 *       404:
 *         description: SubCategory not found
 */
router.get("/:id", auth, subCategoryController.getSubCategoryById);

/**
 * @swagger
 * /subcategories:
 *   post:
 *     summary: Create a new subcategory
 *     tags: [SubCategories]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubCategory'
 *     responses:
 *       201:
 *         description: Created subcategory
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubCategory'
 *       400:
 *         description: Validation error
 */
router.post("/", auth, subCategoryController.createSubCategory);

/**
 * @swagger
 * /subcategories/{id}:
 *   put:
 *     summary: Update a subcategory
 *     tags: [SubCategories]
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
 *             $ref: '#/components/schemas/SubCategory'
 *     responses:
 *       200:
 *         description: Updated subcategory
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubCategory'
 *       404:
 *         description: SubCategory not found
 */
router.put("/:id", auth, subCategoryController.updateSubCategory);

/**
 * @swagger
 * /subcategories/{id}:
 *   delete:
 *     summary: Delete a subcategory
 *     tags: [SubCategories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: SubCategory deleted
 *       404:
 *         description: SubCategory not found
 */
router.delete("/:id", auth, subCategoryController.deleteSubCategory);

module.exports = router;
