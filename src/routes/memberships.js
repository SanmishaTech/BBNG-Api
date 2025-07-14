const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const authMiddleware = require("../middleware/auth");
const createError = require("http-errors");

// Admin check middleware
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.role.includes('admin')) {
    return next(createError(403, "You don't have permission to perform this action"));
  }
  next();
};

/**
 * @swagger
 * components:
 *   schemas:
 *     Membership:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the membership
 *         memberId:
 *           type: integer
 *           description: ID of the member
 *         packageId:
 *           type: integer
 *           description: ID of the package
 *         invoiceNumber:
 *           type: string
 *           description: "Unique invoice number (format: YYYY-NNNNN)"
 *         invoiceDate:
 *           type: string
 *           format: date
 *           description: Date of invoice creation
 *         packageStartDate:
 *           type: string
 *           format: date
 *           description: Package start date
 *         packageEndDate:
 *           type: string
 *           format: date
 *           description: Package end date (calculated as start date + package duration, capped at March 31st)
 *         basicFees:
 *           type: number
 *           description: Basic fees amount
 *         cgstRate:
 *           type: number
 *           nullable: true
 *           description: CGST rate percentage
 *         cgstAmount:
 *           type: number
 *           description: Calculated CGST amount
 *         sgstRate:
 *           type: number
 *           nullable: true
 *           description: SGST rate percentage
 *         sgstAmount:
 *           type: number
 *           description: Calculated SGST amount
 *         igstRate:
 *           type: number
 *           nullable: true
 *           description: IGST rate percentage
 *         igstAmount:
 *           type: number
 *           description: Calculated IGST amount
 *         totalFees:
 *           type: number
 *           description: Total fees including taxes
 *         paymentDate:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: Date of payment
 *         paymentMode:
 *           type: string
 *           nullable: true
 *           description: Mode of payment
 *         active:
 *           type: boolean
 *           description: Whether the membership is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Record last update timestamp
 *         member:
 *           $ref: '#/components/schemas/Member'
 *         package:
 *           $ref: '#/components/schemas/Package'
 *     
 *     Member:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         memberName:
 *           type: string
 *         orgAddressLine1:
 *           type: string
 *         orgAddressLine2:
 *           type: string
 *         orgLocation:
 *           type: string
 *         orgPincode:
 *           type: string
 *         gstNo:
 *           type: string
 *         venueExpiryDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         hoExpiryDate:
 *           type: string
 *           format: date
 *           nullable: true
 *     
 *     Package:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         packageName:
 *           type: string
 *         periodMonths:
 *           type: integer
 *         isVenueFee:
 *           type: boolean
 *         hsnSac:
 *           type: string
 *         chapter:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *             chapterName:
 *               type: string
 *             hsnSac:
 *               type: string
 *     
 *     CreateMembershipRequest:
 *       type: object
 *       required:
 *         - memberId
 *         - invoiceDate
 *         - packageId
 *         - basicFees
 *       properties:
 *         memberId:
 *           type: integer
 *           description: ID of the member
 *         invoiceDate:
 *           type: string
 *           format: date
 *           description: Date of invoice creation
 *         packageId:
 *           type: integer
 *           description: ID of the package
 *         basicFees:
 *           type: number
 *           minimum: 0
 *           description: Basic fees amount
 *         cgstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: CGST rate percentage
 *         sgstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: SGST rate percentage
 *         igstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: IGST rate percentage
 *         paymentDate:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: Date of payment
 *         paymentMode:
 *           type: string
 *           nullable: true
 *           description: Mode of payment
 *     
 *     UpdateMembershipRequest:
 *       type: object
 *       properties:
 *         invoiceNumber:
 *           type: string
 *           description: Unique invoice number
 *         invoiceDate:
 *           type: string
 *           format: date
 *           description: Date of invoice creation
 *         basicFees:
 *           type: number
 *           minimum: 0
 *           description: Basic fees amount
 *         cgstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: CGST rate percentage
 *         sgstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: SGST rate percentage
 *         igstRate:
 *           type: number
 *           minimum: 0
 *           nullable: true
 *           description: IGST rate percentage
 *         paymentDate:
 *           type: string
 *           format: date
 *           nullable: true
 *           description: Date of payment
 *         paymentMode:
 *           type: string
 *           nullable: true
 *           description: Mode of payment
 *         active:
 *           type: boolean
 *           description: Whether the membership is active
 *     
 *     MembershipListResponse:
 *       type: object
 *       properties:
 *         memberships:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Membership'
 *         page:
 *           type: integer
 *           description: Current page number
 *         totalPages:
 *           type: integer
 *           description: Total number of pages
 *         totalMemberships:
 *           type: integer
 *           description: Total number of memberships
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
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/memberships:
 *   get:
 *     summary: Get all memberships with pagination, filtering, and sorting
 *     tags: [Memberships]
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
 *         description: Search term for invoice number or member name
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: integer
 *         description: Filter by member ID
 *       - in: query
 *         name: packageId
 *         schema:
 *           type: integer
 *         description: Filter by package ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: invoiceDate
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of memberships retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MembershipListResponse'
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
router.get("/", authMiddleware, membershipController.getMemberships);

/**
 * @swagger
 * /api/memberships:
 *   post:
 *     summary: Create a new membership and update member's expiry dates
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMembershipRequest'
 *           example:
 *             memberId: 1
 *             invoiceDate: "2024-04-01"
 *             packageId: 1
 *             basicFees: 10000
 *             cgstRate: 9
 *             sgstRate: 9
 *             igstRate: null
 *             paymentDate: "2024-04-01"
 *             paymentMode: "Bank Transfer"
 *     responses:
 *       201:
 *         description: Membership created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Membership'
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
 *       403:
 *         description: Forbidden - Admin access required
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
router.post("/", authMiddleware, isAdmin, membershipController.createMembership);

/**
 * @swagger
 * /api/memberships/{id}:
 *   get:
 *     summary: Get membership by ID
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Membership ID
 *     responses:
 *       200:
 *         description: Membership retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Membership'
 *       400:
 *         description: Bad request - Invalid membership ID
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
 *       403:
 *         description: Forbidden - Cannot view other members' memberships
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Membership not found
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
router.get("/:id", authMiddleware, membershipController.getMembershipById);

/**
 * @swagger
 * /api/memberships/{id}:
 *   put:
 *     summary: Update a membership
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Membership ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateMembershipRequest'
 *           example:
 *             basicFees: 12000
 *             cgstRate: 9
 *             sgstRate: 9
 *             paymentDate: "2024-04-15"
 *             paymentMode: "Cash"
 *             active: true
 *     responses:
 *       200:
 *         description: Membership updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Membership'
 *       400:
 *         description: Bad request - Validation errors or invalid membership ID
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
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Membership not found
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
router.put("/:id", authMiddleware, isAdmin, membershipController.updateMembership);

/**
 * @swagger
 * /api/memberships/{id}:
 *   delete:
 *     summary: Delete a membership and update member's expiry dates if needed
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Membership ID
 *     responses:
 *       200:
 *         description: Membership deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Membership deleted successfully"
 *       400:
 *         description: Bad request - Invalid membership ID
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
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Membership not found
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
router.delete("/:id", authMiddleware, isAdmin, membershipController.deleteMembership);

/**
 * @swagger
 * /api/memberships/member/{memberId}:
 *   get:
 *     summary: Get all memberships for a specific member
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member's memberships retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Membership'
 *       400:
 *         description: Bad request - Invalid member ID
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
 *       403:
 *         description: Forbidden - Cannot view other members' memberships
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Member not found
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
router.get("/member/:memberId", authMiddleware, membershipController.getMembershipsByMemberId);

/**
 * @swagger
 * /api/memberships/invoice/{invoiceFilename}:
 *   get:
 *     summary: Download a specific invoice PDF
 *     tags: [Memberships]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceFilename
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[\w\-]+\.pdf$'
 *         description: Invoice filename (must end with .pdf)
 *         example: "2324-00001.pdf"
 *     responses:
 *       200:
 *         description: Invoice PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request - Invalid filename format
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
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Invoice not found
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
router.get(
  "/invoice/:invoiceFilename",
  authMiddleware,
  isAdmin,
  membershipController.downloadInvoice
);

module.exports = router; 