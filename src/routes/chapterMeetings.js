/**
 * Express Router configuration for Chapter Meeting management endpoints.
 *
 * This file defines the routes for handling CRUD operations on chapter meetings,
 * including fetching, creating, updating, and deleting meetings.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/chapterMeetingRoutes
 */

const express = require("express");
const router = express.Router();
const chapterMeetingController = require("../controllers/chapterMeetingController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * tags:
 *   name: ChapterMeetings
 *   description: Chapter meeting management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ChapterMeeting:
 *       type: object
 *       required:
 *         - date
 *         - meetingTime
 *         - meetingTitle
 *         - meetingVenue
 *         - chapterId
 *       properties:
 *         id:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         meetingTime:
 *           type: string
 *         meetingTitle:
 *           type: string
 *         meetingVenue:
 *           type: string
 *         chapterId:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /chapter-meetings:
 *   get:
 *     summary: List all chapter meetings
 *     tags: [ChapterMeetings]
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
 *         description: Search term for meeting title or venue
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: integer
 *         description: Filter meetings by chapter ID
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
 *                 meetings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChapterMeeting'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalMeetings:
 *                   type: integer
 */
router.get("/", auth, chapterMeetingController.getChapterMeetings);

/**
 * @swagger
 * /chapter-meetings/{id}:
 *   get:
 *     summary: Get chapter meeting by ID
 *     tags: [ChapterMeetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter Meeting ID
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterMeeting'
 *       400:
 *         description: Invalid ID supplied
 *       404:
 *         description: Meeting not found
 */
router.get("/:id", auth, chapterMeetingController.getChapterMeetingById);

/**
 * @swagger
 * /chapter-meetings:
 *   post:
 *     summary: Create a new chapter meeting
 *     tags: [ChapterMeetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - meetingTime
 *               - meetingTitle
 *               - meetingVenue
 *               - chapterId
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *               meetingTime:
 *                 type: string
 *               meetingTitle:
 *                 type: string
 *               meetingVenue:
 *                 type: string
 *               chapterId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterMeeting'
 *       400:
 *         description: Bad request
 */
router.post("/", auth, chapterMeetingController.createChapterMeeting);

/**
 * @swagger
 * /chapter-meetings/{id}:
 *   put:
 *     summary: Update a chapter meeting
 *     tags: [ChapterMeetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter Meeting ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update (at least one required)
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *               meetingTime:
 *                 type: string
 *               meetingTitle:
 *                 type: string
 *               meetingVenue:
 *                 type: string
 *               chapterId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterMeeting'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Meeting not found
 */
router.put("/:id", auth, chapterMeetingController.updateChapterMeeting);

/**
 * @swagger
 * /chapter-meetings/{id}:
 *   delete:
 *     summary: Delete a chapter meeting
 *     tags: [ChapterMeetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Chapter Meeting ID
 *     responses:
 *       200:
 *         description: Meeting deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Meeting not found
 */
router.delete("/:id", auth, chapterMeetingController.deleteChapterMeeting);

module.exports = router;