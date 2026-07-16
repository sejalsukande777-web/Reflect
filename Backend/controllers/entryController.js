const Entry = require('../models/Entry');

// POST /api/entries
const createEntry = async (req, res) => {
  const { date, mood, content, reflectionText, improvements, improvedToday, improveTomorrow } = req.body;
  const text = content || reflectionText; // accept either field name

  try {
    if (!date || !mood || !text) {
      return res.status(400).json({ message: 'date, mood, and content are required' });
    }
    const existingEntry = await Entry.findOne({ userId: req.user._id, date });
    if (existingEntry) {
      return res.status(400).json({ message: 'Entry for this date already exists. Please update it instead.' });
    }
    const entry = await Entry.create({
      userId: req.user._id,
      date,
      mood,
      reflectionText: text,
      improvedToday:    improvedToday    || improvements || '',
      improveTomorrow:  improveTomorrow  || '',
    });
    // Return with 'content' alias so frontend can read either field
    res.status(201).json({ ...entry.toObject(), content: entry.reflectionText });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/entries
const getAllEntries = async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.user._id }).sort({ date: -1 });
    // Add 'content' alias to every entry
    const mapped = entries.map(e => ({ ...e.toObject(), content: e.reflectionText }));
    res.status(200).json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/entries/:date
const getEntryByDate = async (req, res) => {
  try {
    const entry = await Entry.findOne({ userId: req.user._id, date: req.params.date });
    if (!entry) return res.status(404).json({ message: 'No entry found for this date' });
    res.status(200).json({ ...entry.toObject(), content: entry.reflectionText });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/entries/:id
const updateEntry = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed to edit this entry' });
    }

    // Allow 'content' as alias for reflectionText
    const updateData = { ...req.body };
    if (updateData.content && !updateData.reflectionText) {
      updateData.reflectionText = updateData.content;
    }
    if (updateData.improvements && !updateData.improvedToday) {
      updateData.improvedToday = updateData.improvements;
    }

    const updated = await Entry.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.status(200).json({ ...updated.toObject(), content: updated.reflectionText });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/entries/:id
const deleteEntry = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed to delete this entry' });
    }
    await entry.deleteOne();
    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createEntry, getAllEntries, getEntryByDate, updateEntry, deleteEntry };