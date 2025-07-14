/**
 * Express Router configuration for Chapter management endpoints.
 *
 * This file defines the routes for handling CRUD operations on chapters,
 * including fetching, creating, updating, and deleting chapters.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/chapterRoutes
 */

const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");
const { requireChapterRole } = require("../middleware/requireChapterRole");

/**
 * @swagger
 * tags:
 *   name: Chapters
 *   description: Chapter management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Zone:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *     Location:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         country:
 *           type: string
 *     Chapter:
 *       type: object
 *       required:
 *         - name
 *         - zoneId
 *         - locationId
 *         - date
 *         - meetingday
 *         - venue
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         zoneId:
 *           type: integer
 *         locationId:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         meetingday:
 *           type: string
 *         status:
 *           type: boolean
 *         venue:
 *           type: string
 *         monthlyVenue:
 *           type: integer
 *         quarterlyVenue:
 *           type: integer
 *         halfYearlyVenue:
 *           type: integer
 *         yearlyVenue:
 *           type: integer
 *         earlybirdVenue:
 *           type: integer
 *         quarterlyHo:
 *           type: integer
 *         halfyearlyHo:
 *           type: integer
 *         yearlyHo:
 *           type: integer
 *         earlybirdHo:
 *           type: integer
 *         bankopeningbalance:
 *           type: integer
 *         bankclosingbalance:
 *           type: integer
 *         cashopeningbalance:
 *           type: integer
 *         cashclosingbalance:
 *           type: integer
 *         zone:
 *           $ref: '#/components/schemas/Zone'
 *         location:
 *           $ref: '#/components/schemas/Location'
 */

/**
 * @swagger
 * /api/chapters:
 *   get:
 *     summary: List all chapters
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
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
 *         description: Search term for chapter name
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter chapters by city
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by status (active/inactive)
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
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapters:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chapter'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalChapters:
 *                   type: integer
 */
router.get("/", auth, chapterController.getChapters);

/**
 * @swagger
 * /api/chapters/{id}:
 *   get:
 *     summary: Get chapter by ID
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter ID
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Invalid ID supplied
 *       404:
 *         description: Chapter not found
 */
router.get("/:id", auth, chapterController.getChapterById);

/**
 * @swagger
 * /api/chapters:
 *   post:
 *     summary: Create a new chapter
 *     tags: [Chapters]
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
 *               - zoneId
 *               - locationId
 *               - date
 *               - meetingday
 *               - venue
 *             properties:
 *               name:
 *                 type: string
 *               zoneId:
 *                 type: integer
 *               locationId:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date-time
 *               meetingday:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: boolean
 *               venue:
 *                 type: string
 *               monthlyVenue:
 *                 type: integer
 *               quarterlyVenue:
 *                 type: integer
 *               halfYearlyVenue:
 *                 type: integer
 *               yearlyVenue:
 *                 type: integer
 *               earlybirdVenue:
 *                 type: integer
 *               quarterlyHo:
 *                 type: integer
 *               halfyearlyHo:
 *                 type: integer
 *               yearlyHo:
 *                 type: integer
 *               earlybirdHo:
 *                 type: integer
 *               bankopeningbalance:
 *                 type: integer
 *               bankclosingbalance:
 *                 type: integer
 *               cashopeningbalance:
 *                 type: integer
 *               cashclosingbalance:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Bad request
 */
router.post("/", auth, requireChapterRole("OB"), chapterController.createChapter);

/**
 * @swagger
 * /api/chapters/{id}:
 *   put:
 *     summary: Update a chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update (at least one required)
 *             properties:
 *               name:
 *                 type: string
 *               zoneId:
 *                 type: integer
 *               locationId:
 *                 type: integer
 *               date:
 *                 type: string
 *                 format: date-time
 *               meetingday:
 *                 type: string
 *               status:
 *                 type: boolean
 *               venue:
 *                 type: string
 *               monthlyVenue:
 *                 type: integer
 *               quarterlyVenue:
 *                 type: integer
 *               halfYearlyVenue:
 *                 type: integer
 *               yearlyVenue:
 *                 type: integer
 *               earlybirdVenue:
 *                 type: integer
 *               quarterlyHo:
 *                 type: integer
 *               halfyearlyHo:
 *                 type: integer
 *               yearlyHo:
 *                 type: integer
 *               earlybirdHo:
 *                 type: integer
 *               bankopeningbalance:
 *                 type: integer
 *               bankclosingbalance:
 *                 type: integer
 *               cashopeningbalance:
 *                 type: integer
 *               cashclosingbalance:
 *                 type: integer
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Chapter not found
 */
router.put("/:id", auth, requireChapterRole("OB"), chapterController.updateChapter);

/**
 * @swagger
 * /api/chapters/{id}:
 *   delete:
 *     summary: Delete a chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter ID
 *     responses:
 *       200:
 *         description: Chapter deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Chapter not found
 */
router.delete("/:id", auth, requireChapterRole("OB"), chapterController.deleteChapter);

/**
 * Chapter Role Management Routes
 */

// Get all roles for a chapter
router.get("/:chapterId/roles", auth, requireChapterRole("OB"), chapterController.getChapterRoles);

// Assign a role to a member
router.post("/:chapterId/roles", auth, requireChapterRole("OB"), chapterController.assignChapterRole);

// Remove a role assignment
router.delete("/:chapterId/roles/:roleId", auth, requireChapterRole("OB"), chapterController.removeChapterRole);

// Get role assignment history for a chapter
router.get("/:chapterId/roles/history", auth, requireChapterRole("OB"), chapterController.getChapterRoleHistory);

// Get roles for a specific member (moved to chapter routes for consistency)
router.get("/members/:memberId/roles", auth, requireChapterRole("OB"), chapterController.getMemberRoles);

module.exports = router;
