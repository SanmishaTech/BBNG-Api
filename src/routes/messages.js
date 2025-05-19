/**
 * Express Router configuration for Message management endpoints.
 *
 * This file defines the routes for handling CRUD operations on messages,
 * including fetching, creating, updating, and deleting messages.
 * It utilizes authentication and access control list (ACL) middleware
 * to secure the endpoints and includes Swagger documentation annotations.
 *
 * @module routes/messageRoutes
 */

const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middleware/auth");
const acl = require("../middleware/acl");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'attachment-' + uniqueSuffix + ext);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    req.fileValidationError = {
      type: 'file_type',
      message: 'Unsupported file type. Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT'
    };
    cb(null, false);
  }
};

// Configure multer with limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Handle file size errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        errors: {
          attachment: {
            type: 'file_size',
            message: 'File is too large. Maximum size is 10MB.'
          }
        }
      });
    }
  }
  next(err);
};

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Message management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       required:
 *         - heading
 *         - powerteam
 *         - message
 *       properties:
 *         id:
 *           type: integer
 *         heading:
 *           type: string
 *         powerteam:
 *           type: string
 *         message:
 *           type: string
 *         attachment:
 *           type: string
 *           description: JSON string containing file metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: List all messages
 *     tags: [Messages]
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
 *       - in: query
 *         name: powerteam
 *         schema:
 *           type: string
 *         description: Filter by power team
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalMessages:
 *                   type: integer
 */
router.get("/", auth, messageController.getMessages);

/**
 * @swagger
 * /messages/{id}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
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
 *               $ref: '#/components/schemas/Message'
 *       404:
 *         description: Message not found
 */
router.get("/:id", auth, messageController.getMessageById);

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Create a new message
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [heading, powerteam, message]
 *             properties:
 *               heading: 
 *                 type: string
 *                 description: Message heading
 *               powerteam: 
 *                 type: string
 *                 description: Power team name
 *               message: 
 *                 type: string
 *                 description: Message content
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Bad request
 */
router.post("/", auth, upload.single('attachment'), handleUploadErrors, messageController.createMessage);

/**
 * @swagger
 * /messages/{id}:
 *   put:
 *     summary: Update a message
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               heading: 
 *                 type: string
 *                 description: Message heading
 *               powerteam: 
 *                 type: string
 *                 description: Power team name
 *               message: 
 *                 type: string
 *                 description: Message content
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: New file attachment
 *               removeAttachment:
 *                 type: boolean
 *                 description: Set to true to remove the current attachment
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       404:
 *         description: Message not found
 */
router.put("/:id", auth, upload.single('attachment'), handleUploadErrors, messageController.updateMessage);

/**
 * @swagger
 * /messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Message not found
 */
router.delete("/:id", auth, messageController.deleteMessage);

/**
 * @swagger
 * /messages/{id}/attachment:
 *   get:
 *     summary: Download message attachment
 *     tags: [Messages]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: File download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Message or attachment not found
 */
router.get("/:id/attachment", auth, messageController.downloadAttachment);

module.exports = router; 