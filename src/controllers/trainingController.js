const prisma = require("../config/db");
const { z } = require("zod");
const validateRequest = require("../utils/validateRequest");
const validateTraining = require("../utils/trainingValidator");
const createError = require("http-errors");

/**
 * Get all trainings with pagination and filtering
 */
const getTrainings = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    let sortBy = req.query.sortBy || 'date'; // Default sort by new 'date' field
    const sortOrder = req.query.sortOrder || 'desc';
    const search = req.query.search || '';

    // Map old sortBy values to new field names if necessary
    if (sortBy === 'trainingDate') {
      sortBy = 'date';
    }
    if (sortBy === 'trainingTopic') {
      sortBy = 'title';
    }

    const offset = (page - 1) * limit;

    const whereClause = {
      OR: [
        { title: { contains: search } }, // Search by the new 'title' field
        // If you want to search by other fields, add them here
        // { venue: { contains: search } },
      ]
    };

    const trainings = await prisma.training.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const totalTrainings = await prisma.training.count({
      where: whereClause
    });
    const totalPages = Math.ceil(totalTrainings / limit);
    
    res.json({
      trainings,
      page,
      totalPages,
      totalTrainings
    });
  } catch (error) {
    console.error("Error in getTrainings:", error); // Detailed logging
    next(createError(500, "Failed to fetch trainings", { cause: error }));
  }
};

/**
 * Get training by ID
 */
const getTrainingById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid training ID" }
      });
    }
    
    const training = await prisma.training.findUnique({ where: { id } });
    
    if (!training) {
      return res.status(404).json({
        errors: { message: "Training not found" }
      });
    }
    
    res.json(training);
  } catch (error) {
    return res.status(500).json({
      errors: { message: "Failed to fetch training", details: error.message }
    });
  }
};

/**
 * Create a new training
 */
const createTraining = async (req, res, next) => {
  console.log('Create Training - Request received:', req.body);
  
  // Define Zod schema for training creation
  const schema = z.object({
    date: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: "Date is required and must be a valid date"
      }),
    time: z.string().min(1, "Time is required").max(50),
    title: z.string()
      .min(1, "Title is required")
      .max(255, "Title must not exceed 255 characters"),
    venue: z.string().min(1, "Venue is required").max(255),
  });

  console.log('Create Training - Validating request data');
  
  try {
    // Use the specialized training validator
    const validatedData = await validateTraining(schema, req.body, res);
    if (!validatedData) {
      console.log('Create Training - Validation failed, response already sent');
      return; // If validation failed, response is already sent
    }
    
    console.log('Create Training - Validation successful, creating training');
    
    const newTraining = await prisma.training.create({
      data: {
        date: new Date(validatedData.date),
        time: validatedData.time,
        title: validatedData.title,
        venue: validatedData.venue,
      }
    });
    
    console.log('Create Training - Training created successfully:', newTraining);
    
    res.status(201).json(newTraining);
  } catch (error) {
    console.error('Create Training - Error:', error);
    
    // Handle specific error types
    if (error.code === 'P2002') {
      return res.status(400).json({
        errors: { message: "A training with this date and title already exists" }
      });
    }
    
    next(createError(500, "Failed to create training", { cause: error }));
  }
};

/**
 * Update an existing training
 */
const updateTraining = async (req, res, next) => {
  console.log('Update Training - Request received:', req.params.id, req.body);
  
  const id = Number(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({
      errors: { message: "Invalid training ID" }
    });
  }
  
  // Define Zod schema for training update
  const schema = z.object({
    date: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: "Date must be a valid date"
      })
      .optional(),
    time: z.string()
      .min(1, "Time cannot be empty")
      .max(50, "Time must not exceed 50 characters")
      .optional(),
    title: z.string()
      .min(1, "Title cannot be empty")
      .max(255, "Title must not exceed 255 characters")
      .optional(),
    venue: z.string()
      .min(1, "Venue cannot be empty")
      .max(255, "Venue must not exceed 255 characters")
      .optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });

  console.log('Update Training - Validating request data');
  
  // Use the specialized training validator
  const validatedData = await validateTraining(schema, req.body, res);
  if (!validatedData) {
    console.log('Update Training - Validation failed, response already sent');
    return; // If validation failed, response is already sent
  }
  
  console.log('Update Training - Validation successful, updating training');

  try {
    // First check if the training exists
    const existingTraining = await prisma.training.findUnique({
      where: { id }
    });
    
    if (!existingTraining) {
      return res.status(404).json({
        errors: { message: "Training not found" }
      });
    }
    
    const data = {};
    
    if (validatedData.date) {
      data.date = new Date(validatedData.date);
    }
    
    if (validatedData.time) {
      data.time = validatedData.time;
    }
    
    if (validatedData.title) {
      data.title = validatedData.title;
    }

    if (validatedData.venue) {
      data.venue = validatedData.venue;
    }
    
    const updatedTraining = await prisma.training.update({
      where: { id },
      data
    });
    
    console.log('Update Training - Training updated successfully:', updatedTraining);
    
    res.json(updatedTraining);
  } catch (error) {
    console.error('Update Training - Error:', error);
    
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Training not found" }
      });
    }
    
    next(createError(500, "Failed to update training", { cause: error }));
  }
};

/**
 * Delete a training
 */
const deleteTraining = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        errors: { message: "Invalid training ID" }
      });
    }
    
    // First check if the training exists
    const existingTraining = await prisma.training.findUnique({
      where: { id }
    });
    
    if (!existingTraining) {
      return res.status(404).json({
        errors: { message: "Training not found" }
      });
    }
    
    await prisma.training.delete({ where: { id } });
    
    res.json({ message: "Training deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        errors: { message: "Training not found" }
      });
    }
    
    next(createError(500, "Failed to delete training", { cause: error }));
  }
};

module.exports = {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining
};