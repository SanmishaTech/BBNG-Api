const express = require('express');
const router = express.Router();
const thankYouSlipController = require('../controllers/thankYouSlipController');
const auth = require('../middleware/auth');

// Routes for thank you slips
router.post('/', auth, thankYouSlipController.createThankYouSlip);
router.get('/', auth, thankYouSlipController.getAllThankYouSlips);
// Specific routes must come before generic pattern routes
router.get('/my-chapters', auth, thankYouSlipController.getUserChapters);
router.get('/chapters', auth, thankYouSlipController.getAllChapters);
router.get('/members/chapter/:chapterId', auth, thankYouSlipController.getMembersByChapter);
router.get('/given', auth, thankYouSlipController.getGivenThankYouSlips);
router.get('/received', auth, thankYouSlipController.getReceivedThankYouSlips);
router.get('/reference/:referenceId', auth, thankYouSlipController.getThankYouSlipsForReference);
router.get('/:id', auth, thankYouSlipController.getThankYouSlipById);
router.put('/:id', auth, thankYouSlipController.updateThankYouSlip);
router.delete('/:id', auth, thankYouSlipController.deleteThankYouSlip);

module.exports = router;
