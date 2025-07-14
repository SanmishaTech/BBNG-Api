const express = require('express');
const router = express.Router();
const thankYouSlipController = require('../controllers/thankYouSlipController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     ThankYouSlip:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the thank you slip
 *         referenceId:
 *           type: integer
 *           nullable: true
 *           description: ID of the associated reference (for done deals)
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the thank you slip
 *         chapterId:
 *           type: integer
 *           nullable: true
 *           description: ID of the chapter
 *         fromMemberId:
 *           type: integer
 *           description: ID of the member giving the thank you
 *         toWhom:
 *           type: string
 *           nullable: true
 *           description: Name of the recipient
 *         toWhomId:
 *           type: integer
 *           nullable: true
 *           description: ID of the recipient member
 *         amount:
 *           type: string
 *           description: Business amount generated
 *         narration:
 *           type: string
 *           nullable: true
 *           description: Description of the business
 *         testimony:
 *           type: string
 *           nullable: true
 *           description: Testimonial about the business
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Record last update timestamp
 *         reference:
 *           $ref: '#/components/schemas/ReferenceBasic'
 *         chapter:
 *           $ref: '#/components/schemas/ChapterBasic'
 *         fromMember:
 *           $ref: '#/components/schemas/MemberBasic'
 *         toWhomMember:
 *           $ref: '#/components/schemas/MemberBasic'
 *     
 *     ReferenceBasic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nameOfReferral:
 *           type: string
 *         status:
 *           type: string
 *         giver:
 *           $ref: '#/components/schemas/MemberBasic'
 *         receiver:
 *           $ref: '#/components/schemas/MemberBasic'
 *     
 *     ChapterBasic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *     
 *     MemberBasic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         memberName:
 *           type: string
 *         organizationName:
 *           type: string
 *           description: Only included in member lists
 *     
 *     CreateThankYouSlipRequest:
 *       type: object
 *       required:
 *         - date
 *         - amount
 *       properties:
 *         referenceId:
 *           type: integer
 *           description: ID of the reference (for done deals)
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the thank you slip
 *         chapterId:
 *           type: integer
 *           description: ID of the chapter
 *         toWhom:
 *           type: string
 *           description: Name of the recipient (for direct thank you slips)
 *         toWhomId:
 *           type: integer
 *           description: ID of the recipient member (for direct thank you slips)
 *         amount:
 *           type: string
 *           description: Business amount generated
 *           minLength: 1
 *         narration:
 *           type: string
 *           description: Description of the business
 *         testimony:
 *           type: string
 *           description: Testimonial about the business
 *       example:
 *         date: "2024-07-07"
 *         chapterId: 1
 *         toWhom: "John Doe"
 *         toWhomId: 2
 *         amount: "25000"
 *         narration: "Website development project"
 *         testimony: "Great collaboration and professional service"
 *     
 *     UpdateThankYouSlipRequest:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the thank you slip
 *         amount:
 *           type: string
 *           description: Business amount generated
 *         narration:
 *           type: string
 *           description: Description of the business
 *         testimony:
 *           type: string
 *           description: Testimonial about the business
 *       example:
 *         amount: "30000"
 *         narration: "Updated project scope - website and mobile app"
 *         testimony: "Exceeded expectations with additional mobile app development"
 *     
 *     ThankYouSlipListResponse:
 *       type: object
 *       properties:
 *         thankYouSlips:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ThankYouSlip'
 *         pagination:
 *           type: object
 *           properties:
 *             totalCount:
 *               type: integer
 *               description: Total number of thank you slips
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *             currentPage:
 *               type: integer
 *               description: Current page number
 *     
 *     UserChapterResponse:
 *       type: object
 *       properties:
 *         chapter:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             name:
 *               type: string
 *             members:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   memberName:
 *                     type: string
 *       example:
 *         chapter:
 *           id: 1
 *           name: "Mumbai Chapter"
 *           members:
 *             - id: 1
 *               memberName: "John Doe"
 *             - id: 2
 *               memberName: "Jane Smith"
 *     
 *     ChaptersListResponse:
 *       type: object
 *       properties:
 *         chapters:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChapterBasic'
 *       example:
 *         chapters:
 *           - id: 1
 *             name: "Mumbai Chapter"
 *           - id: 2
 *             name: "Delhi Chapter"
 *     
 *     MembersListResponse:
 *       type: object
 *       properties:
 *         members:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MemberBasic'
 *       example:
 *         members:
 *           - id: 1
 *             memberName: "John Doe"
 *             organizationName: "ABC Technologies"
 *           - id: 2
 *             memberName: "Jane Smith"
 *             organizationName: "XYZ Solutions"
 *     
 *     ThankYouSlipsForReferenceResponse:
 *       type: object
 *       properties:
 *         thankYouSlips:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ThankYouSlip'
 *         reference:
 *           $ref: '#/components/schemas/ReferenceBasic'
 *       example:
 *         thankYouSlips:
 *           - id: 1
 *             date: "2024-07-07"
 *             amount: "25000"
 *             narration: "Website development"
 *             chapter:
 *               id: 1
 *               name: "Mumbai Chapter"
 *         reference:
 *           id: 1
 *           nameOfReferral: "Tech Startup"
 *           status: "converted"
 *           giver:
 *             id: 1
 *             memberName: "John Doe"
 *           receiver:
 *             id: 2
 *             memberName: "Jane Smith"
 *     
 *     CreateThankYouSlipResponse:
 *       type: object
 *       properties:
 *         thankYouSlip:
 *           $ref: '#/components/schemas/ThankYouSlip'
 *         reference:
 *           $ref: '#/components/schemas/ReferenceBasic'
 *         previousThankYouSlips:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ThankYouSlip'
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *         errors:
 *           type: object
 *           description: Validation errors object
 *       example:
 *         error: "Validation failed"
 */

/**
 * @swagger
 * /api/thankyou-slips:
 *   post:
 *     summary: Create a new thank you slip
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateThankYouSlipRequest'
 *     responses:
 *       201:
 *         description: Thank you slip created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateThankYouSlipResponse'
 *       400:
 *         description: Bad request - Validation errors
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
 *       404:
 *         description: Resource not found (member, chapter, or reference)
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
router.post('/', auth, thankYouSlipController.createThankYouSlip);

/**
 * @swagger
 * /api/thankyou-slips:
 *   get:
 *     summary: Get thank you slips with filtering and pagination
 *     tags: [Thank You Slips]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, given, received]
 *           default: all
 *         description: Filter type (all=chapter slips, given=user's given slips, received=user's received slips)
 *     responses:
 *       200:
 *         description: Thank you slips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlipListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Member profile not found
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
router.get('/', auth, thankYouSlipController.getAllThankYouSlips);

// Specific routes must come before generic pattern routes

/**
 * @swagger
 * /api/thankyou-slips/my-chapters:
 *   get:
 *     summary: Get current user's chapter with members
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's chapter retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserChapterResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Member profile or chapter not found
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
router.get('/my-chapters', auth, thankYouSlipController.getUserChapters);

/**
 * @swagger
 * /api/thankyou-slips/chapters:
 *   get:
 *     summary: Get all chapters
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chapters retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChaptersListResponse'
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
router.get('/chapters', auth, thankYouSlipController.getAllChapters);

/**
 * @swagger
 * /api/thankyou-slips/members/chapter/{chapterId}:
 *   get:
 *     summary: Get active members by chapter ID
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
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
 *         description: Chapter members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MembersListResponse'
 *       400:
 *         description: Bad request - Chapter ID required
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
 */
router.get('/members/chapter/:chapterId', auth, thankYouSlipController.getMembersByChapter);

/**
 * @swagger
 * /api/thankyou-slips/given:
 *   get:
 *     summary: Get thank you slips given by the current user
 *     tags: [Thank You Slips]
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
 *     responses:
 *       200:
 *         description: Given thank you slips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlipListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Member profile not found
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
router.get('/given', auth, thankYouSlipController.getGivenThankYouSlips);

/**
 * @swagger
 * /api/thankyou-slips/received:
 *   get:
 *     summary: Get thank you slips received by the current user
 *     tags: [Thank You Slips]
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
 *     responses:
 *       200:
 *         description: Received thank you slips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlipListResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Member profile not found
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
router.get('/received', auth, thankYouSlipController.getReceivedThankYouSlips);

/**
 * @swagger
 * /api/thankyou-slips/reference/{referenceId}:
 *   get:
 *     summary: Get thank you slips for a specific reference
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referenceId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Reference ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Thank you slips for reference retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlipsForReferenceResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Reference not found
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
router.get('/reference/:referenceId', auth, thankYouSlipController.getThankYouSlipsForReference);

/**
 * @swagger
 * /api/thankyou-slips/{id}:
 *   get:
 *     summary: Get a specific thank you slip by ID
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Thank you slip ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Thank you slip retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlip'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Thank you slip not found
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
router.get('/:id', auth, thankYouSlipController.getThankYouSlipById);

/**
 * @swagger
 * /api/thankyou-slips/{id}:
 *   put:
 *     summary: Update a thank you slip
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Thank you slip ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateThankYouSlipRequest'
 *     responses:
 *       200:
 *         description: Thank you slip updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ThankYouSlip'
 *       400:
 *         description: Bad request - Validation errors
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
 *       404:
 *         description: Thank you slip not found
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
router.put('/:id', auth, thankYouSlipController.updateThankYouSlip);

/**
 * @swagger
 * /api/thankyou-slips/{id}:
 *   delete:
 *     summary: Delete a thank you slip
 *     tags: [Thank You Slips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Thank you slip ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Thank you slip deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Thank you slip deleted successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Thank you slip not found
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
router.delete('/:id', auth, thankYouSlipController.deleteThankYouSlip);

module.exports = router;
