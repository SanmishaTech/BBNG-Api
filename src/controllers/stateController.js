/**
 * Controller for handling State-related operations.
 *
 * Provides functions to manage states, including retrieving, creating,
 * updating, and deleting states based on requests routed from stateRoutes.js.
 *
 * @module controllers/stateController
 */

const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const {z} = require("zod");
const createError = require("http-errors");
const validateRequest = require("../utils/validateRequest");

/**
 * @function getStates
 * @description Retrieves a list of states based on query parameters.
 * Handles pagination, searching, and sorting.
 * @param {object} req - Express request object. Expected query params: page, limit, search, sortBy, sortOrder.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the list of states or an error message.
 */
const getStates = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";
        const sortBy = req.query.sortBy || "name";
        const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
        
        // Build the where clause for filtering
        const whereClause = {
            OR: [
                { name: { contains: search } }
            ]
        };
        
        const states = await prisma.state.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder }
        });
        
        const totalStates = await prisma.state.count({
            where: whereClause
        });
        const totalPages = Math.ceil(totalStates / limit);
        
        res.json({
            states,
            page,
            totalPages,
            totalStates
        });
    } catch (error) {
        next(createError(500, "Failed to fetch states", { cause: error }));
    }
};

/**
 * @function getState
 * @description Retrieves a single state by ID.
 * @param {object} req - Express request object. Expected params: id.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the state or an error message.
 */
const getState = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return next(createError(400, "Invalid state ID"));
        }
        
        const state = await prisma.state.findUnique({
            where: { id }
        });
        
        if (!state) {
            return next(createError(404, "State not found"));
        }
        
        res.json(state);
    } catch (error) {
        next(createError(500, "Failed to fetch state", { cause: error }));
    }
};

/**
 * @function createState
 * @description Creates a new state.
 * @param {object} req - Express request object. Expected body: name.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the created state or an error message.
 */
const createState = async (req, res, next) => {
    try {
        const { name } = req.body;
        const state = await prisma.state.create({
            data: { name }
        });
        res.json(state);
    } catch (error) {
        next(createError(500, "Failed to create state", { cause: error }));
    }
};

/**
 * @function updateState
 * @description Updates an existing state.
 * @param {object} req - Express request object. Expected params: id, body: name.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with the updated state or an error message.
 */
const updateState = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return next(createError(400, "Invalid state ID"));
        }
        
        const { name } = req.body;
        
        if (!name || typeof name !== 'string') {
            return next(createError(400, "Name is required and must be a string"));
        }
        
        const state = await prisma.state.update({
            where: { id },
            data: { name }
        });
        
        res.json(state);
    } catch (error) {
        if (error.code === 'P2025') {
            return next(createError(404, "State not found"));
        }
        next(createError(500, "Failed to update state", { cause: error }));
    }
};

/**
 * @function deleteState
 * @description Deletes a state by ID.
 * @param {object} req - Express request object. Expected params: id.
 * @param {object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with a success message or an error message.
 */
const deleteState = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return next(createError(400, "Invalid state ID"));
        }
        
        await prisma.state.delete({
            where: { id }
        });
        
        res.json({ message: "State deleted successfully" });
    } catch (error) {
        if (error.code === 'P2025') {
            return next(createError(404, "State not found"));
        }
        next(createError(500, "Failed to delete state", { cause: error }));
    }
};

module.exports = { getStates, getState, createState, updateState, deleteState };
