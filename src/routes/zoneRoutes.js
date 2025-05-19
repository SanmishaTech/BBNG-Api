const express = require('express');
const router = express.Router();
const { getChaptersByZone } = require('../controllers/zoneController');
const { isAuthenticated } = require('../middleware/auth'); // Assuming you have auth middleware

// GET /api/zones/:zoneId/chapters - Fetches chapters for a given zone
router.get('/:zoneId/chapters', isAuthenticated, getChaptersByZone);

// You can add other zone-specific routes here later, for example:
// router.get('/', isAuthenticated, getAllZones); // To list all zones
// router.get('/:zoneId/roles', isAuthenticated, getZoneRoles); // Moved from chapterController or new
// router.post('/:zoneId/roles', isAuthenticated, assignZoneRole); // Moved from chapterController or new
// router.delete('/roles/:assignmentId', isAuthenticated, removeZoneRole); // Moved from chapterController or new

module.exports = router;
