/**
 * Controller for handling Message-related operations.
 *
 * Provides functions to manage messages, including retrieving, creating,
 * updating, and deleting messages based on requests routed from messageRoutes.js.
 *
 * @module controllers/messageController
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { z } = require("zod");
const validateRequest = require("../utils/validateUpload");
const createError = require("http-errors");
const fs = require("fs");
const path = require("path");

/**
 * @function getMessages
 * @description Retrieves a list of messages based on query parameters.
 * Handles pagination, searching, sorting, and exporting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder, export.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of messages or an error message.
 */
const getMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    const powerteam = req.query.powerteam || "";

    // Build the where clause for filtering
    const whereClause = {
      OR: [
        { heading: { contains: search } },
        { message: { contains: search } }
      ]
    };

    // Add powerteam filter if provided
    if (powerteam) {
      whereClause.powerteam = powerteam;
    }
    
    const messages = await prisma.message.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    });
    
    const totalMessages = await prisma.message.count({
      where: whereClause
    });
    const totalPages = Math.ceil(totalMessages / limit);
    
    res.json({
      messages,
      page,
      totalPages,
      totalMessages
    });
  } catch (error) {
    next(createError(500, "Failed to fetch messages", { cause: error }));
  }
};

/**
 * @function createMessage
 * @description Creates a new message with optional file attachment.
 * @param {object} req - Express request object. Expected body: { heading: string, powerteam: string, message: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created message or an error message.
 */
const createMessage = async (req, res, next) => {
  let uploadedFile = null;
  if (req.file) {
    uploadedFile = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    };
  }

  // Define Zod schema for message creation
  const schema = z.object({
    heading: z.string()
      .min(1, "Heading cannot be empty")
      .max(255, "Heading must not exceed 255 characters"),
    powerteam: z.string()
      .min(1, "Power team cannot be empty")
      .max(100, "Power team must not exceed 100 characters"),
    message: z.string()
      .min(1, "Message cannot be empty")
      .max(5000, "Message must not exceed 5000 characters")
  });

  // Validate the request body using Zod
  console.log('Create Message - Request received:', req.body);
  
  // Handle file upload errors if any
  const uploadErrors = {};
  if (req.fileValidationError) {
    uploadErrors.attachment = req.fileValidationError;
  }

  const validationResult = await validateRequest(schema, req.body, uploadErrors);
  console.log('Create Message - Validation result:', validationResult);
  
  // If validation failed, response is already sent by validateRequest
  if (!validationResult.success) {
    // Delete the uploaded file if validation fails
    if (uploadedFile && uploadedFile.path) {
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.error('Error deleting file after validation failure:', err);
      });
    }
    return res.status(400).json({ errors: validationResult.errors });
  }

  try {
    const newMessage = await prisma.message.create({
      data: {
        heading: req.body.heading,
        powerteam: req.body.powerteam,
        message: req.body.message,
        attachment: uploadedFile ? JSON.stringify(uploadedFile) : null
      }
    });
    
    res.status(201).json(newMessage);
  } catch (error) {
    // Delete the uploaded file if database operation fails
    if (uploadedFile && uploadedFile.path) {
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.error('Error deleting file after database error:', err);
      });
    }
    
    next(createError(500, "Failed to create message", { cause: error }));
  }
};

/**
 * @function getMessageById
 * @description Retrieves a single message by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the message data or an error message.
 */
const getMessageById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid message ID" }
      });
    }
    
    const message = await prisma.message.findUnique({ where: { id } });
    
    if (!message) {
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    res.json(message);
  } catch (error) {
    next(createError(500, "Failed to fetch message", { cause: error }));
  }
};

/**
 * @function updateMessage
 * @description Updates an existing message by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }. Body: { heading?: string, powerteam?: string, message?: string }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated message or an error message.
 */
const updateMessage = async (req, res, next) => {
  const id = Number(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      errors: { message: "Invalid message ID" }
    });
  }

  let uploadedFile = null;
  if (req.file) {
    uploadedFile = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    };
  }
  
  // Define Zod schema for message update
  const schema = z.object({
    heading: z.string()
      .min(1, "Heading cannot be empty")
      .max(255, "Heading must not exceed 255 characters")
      .optional(),
    powerteam: z.string()
      .min(1, "Power team cannot be empty")
      .max(100, "Power team must not exceed 100 characters")
      .optional(),
    message: z.string()
      .min(1, "Message cannot be empty")
      .max(5000, "Message must not exceed 5000 characters")
      .optional(),
    removeAttachment: z.boolean().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });

  // Handle file upload errors if any
  const uploadErrors = {};
  if (req.fileValidationError) {
    uploadErrors.attachment = req.fileValidationError;
  }

  // Validate the request body using Zod
  console.log('Update Message - Request received:', req.body);
  const validationResult = await validateRequest(schema, req.body, uploadErrors);
  console.log('Update Message - Validation result:', validationResult);
  
  // If validation failed, response is already sent by validateRequest
  if (!validationResult.success) {
    // Delete the uploaded file if validation fails
    if (uploadedFile && uploadedFile.path) {
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.error('Error deleting file after validation failure:', err);
      });
    }
    return res.status(400).json({ errors: validationResult.errors });
  }

  try {
    // First check if the message exists
    const existingMessage = await prisma.message.findUnique({
      where: { id }
    });
    
    if (!existingMessage) {
      // Delete the uploaded file if message doesn't exist
      if (uploadedFile && uploadedFile.path) {
        fs.unlink(uploadedFile.path, (err) => {
          if (err) console.error('Error deleting file when message not found:', err);
        });
      }
      
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    const data = {};
    
    if (req.body.heading !== undefined) {
      data.heading = req.body.heading;
    }
    
    if (req.body.powerteam !== undefined) {
      data.powerteam = req.body.powerteam;
    }
    
    if (req.body.message !== undefined) {
      data.message = req.body.message;
    }

    // Handle attachment updates
    if (uploadedFile) {
      data.attachment = JSON.stringify(uploadedFile);
      
      // Delete the old attachment if exists
      if (existingMessage.attachment) {
        try {
          const oldAttachment = JSON.parse(existingMessage.attachment);
          if (oldAttachment.path) {
            fs.unlink(oldAttachment.path, (err) => {
              if (err) console.error('Error deleting old attachment:', err);
            });
          }
        } catch (e) {
          console.error('Error parsing old attachment:', e);
        }
      }
    } else if (req.body.removeAttachment === true) {
      data.attachment = null;
      
      // Delete the old attachment if exists
      if (existingMessage.attachment) {
        try {
          const oldAttachment = JSON.parse(existingMessage.attachment);
          if (oldAttachment.path) {
            fs.unlink(oldAttachment.path, (err) => {
              if (err) console.error('Error deleting old attachment:', err);
            });
          }
        } catch (e) {
          console.error('Error parsing old attachment:', e);
        }
      }
    }
    
    const updatedMessage = await prisma.message.update({
      where: { id },
      data
    });
    
    res.json(updatedMessage);
  } catch (error) {
    // Delete the uploaded file if database operation fails
    if (uploadedFile && uploadedFile.path) {
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.error('Error deleting file after database error:', err);
      });
    }
    
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    next(createError(500, "Failed to update message", { cause: error }));
  }
};

/**
 * @function deleteMessage
 * @description Deletes a message by its ID.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with success message or an error message.
 */
const deleteMessage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid message ID" }
      });
    }
    
    // First get the message to check for attachments
    const message = await prisma.message.findUnique({ where: { id } });
    
    if (!message) {
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    // Delete the message
    await prisma.message.delete({ where: { id } });
    
    // Delete the attachment if exists
    if (message.attachment) {
      try {
        const attachment = JSON.parse(message.attachment);
        if (attachment.path) {
          fs.unlink(attachment.path, (err) => {
            if (err) console.error('Error deleting attachment:', err);
          });
        }
      } catch (e) {
        console.error('Error parsing attachment:', e);
      }
    }
    
    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    next(createError(500, "Failed to delete message", { cause: error }));
  }
};

/**
 * @function downloadAttachment
 * @description Downloads an attachment for a specific message.
 * @param {object} req - Express request object. Expected params: { id: number }.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends the file as a response or an error message.
 */
const downloadAttachment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid message ID" }
      });
    }
    
    const message = await prisma.message.findUnique({ where: { id } });
    
    if (!message) {
      return res.status(404).json({
        errors: { message: "Message not found" }
      });
    }
    
    if (!message.attachment) {
      return res.status(404).json({
        errors: { message: "No attachment found for this message" }
      });
    }
    
    try {
      const attachment = JSON.parse(message.attachment);
      
      if (!attachment.path || !fs.existsSync(attachment.path)) {
        return res.status(404).json({
          errors: { message: "Attachment file not found" }
        });
      }
      
      res.download(attachment.path, attachment.originalname);
    } catch (e) {
      return res.status(500).json({
        errors: { message: "Error processing attachment data" }
      });
    }
  } catch (error) {
    next(createError(500, "Failed to download attachment", { cause: error }));
  }
};

module.exports = {
  getMessages,
  createMessage,
  getMessageById,
  updateMessage,
  deleteMessage,
  downloadAttachment
}; 