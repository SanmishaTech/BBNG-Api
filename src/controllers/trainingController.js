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
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "trainingDate";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    
    // Build the where clause for filtering
    const whereClause = {
      OR: [
        { trainingTopic: { contains: search } }
      ]
    };
    
    const trainings = await prisma.training.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
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
    trainingDate: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: "Training date must be a valid date"
      }),
    trainingTopic: z.string()
      .min(1, "Training topic cannot be empty")
      .max(255, "Training topic must not exceed 255 characters")
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
        trainingDate: new Date(validatedData.trainingDate),
        trainingTopic: validatedData.trainingTopic
      }
    });
    
    console.log('Create Training - Training created successfully:', newTraining);
    
    res.status(201).json(newTraining);
  } catch (error) {
    console.error('Create Training - Error:', error);
    
    // Handle specific error types
    if (error.code === 'P2002') {
      return res.status(400).json({
        errors: { message: "A training with this date and topic already exists" }
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
    trainingDate: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: "Training date must be a valid date"
      })
      .optional(),
    trainingTopic: z.string()
      .min(1, "Training topic cannot be empty")
      .max(255, "Training topic must not exceed 255 characters")
      .optional()
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
    
    if (validatedData.trainingDate) {
      data.trainingDate = new Date(validatedData.trainingDate);
    }
    
    if (validatedData.trainingTopic) {
      data.trainingTopic = validatedData.trainingTopic;
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