/**
 * Express router for state operations.
 * @module routes/state
 */

const express = require('express');
const router = express.Router();
const { getStates, getState, createState, updateState, deleteState } = require('../controllers/stateController');
const auth = require('../middleware/auth'); // Auth middleware as default export

// GET /api/states - Get all states with pagination and search
router.get('/', auth, getStates);

// GET /api/states/:id - Get a specific state by ID
router.get('/:id', auth, getState);

// POST /api/states - Create a new state
router.post('/', auth, createState);

// PUT /api/states/:id - Update a state
router.put('/:id', auth, updateState);

// DELETE /api/states/:id - Delete a state
router.delete('/:id', auth, deleteState);

module.exports = router;
