const express = require('express');
const router = express.Router();
const thankYouSlipController = require('../controllers/thankYouSlipController');
const auth = require('../middleware/auth');

// Routes for thank you slips
router.post('/', auth, thankYouSlipController.createThankYouSlip);
router.get('/', auth, thankYouSlipController.getAllThankYouSlips);
// Specific routes must come before generic pattern routes
router.get('/reference/:referenceId', auth, thankYouSlipController.getThankYouSlipsForReference);
router.get('/:id', auth, thankYouSlipController.getThankYouSlipById);
router.put('/:id', auth, thankYouSlipController.updateThankYouSlip);
router.delete('/:id', auth, thankYouSlipController.deleteThankYouSlip);

module.exports = router;
