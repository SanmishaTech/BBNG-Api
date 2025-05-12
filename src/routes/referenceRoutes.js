const express = require('express');
const router = express.Router();
const { 
  listReferences, 
  getReferenceById, 
  createReference, 
  updateReference, 
  deleteReference,
  updateReferenceStatus,
  getGivenReferences,
  getReceivedReferences,
  getMemberInfoForReference
} = require('../controllers/referenceController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Routes - ORDER IS IMPORTANT
// Define specific routes before parameter routes

// GET routes with specific paths
router.get('/given', getGivenReferences);
router.get('/received', getReceivedReferences);
router.get('/member/:memberId', getMemberInfoForReference);

// Main collection route
router.get('/', listReferences);

// Routes with params - MUST come after specific routes
router.get('/:id', getReferenceById);
router.post('/', createReference);
router.put('/:id', updateReference);
router.delete('/:id', deleteReference);
router.patch('/:id/status', updateReferenceStatus);

module.exports = router; 