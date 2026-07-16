const express = require('express');
const router = express.Router();

const {
  createEntry,
  getAllEntries,
  getEntryByDate,
  updateEntry,
  deleteEntry,
} = require('../controllers/entryController');

const { protect } = require('../middleware/authMiddleware');

// All routes are protected — user must be logged in
router.use(protect);

router.post('/', createEntry);           // Create new entry
router.get('/', getAllEntries);           // Get all entries
router.get('/:date', getEntryByDate);    // Get entry by date e.g. /api/entries/2026-03-25
router.put('/:id', updateEntry);         // Update entry by ID
router.delete('/:id', deleteEntry);      // Delete entry by ID

module.exports = router;
