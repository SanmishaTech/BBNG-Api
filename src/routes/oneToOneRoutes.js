const express = require('express');
const router = express.Router();
const { 
  listOneToOnes, 
  getOneToOneById, 
  createOneToOne, 
  updateOneToOne, 
  updateOneToOneStatus,
  deleteOneToOne,
  getReceivedOneToOnes,
  getRequestedOneToOnes
} = require('../controllers/oneToOneController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// GET routes
router.get('/', listOneToOnes);
router.get('/received', getReceivedOneToOnes);
router.get('/requested', getRequestedOneToOnes);
router.get('/:id', getOneToOneById);

// POST routes
router.post('/', createOneToOne);

// PATCH routes
router.patch('/:id', updateOneToOne);
router.patch('/:id/status', updateOneToOneStatus);

// DELETE routes
router.delete('/:id', deleteOneToOne);

module.exports = router; 