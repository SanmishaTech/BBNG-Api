const express = require('express');
const router = express.Router();
const { 
  listReferences, 
  getReferenceById, 
  createReference, 
  updateReference, 
  deleteReference,
  updateReferenceStatus,
  getGivenReferences,
  getReceivedReferences,
  getMemberInfoForReference
} = require('../controllers/referenceController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @swagger
 * components:
 *   schemas:
 *     Reference:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the reference
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the reference
 *         noOfReferences:
 *           type: integer
 *           nullable: true
 *           description: Number of references
 *         chapterId:
 *           type: integer
 *           description: ID of the chapter
 *         giverId:
 *           type: integer
 *           description: ID of the member giving the reference
 *         receiverId:
 *           type: integer
 *           description: ID of the member receiving the reference
 *         urgency:
 *           type: string
 *           nullable: true
 *           description: Urgency level of the reference
 *         self:
 *           type: boolean
 *           description: Whether this is a self-reference
 *         nameOfReferral:
 *           type: string
 *           description: Name of the person being referred
 *         mobile1:
 *           type: string
 *           description: Primary mobile number
 *         mobile2:
 *           type: string
 *           nullable: true
 *           description: Secondary mobile number
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: Email address of the referral
 *         remarks:
 *           type: string
 *           nullable: true
 *           description: Additional remarks about the reference
 *         addressLine1:
 *           type: string
 *           nullable: true
 *           description: First line of address
 *         addressLine2:
 *           type: string
 *           nullable: true
 *           description: Second line of address
 *         location:
 *           type: string
 *           nullable: true
 *           description: Location/city
 *         pincode:
 *           type: string
 *           nullable: true
 *           description: Postal code
 *         status:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *           description: Current status of the reference
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Record last update timestamp
 *         giver:
 *           $ref: '#/components/schemas/MemberBasic'
 *         receiver:
 *           $ref: '#/components/schemas/MemberBasic'
 *         chapter:
 *           $ref: '#/components/schemas/ChapterBasic'
 *         statusHistory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReferenceStatusHistory'
 *     
 *     MemberBasic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         memberName:
 *           type: string
 *         email:
 *           type: string
 *         organizationName:
 *           type: string
 *     
 *     ChapterBasic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *     
 *     ReferenceStatusHistory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         referenceId:
 *           type: integer
 *         date:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *         comment:
 *           type: string
 *           nullable: true
 *     
 *     CreateReferenceRequest:
 *       type: object
 *       required:
 *         - date
 *         - chapterId
 *         - memberId
 *         - nameOfReferral
 *         - mobile1
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the reference
 *         noOfReferences:
 *           type: string
 *           description: Number of references (as string)
 *         chapterId:
 *           type: integer
 *           description: ID of the chapter
 *         memberId:
 *           type: integer
 *           description: ID of the member receiving the reference
 *         urgency:
 *           type: string
 *           description: Urgency level
 *         self:
 *           type: boolean
 *           description: Whether this is a self-reference
 *         nameOfReferral:
 *           type: string
 *           description: Name of the person being referred
 *         mobile1:
 *           type: string
 *           description: Primary mobile number
 *         mobile2:
 *           type: string
 *           description: Secondary mobile number
 *         email:
 *           type: string
 *           format: email
 *           description: Email address
 *         remarks:
 *           type: string
 *           description: Additional remarks
 *         addressLine1:
 *           type: string
 *           description: First line of address
 *         addressLine2:
 *           type: string
 *           description: Second line of address
 *         location:
 *           type: string
 *           description: Location/city
 *         pincode:
 *           type: string
 *           description: Postal code
 *         status:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *           description: Initial status (defaults to pending)
 *     
 *     UpdateReferenceRequest:
 *       type: object
 *       properties:
 *         date:
 *           type: string
 *           format: date
 *           description: Date of the reference
 *         noOfReferences:
 *           type: string
 *           description: Number of references (as string)
 *         chapterId:
 *           type: integer
 *           description: ID of the chapter
 *         memberId:
 *           type: integer
 *           description: ID of the member receiving the reference
 *         urgency:
 *           type: string
 *           description: Urgency level
 *         self:
 *           type: boolean
 *           description: Whether this is a self-reference
 *         nameOfReferral:
 *           type: string
 *           description: Name of the person being referred
 *         mobile1:
 *           type: string
 *           description: Primary mobile number
 *         mobile2:
 *           type: string
 *           description: Secondary mobile number
 *         email:
 *           type: string
 *           format: email
 *           description: Email address
 *         remarks:
 *           type: string
 *           description: Additional remarks
 *         addressLine1:
 *           type: string
 *           description: First line of address
 *         addressLine2:
 *           type: string
 *           description: Second line of address
 *         location:
 *           type: string
 *           description: Location/city
 *         pincode:
 *           type: string
 *           description: Postal code
 *         status:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *           description: Reference status
 *     
 *     UpdateStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *           description: New status for the reference
 *         date:
 *           type: string
 *           format: date
 *           description: Date of status change (defaults to current date)
 *         comment:
 *           type: string
 *           description: Comment about the status change
 *     
 *     ReferenceListResponse:
 *       type: object
 *       properties:
 *         references:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Reference'
 *         page:
 *           type: integer
 *           description: Current page number
 *         totalPages:
 *           type: integer
 *           description: Total number of pages
 *         total:
 *           type: integer
 *           description: Total number of references
 *     
 *     MemberInfoResponse:
 *       type: object
 *       properties:
 *         currentMemberId:
 *           type: integer
 *           description: ID of the current logged-in member
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               memberName:
 *                 type: string
 *               email:
 *                 type: string
 *               organizationName:
 *                 type: string
 *               businessCategory:
 *                 type: string
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
 *         errors:
 *           type: object
 *           description: Validation errors object
 */

// Routes - ORDER IS IMPORTANT
// Define specific routes before parameter routes

/**
 * @swagger
 * /api/references/given:
 *   get:
 *     summary: Get all references given by the current user or specified member
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: integer
 *         description: Member ID (defaults to current user's member ID)
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
 *         description: Search term for name, email, remarks, or mobile
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *         description: Filter by reference status
 *       - in: query
 *         name: self
 *         schema:
 *           type: boolean
 *         description: Filter self-references (true=only self, false=exclude self)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: date
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: exportData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Export all data without pagination
 *     responses:
 *       200:
 *         description: List of given references retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReferenceListResponse'
 *       400:
 *         description: Bad request - No member profile found
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
router.get('/given', getGivenReferences);

/**
 * @swagger
 * /api/references/received:
 *   get:
 *     summary: Get all references received by the current user or specified member
 *     tags: [References]
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
 *         description: Search term for name, email, remarks, or mobile
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *         description: Filter by reference status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: date
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: exportData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Export all data without pagination
 *     responses:
 *       200:
 *         description: List of received references retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReferenceListResponse'
 *       400:
 *         description: Bad request - No member profile found
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
router.get('/received', getReceivedReferences);

/**
 * @swagger
 * /api/references/member/{memberId}:
 *   get:
 *     summary: Get member information for reference dropdown
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID (currently not used, returns current user's chapter members)
 *     responses:
 *       200:
 *         description: Member information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MemberInfoResponse'
 *       400:
 *         description: Bad request - No member profile found
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
router.get('/member/:memberId', getMemberInfoForReference);

/**
 * @swagger
 * /api/references:
 *   get:
 *     summary: Get all references with advanced filtering and pagination
 *     tags: [References]
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
 *         name: giverId
 *         schema:
 *           type: integer
 *         description: Filter by giver member ID
 *       - in: query
 *         name: receiverId
 *         schema:
 *           type: integer
 *         description: Filter by receiver member ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for name, email, remarks, or mobile
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, contacted, converted, rejected, business done]
 *         description: Filter by reference status
 *       - in: query
 *         name: self
 *         schema:
 *           type: boolean
 *         description: Filter self-references when giverId is specified
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: date
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: exportData
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Export all data without pagination
 *     responses:
 *       200:
 *         description: List of references retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReferenceListResponse'
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
router.get('/', listReferences);

// Routes with params - MUST come after specific routes

/**
 * @swagger
 * /api/references/{id}:
 *   get:
 *     summary: Get a reference by ID
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reference ID
 *     responses:
 *       200:
 *         description: Reference retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reference'
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
router.get('/:id', getReferenceById);

/**
 * @swagger
 * /api/references:
 *   post:
 *     summary: Create a new reference
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReferenceRequest'
 *           example:
 *             date: "2024-07-07"
 *             chapterId: 1
 *             memberId: 2
 *             nameOfReferral: "John Doe"
 *             mobile1: "+91 9876543210"
 *             email: "john.doe@example.com"
 *             remarks: "Looking for digital marketing services"
 *             urgency: "high"
 *             self: false
 *             addressLine1: "123 Business Street"
 *             location: "Mumbai"
 *             pincode: "400001"
 *     responses:
 *       201:
 *         description: Reference created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reference'
 *       400:
 *         description: Bad request - Validation errors or no member profile
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
router.post('/', createReference);

/**
 * @swagger
 * /api/references/{id}:
 *   put:
 *     summary: Update an existing reference
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reference ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateReferenceRequest'
 *           example:
 *             nameOfReferral: "John Smith"
 *             mobile1: "+91 9876543211"
 *             email: "john.smith@example.com"
 *             remarks: "Updated requirements for web development"
 *             status: "contacted"
 *     responses:
 *       200:
 *         description: Reference updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reference'
 *       400:
 *         description: Bad request - Invalid reference ID or validation errors
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
router.put('/:id', updateReference);

/**
 * @swagger
 * /api/references/{id}:
 *   delete:
 *     summary: Delete a reference
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reference ID
 *     responses:
 *       200:
 *         description: Reference deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Reference deleted successfully"
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
router.delete('/:id', deleteReference);

/**
 * @swagger
 * /api/references/{id}/status:
 *   patch:
 *     summary: Update reference status and add status history entry
 *     tags: [References]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reference ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStatusRequest'
 *           example:
 *             status: "contacted"
 *             date: "2024-07-07"
 *             comment: "Called and discussed requirements"
 *     responses:
 *       200:
 *         description: Reference status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reference:
 *                   $ref: '#/components/schemas/Reference'
 *                 statusHistory:
 *                   $ref: '#/components/schemas/ReferenceStatusHistory'
 *       400:
 *         description: Bad request - Invalid reference ID or validation errors
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
router.patch('/:id/status', updateReferenceStatus);

module.exports = router; 