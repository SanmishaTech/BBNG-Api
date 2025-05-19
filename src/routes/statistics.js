const express = require("express");
const router = express.Router();
const statisticsController = require("../controllers/statisticsController");

/**
 * @route GET /api/statistics/business-generated
 * @desc Get BBNG business generated statistics
 * @access Private
 */
router.get("/business-generated", async (req, res) => {
  try {
    const businessStats = await statisticsController.getBusinessGenerated();
    res.json(businessStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/references-count
 * @desc Get total reference count
 * @access Private
 */
router.get("/references-count", async (req, res) => {
  try {
    const referencesStats = await statisticsController.getReferencesCount();
    res.json(referencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/total-visitors
 * @desc Get total visitors statistics
 * @access Private
 */
router.get("/total-visitors", async (req, res) => {
  try {
    const totalVisitorsStats = await statisticsController.getTotalVisitors();
    res.json(totalVisitorsStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/one-to-one
 * @desc Get count of one-to-one meetings with accepted status
 * @access Private
 */
router.get("/one-to-one", async (req, res) => {
  try {
    const oneToOneStats = await statisticsController.getOneToOne();
    res.json(oneToOneStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/member-given-references/:memberId
 * @desc Get count of references given by a specific member
 * @access Private
 */
router.get("/member-given-references/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const givenReferencesStats =
      await statisticsController.getMemberGivenReferences({ memberId });
    res.json(givenReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-business-generated/:chapterId
 * @desc Get business generated (sum of thank you slip amounts) for a specific chapter
 * @access Private
 */
router.get("/chapter-business-generated/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterBusinessStats =
      await statisticsController.getChapterBusinessGenerated({ chapterId });
    res.json(chapterBusinessStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-references-count/:chapterId
 * @desc Get count of references for a specific chapter
 * @access Private
 */
router.get("/chapter-references-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterReferencesStats =
      await statisticsController.getChapterReferencesCount({ chapterId });
    res.json(chapterReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-visitors-count/:chapterId
 * @desc Get count of visitors for a specific chapter
 * @access Private
 */
router.get("/chapter-visitors-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterVisitorsStats =
      await statisticsController.getChapterVisitorsCount({ chapterId });
    res.json(chapterVisitorsStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-one-to-one-count/:chapterId
 * @desc Get count of one-to-one meetings for a specific chapter
 * @access Private
 */
router.get("/chapter-one-to-one-count/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const chapterOneToOneStats =
      await statisticsController.getChapterOneToOneCount({ chapterId });
    res.json(chapterOneToOneStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/recent-messages
 * @desc Get list of recent messages (global only)
 * @access Private
 */
router.get("/recent-messages", async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({ limit });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/member-messages/:memberId
 * @desc Get list of recent messages for a member (includes both global and chapter-specific)
 * @access Private
 */
router.get("/member-messages/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({
      memberId,
      limit,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-messages/:chapterId
 * @desc Get list of recent messages for a specific chapter (includes both global and chapter-specific)
 * @access Private
 */
router.get("/chapter-messages/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const limit = req.query.limit || 5;
    const messages = await statisticsController.getRecentMessages({
      chapterId: chapterId,
      limit,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/member-chapter-meetings/:memberId
 * @desc Get list of recent meetings for a member's chapter
 * @access Private
 */
router.get("/member-chapter-meetings/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const limit = req.query.limit || 5;
    const meetings = await statisticsController.getRecentChapterMeetings({
      memberId,
      limit,
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/chapter-meetings/:chapterId
 * @desc Get list of recent meetings for a specific chapter
 * @access Private
 */
router.get("/chapter-meetings/:chapterId", async (req, res) => {
  try {
    const chapterId = req.params.chapterId;
    const limit = req.query.limit || 5;
    const meetings = await statisticsController.getRecentChapterMeetings({
      chapterId: chapterId,
      limit,
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/trainings
 * @desc Get list of all trainings
 * @access Private
 */
router.get("/trainings", async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const trainings = await statisticsController.getTrainings({ limit });
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/upcoming-birthdays
 * @desc Get list of upcoming birthdays
 * @access Private
 */
router.get("/upcoming-birthdays", async (req, res) => {
  try {
    const daysAhead = req.query.daysAhead || 180;
    const limit = req.query.limit || 5;
    const birthdays = await statisticsController.getUpcomingBirthdays({ 
      daysAhead,
      limit 
    });
    res.json(birthdays);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/statistics/member-received-references/:memberId
 * @desc Get count of references received by a specific member
 * @access Private
 */
router.get("/member-received-references/:memberId", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const receivedReferencesStats =
      await statisticsController.getMemberReceivedReferences({ memberId });
    res.json(receivedReferencesStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
