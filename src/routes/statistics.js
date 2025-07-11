const express = require("express");
const router = express.Router();
const statisticsController = require("../controllers/statisticsController");
const authMiddleware = require("../middleware/auth");

/**
 * @swagger
 * components:
 *   schemas:
 *     BusinessGeneratedStats:
 *       type: object
 *       properties:
 *         total:
 *           type: number
 *           description: Total business amount generated
 *         count:
 *           type: integer
 *           description: Number of thank you slips
 *       example:
 *         total: 125000.50
 *         count: 15
 *     
 *     CountStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total count
 *       example:
 *         total: 42
 *     
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         chapterId:
 *           type: integer
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     MessagesResponse:
 *       type: object
 *       properties:
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Message'
 *         count:
 *           type: integer
 *           description: Number of messages returned
 *       example:
 *         messages:
 *           - id: 1
 *             title: "Welcome to BBNG"
 *             content: "Welcome to our networking community"
 *             chapterId: null
 *             createdAt: "2024-07-07T10:30:00Z"
 *             updatedAt: "2024-07-07T10:30:00Z"
 *         count: 1
 *     
 *     ChapterMeeting:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         chapterId:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         location:
 *           type: string
 *         agenda:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     MeetingsResponse:
 *       type: object
 *       properties:
 *         meetings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChapterMeeting'
 *         count:
 *           type: integer
 *           description: Number of meetings returned (max 3)
 *       example:
 *         meetings:
 *           - id: 1
 *             chapterId: 1
 *             date: "2024-07-15T10:00:00Z"
 *             location: "Conference Room A"
 *             agenda: "Monthly networking meeting"
 *             createdAt: "2024-07-01T09:00:00Z"
 *             updatedAt: "2024-07-01T09:00:00Z"
 *         count: 1
 *     
 *     Training:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         trainingDate:
 *           type: string
 *           format: date-time
 *         location:
 *           type: string
 *         instructor:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     TrainingsResponse:
 *       type: object
 *       properties:
 *         trainings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Training'
 *         count:
 *           type: integer
 *           description: Number of trainings returned
 *       example:
 *         trainings:
 *           - id: 1
 *             title: "Networking Skills Workshop"
 *             description: "Learn effective networking techniques"
 *             trainingDate: "2024-07-20T14:00:00Z"
 *             location: "Training Center"
 *             instructor: "John Smith"
 *             createdAt: "2024-07-01T10:00:00Z"
 *             updatedAt: "2024-07-01T10:00:00Z"
 *         count: 1
 *     
 *     Birthday:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         memberName:
 *           type: string
 *         dateOfBirth:
 *           type: string
 *           format: date
 *         chapterId:
 *           type: integer
 *         organizationName:
 *           type: string
 *         businessCategory:
 *           type: string
 *         daysUntilBirthday:
 *           type: integer
 *         upcomingBirthday:
 *           type: string
 *           format: date
 *         chapter:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *     
 *     BirthdaysResponse:
 *       type: object
 *       properties:
 *         birthdays:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Birthday'
 *         count:
 *           type: integer
 *           description: Number of upcoming birthdays
 *       example:
 *         birthdays:
 *           - id: 1
 *             memberName: "John Doe"
 *             dateOfBirth: "1980-07-15"
 *             chapterId: 1
 *             organizationName: "ABC Corp"
 *             businessCategory: "Technology"
 *             daysUntilBirthday: 8
 *             upcomingBirthday: "2024-07-15"
 *             chapter:
 *               name: "Mumbai Chapter"
 *         count: 1
 *     
 *     Transaction:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         chapterId:
 *           type: integer
 *         date:
 *           type: string
 *           format: date
 *         type:
 *           type: string
 *         amount:
 *           type: number
 *         description:
 *           type: string
 *         partyName:
 *           type: string
 *         memberName:
 *           type: string
 *           description: Formatted member name (same as partyName)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     TransactionsResponse:
 *       type: object
 *       properties:
 *         transactions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Transaction'
 *         count:
 *           type: integer
 *           description: Number of transactions returned (max 10)
 *       example:
 *         transactions:
 *           - id: 1
 *             chapterId: 1
 *             date: "2024-07-07"
 *             type: "income"
 *             amount: 5000.00
 *             description: "Membership fee"
 *             partyName: "John Doe"
 *             memberName: "John Doe"
 *             createdAt: "2024-07-07T10:30:00Z"
 *             updatedAt: "2024-07-07T10:30:00Z"
 *         count: 1
 *     
 *     ChapterBalances:
 *       type: object
 *       properties:
 *         bankBalance:
 *           type: number
 *           description: Current bank balance
 *         cashBalance:
 *           type: number
 *           description: Current cash balance
 *       example:
 *         bankBalance: 50000.75
 *         cashBalance: 2500.00
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *       example:
 *         error: "Chapter ID is required"
 */

/**
 * @swagger
 * /api/statistics/business-generated:
 *   get:
 *     summary: Get total business generated statistics from thank you slips
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business generated statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessGeneratedStats'
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
 */
router.get("/business-generated", authMiddleware, async (req, res) => {
  try {
    const businessStats = await statisticsController.getBusinessGenerated();
    res.json(businessStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/references-count:
 *   get:
 *     summary: Get total count of all references
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Reference count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/references-count", async (req, res) => {
  try {
    const referencesStats = await statisticsController.getReferencesCount();
    res.json(referencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/total-visitors:
 *   get:
 *     summary: Get total count of all visitors
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visitor count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
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
 */
router.get("/total-visitors", authMiddleware, async (req, res) => {
  try {
    const totalVisitorsStats = await statisticsController.getTotalVisitors();
    res.json(totalVisitorsStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/one-to-one:
 *   get:
 *     summary: Get count of accepted one-to-one meetings
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: One-to-one meeting count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/one-to-one", async (req, res) => {
  try {
    const oneToOneStats = await statisticsController.getOneToOne();
    res.json(oneToOneStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/member-given-references/{memberId}:
 *   get:
 *     summary: Get count of references given by a specific member
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Member ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Member given references count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/member-given-references/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const givenReferencesStats =
      await statisticsController.getMemberGivenReferences({ memberId });
    res.json(givenReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-business-generated/{chapterId}:
 *   get:
 *     summary: Get business generated statistics for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter business generated statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusinessGeneratedStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-business-generated/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterBusinessStats =
      await statisticsController.getChapterBusinessGenerated({ chapterId });
    res.json(chapterBusinessStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-references-count/{chapterId}:
 *   get:
 *     summary: Get count of references for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter references count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-references-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterReferencesStats =
      await statisticsController.getChapterReferencesCount({ chapterId });
    res.json(chapterReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-visitors-count/{chapterId}:
 *   get:
 *     summary: Get count of visitors for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter visitors count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-visitors-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterVisitorsStats =
      await statisticsController.getChapterVisitorsCount({ chapterId });
    res.json(chapterVisitorsStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-one-to-one-count/{chapterId}:
 *   get:
 *     summary: Get count of accepted one-to-one meetings for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter one-to-one meetings count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-one-to-one-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterOneToOneStats =
      await statisticsController.getChapterOneToOneCount({ chapterId });
    res.json(chapterOneToOneStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/recent-messages:
 *   get:
 *     summary: Get list of recent global messages
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: Recent messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessagesResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/recent-messages", async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({ limit });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/member-messages/{memberId}:
 *   get:
 *     summary: Get recent messages for a member (global and chapter-specific)
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Member ID
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: Member messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessagesResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/member-messages/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({
      memberId,
      limit,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-messages/{chapterId}:
 *   get:
 *     summary: Get recent messages for a chapter (global and chapter-specific)
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: Chapter messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessagesResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-messages/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({
      chapterId: chapterId,
      limit,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/member-chapter-meetings/{memberId}:
 *   get:
 *     summary: Get upcoming meetings for a member's chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Member ID
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of meetings to return (max 3)
 *     responses:
 *       200:
 *         description: Member chapter meetings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeetingsResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/member-chapter-meetings/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const limit = req.query.limit || 5;
    const meetings = await statisticsController.getRecentChapterMeetings({
      memberId,
      limit,
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-meetings/{chapterId}:
 *   get:
 *     summary: Get upcoming meetings for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of meetings to return (max 3)
 *     responses:
 *       200:
 *         description: Chapter meetings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeetingsResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-meetings/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const limit = req.query.limit || 5;
    const meetings = await statisticsController.getRecentChapterMeetings({
      chapterId: chapterId,
      limit,
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/trainings:
 *   get:
 *     summary: Get list of upcoming trainings
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of trainings to return
 *     responses:
 *       200:
 *         description: Trainings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TrainingsResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/trainings", async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const trainings = await statisticsController.getTrainings({ limit });
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/upcoming-birthdays:
 *   get:
 *     summary: Get list of upcoming member birthdays
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: daysAhead
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 180
 *         description: Number of days ahead to check for birthdays
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 5
 *         description: Maximum number of birthdays to return
 *     responses:
 *       200:
 *         description: Upcoming birthdays retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BirthdaysResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/upcoming-birthdays", async (req, res) => {
  try {
    const daysAhead = req.query.daysAhead || 180;
    const limit = req.query.limit || 5;
    const birthdays = await statisticsController.getUpcomingBirthdays({ 
      daysAhead,
      limit 
    });
    res.json(birthdays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/member-received-references/{memberId}:
 *   get:
 *     summary: Get count of references received by a specific member
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Member ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Member received references count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/member-received-references/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const receivedReferencesStats =
      await statisticsController.getMemberReceivedReferences({ memberId });
    res.json(receivedReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-transactions/{chapterId}:
 *   get:
 *     summary: Get recent transactions for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter transactions retrieved successfully (max 10)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionsResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-transactions/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterTransactions = await statisticsController.getChapterTransactions({ chapterId });
    res.json(chapterTransactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/statistics/chapter-balances/{chapterId}:
 *   get:
 *     summary: Get bank and cash balances for a specific chapter
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Chapter ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Chapter balances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChapterBalances'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/chapter-balances/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterBalances = await statisticsController.getChapterBalances({ chapterId });
    res.json(chapterBalances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
