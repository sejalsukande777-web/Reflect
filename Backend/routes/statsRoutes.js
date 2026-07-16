const express = require('express');
const router = express.Router();

const { getStreak, getMoodStats, getSummary } = require('../controllers/statsController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.get('/streak', getStreak);    // Get current & longest streak
router.get('/mood', getMoodStats);   // Get mood distribution
router.get('/summary', getSummary);  // Get total entries, discipline score, weekly activity

module.exports = router;
