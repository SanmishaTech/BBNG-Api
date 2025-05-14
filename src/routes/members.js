/**
 * Express Router configuration for Member management endpoints.
 *
 * This file defines the routes for handling CRUD operations on members,
 * including fetching, creating, updating, and deleting members.
 * It utilizes authentication middleware to secure the endpoints
 * and includes Swagger documentation annotations.
 *
 * @module routes/memberRoutes
 */

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const createUploadMiddleware = require("../middleware/uploadMiddleware");

// Initialize upload middleware for member profile pictures
const uploadMiddleware = createUploadMiddleware("members", [
  {
    name: "profilePicture1",
    allowedTypes: ["image/jpeg", "image/png"],
    maxSize: 5 * 1024 * 1024, // 5MB
  },

  {
    name: "profilePicture2",
    allowedTypes: ["image/jpeg", "image/png"],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  {
    name: "profilePicture3",
    allowedTypes: ["image/jpeg", "image/png"],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
]);

const memberController = require("../controllers/memberController");

/**
 * @swagger
 * tags:
 *   name: Members
 *   description: Member management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Member:
 *       type: object
 *       required:
 *         - memberName
 *         - category
 *         - businessCategory
 *         - gender
 *         - dob
 *         - mobile1
 *         - organizationName
 *         - organizationMobileNo
 *         - orgAddressLine1
 *         - orgLocation
 *         - orgPincode
 *         - addressLine1
 *         - location
 *         - pincode
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *         memberName:
 *           type: string
 *         category:
 *           type: string
 *         businessCategory:
 *           type: string
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *         dob:
 *           type: string
 *           format: date
 *         mobile1:
 *           type: string
 *         mobile2:
 *           type: string
 *         gstNo:
 *           type: string
 *         organizationName:
 *           type: string
 *         businessTagline:
 *           type: string
 *         organizationMobileNo:
 *           type: string
 *         organizationLandlineNo:
 *           type: string
 *         organizationEmail:
 *           type: string
 *           format: email
 *         orgAddressLine1:
 *           type: string
 *         orgAddressLine2:
 *           type: string
 *         orgLocation:
 *           type: string
 *         orgPincode:
 *           type: string
 *         organizationWebsite:
 *           type: string
 *           format: uri
 *         organizationDescription:
 *           type: string
 *         addressLine1:
 *           type: string
 *         location:
 *           type: string
 *         addressLine2:
 *           type: string
 *         pincode:
 *           type: string
 *         specificAsk:
 *           type: string
 *         specificGive:
 *           type: string
 *         clients:
 *           type: string
 *         profilePicture1:
 *           type: string
 *           format: binary
 *         profilePicture2:
 *           type: string
 *           format: binary
 *         profilePicture3:
 *           type: string
 *           format: binary
 *         email:
 *           type: string
 *           format: email
 *         active:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/members/search:
 *   get:
 *     summary: Search members with more flexible criteria
 *     tags: [Members]
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
 *         description: Search term for member name, email, organization, or skills
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: businessCategory
 *         schema:
 *           type: string
 *         description: Filter by business category
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
 *         description: Sort order direction
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Member'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get("/search", auth, memberController.searchMembers);

/**
 * @swagger
 * /api/members:
 *   get:
 *     summary: List all members
 *     tags: [Members]
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
 *         description: Search term for member name, organization name or email
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: businessCategory
 *         schema:
 *           type: string
 *         description: Filter by business category
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Member'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 total:
 *                   type: integer
 */
router.get("/", auth, memberController.getMembers);

/**
 * @swagger
 * /api/members:
 *   post:
 *     summary: Create a new member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - memberName
 *               - category
 *               - businessCategory
 *               - gender
 *               - dob
 *               - mobile1
 *               - organizationName
 *               - organizationMobileNo
 *               - orgAddressLine1
 *               - orgLocation
 *               - orgPincode
 *               - addressLine1
 *               - location
 *               - pincode
 *               - email
 *               - password
 *             properties:
 *               memberName:
 *                 type: string
 *               category:
 *                 type: string
 *               businessCategory:
 *                 type: string
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               dob:
 *                 type: string
 *                 format: date
 *               mobile1:
 *                 type: string
 *               mobile2:
 *                 type: string
 *               gstNo:
 *                 type: string
 *               organizationName:
 *                 type: string
 *               businessTagline:
 *                 type: string
 *               organizationMobileNo:
 *                 type: string
 *               organizationLandlineNo:
 *                 type: string
 *               organizationEmail:
 *                 type: string
 *                 format: email
 *               orgAddressLine1:
 *                 type: string
 *               orgAddressLine2:
 *                 type: string
 *               orgLocation:
 *                 type: string
 *               orgPincode:
 *                 type: string
 *               organizationWebsite:
 *                 type: string
 *                 format: uri
 *               organizationDescription:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               location:
 *                 type: string
 *               addressLine2:
 *                 type: string
 *               pincode:
 *                 type: string
 *               specificAsk:
 *                 type: string
 *               specificGive:
 *                 type: string
 *               clients:
 *                 type: string
 *               profilePicture1:
 *                 type: string
 *                 format: binary
 *               profilePicture2:
 *                 type: string
 *                 format: binary
 *               profilePicture3:
 *                 type: string
 *                 format: binary
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *       413:
 *         description: Payload Too Large - File size exceeds limit
 *       415:
 *         description: Unsupported Media Type - Invalid file format
 */
router.post("/", auth, uploadMiddleware, memberController.createMember);

/**
 * @swagger
 * /api/members/{id}:
 *   get:
 *     summary: Get member by ID
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 */
router.get("/:id", auth, memberController.getMemberById);

/**
 * @swagger
 * /api/members/{id}:
 *   put:
 *     summary: Update a member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/Member'
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 */
router.put("/:id", auth, uploadMiddleware, memberController.updateMember);

/**
 * @swagger
 * /api/members/{id}:
 *   delete:
 *     summary: Delete a member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member deleted successfully
 */
router.delete("/:id", auth, memberController.deleteMember);

/**
 * @swagger
 * /api/members/{id}/profile-pictures:
 *   post:
 *     summary: Upload or update member profile pictures
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture1:
 *                 type: string
 *                 format: binary
 *               profilePicture2:
 *                 type: string
 *                 format: binary
 *               profilePicture3:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile pictures updated successfully
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *       413:
 *         description: Payload Too Large - File size exceeds limit
 *       415:
 *         description: Unsupported Media Type - Invalid file format
 */
router.post(
  "/:id/profile-pictures",
  auth,
  uploadMiddleware,
  memberController.updateProfilePictures
);

/**
 * @swagger
 * /api/members/{id}/profile-pictures/{pictureNumber}:
 *   delete:
 *     summary: Delete a specific profile picture
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: pictureNumber
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: The profile picture number to delete (1, 2, or 3)
 *     responses:
 *       200:
 *         description: Profile picture deleted successfully
 *       400:
 *         description: Invalid profile picture number
 *       404:
 *         description: Profile picture not found
 */
router.delete(
  "/:id/profile-pictures/:pictureNumber",
  auth,
  memberController.deleteProfilePicture
);

/**
 * @swagger
 * /api/members/{id}/profile-picture/{pictureNumber}:
 *   get:
 *     summary: Get a member's profile picture
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: pictureNumber
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: The profile picture number to retrieve (1, 2, or 3)
 *     responses:
 *       200:
 *         description: Returns the profile picture
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Profile picture not found
 */
router.get(
  "/:id/profile-picture/:pictureNumber",
  memberController.getProfilePicture
);

/**
 * @swagger
 * /api/members/{id}/membership-status:
 *   get:
 *     summary: Get membership status including expiry information
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Returns membership status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 memberName:
 *                   type: string
 *                 active:
 *                   type: boolean
 *                 hasActiveMemberships:
 *                   type: boolean
 *                 hoExpiryDate:
 *                   type: string
 *                   format: date-time
 *                 venueExpiryDate:
 *                   type: string
 *                   format: date-time
 *                 hoExpired:
 *                   type: boolean
 *                 venueExpired:
 *                   type: boolean
 *                 earlierExpiryDate:
 *                   type: string
 *                   format: date-time
 *                 expiryType:
 *                   type: string
 *                   enum: [HO, Venue]
 *       404:
 *         description: Member not found
 */
// router.get("/:id/membership-status", auth, memberController.getMembershipStatus);

/**
 * @swagger
 * /api/members/{id}/user-status:
 *   patch:
 *     summary: Toggle only the user's active status without affecting membership expiry
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 active:
 *                   type: boolean
 *       404:
 *         description: Member not found
 */
// router.patch("/:id/user-status", auth, memberController.toggleUserStatus);

/**
 * @swagger
 * /api/members/{id}/reference-details:
 *   get:
 *     summary: Get member details for reference autofill
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member details retrieved successfully
 *       404:
 *         description: Member not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id/reference-details",
  auth,
  memberController.getMemberDetailsForReference
);

module.exports = router;
