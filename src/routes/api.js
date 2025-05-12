const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const referenceRoutes = require('./referenceRoutes');
const chapterRoutes = require('./chapterRoutes');
const oneToOneRoutes = require('./oneToOneRoutes');
// ... import other route modules as needed

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/references', referenceRoutes);
router.use('/chapters', chapterRoutes);
router.use('/one-to-ones', oneToOneRoutes);
// ... mount other routes as needed

module.exports = router; 