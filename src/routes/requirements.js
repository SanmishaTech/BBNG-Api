const express = require("express");
const router = express.Router();
const requirementController = require("../controllers/requirementController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");

/**
 * @swagger
 * components:
 *   schemas:
 *     Requirement:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the requirement
 *         memberId:
 *           type: integer
 *           description: ID of the member who posted the requirement
 *         heading:
 *           type: string
 *           description: Title/heading of the requirement
 *         requirement:
 *           type: string
 *           description: Detailed description of the requirement
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Record creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Record last update timestamp
 *         member:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: Member ID
 *             memberName:
 *               type: string
 *               description: Name of the member
 *           description: Member information (included in list responses)
 *     
 *     CreateRequirementRequest:
 *       type: object
 *       required:
 *         - memberId
 *         - heading
 *         - requirement
 *       properties:
 *         memberId:
 *           type: integer
 *           description: ID of the member posting the requirement
 *           minimum: 1
 *         heading:
 *           type: string
 *           description: Title/heading of the requirement
 *           minLength: 1
 *         requirement:
 *           type: string
 *           description: Detailed description of the requirement
 *           minLength: 1
 *       example:
 *         memberId: 1
 *         heading: "Digital Marketing Services"
 *         requirement: "Looking for a digital marketing agency to help with social media campaigns and SEO optimization for our e-commerce business."
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

/**
 * @swagger
 * /api/requirements:
 *   post:
 *     summary: Create a new business requirement
 *     tags: [Requirements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRequirementRequest'
 *     responses:
 *       201:
 *         description: Requirement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Requirement'
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               errors:
 *                 heading:
 *                   message: "Heading is required"
 *                 requirement:
 *                   message: "Requirement is required"
 *                 memberId:
 *                   message: "Expected number, received string"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires 'requirements.write')
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
router.post(
  "/",
  auth,
  requirementController.createRequirement
);

/**
 * @swagger
 * /api/requirements:
 *   get:
 *     summary: Get all business requirements with member information
 *     tags: [Requirements]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all requirements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Requirement'
 *             example:
 *               - id: 1
 *                 memberId: 1
 *                 heading: "Digital Marketing Services"
 *                 requirement: "Looking for a digital marketing agency to help with social media campaigns."
 *                 createdAt: "2024-07-07T10:30:00Z"
 *                 updatedAt: "2024-07-07T10:30:00Z"
 *                 member:
 *                   id: 1
 *                   memberName: "John Doe"
 *               - id: 2
 *                 memberId: 2
 *                 heading: "Web Development"
 *                 requirement: "Need a responsive website for our restaurant business."
 *                 createdAt: "2024-07-06T15:45:00Z"
 *                 updatedAt: "2024-07-06T15:45:00Z"
 *                 member:
 *                   id: 2
 *                   memberName: "Jane Smith"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires 'requirements.read')
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
  "/",
  auth,
  requirementController.getAllRequirements
);

/**
 * @swagger
 * /api/requirements/member/{memberId}:
 *   get:
 *     summary: Get all requirements posted by a specific member
 *     tags: [Requirements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the member whose requirements to retrieve
 *         example: 1
 *     responses:
 *       200:
 *         description: List of requirements for the specified member retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   memberId:
 *                     type: integer
 *                   heading:
 *                     type: string
 *                   requirement:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *             example:
 *               - id: 1
 *                 memberId: 1
 *                 heading: "Digital Marketing Services"
 *                 requirement: "Looking for a digital marketing agency to help with social media campaigns."
 *                 createdAt: "2024-07-07T10:30:00Z"
 *                 updatedAt: "2024-07-07T10:30:00Z"
 *               - id: 3
 *                 memberId: 1
 *                 heading: "Logo Design"
 *                 requirement: "Need a professional logo design for our startup."
 *                 createdAt: "2024-07-05T09:15:00Z"
 *                 updatedAt: "2024-07-05T09:15:00Z"
 *       400:
 *         description: Bad request - Invalid member ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Invalid memberId"
 *                 status: 400
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires 'requirements.read')
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
  "/member/:memberId",
  auth,
  requirementController.getRequirementsByMember
);

/**
 * @swagger
 * /api/requirements/{id}:
 *   delete:
 *     summary: Delete a business requirement
 *     tags: [Requirements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the requirement to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Requirement deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Requirement deleted"
 *       400:
 *         description: Bad request - Invalid requirement ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Invalid id"
 *                 status: 400
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Insufficient permissions (requires 'requirements.delete')
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Requirement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error:
 *                 message: "Requirement not found"
 *                 status: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/:id",
  auth,
  requirementController.deleteRequirement
);

module.exports = router;
