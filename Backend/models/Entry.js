const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD e.g. "2026-03-25"
      required: true,
    },
    mood: {
      type: String,
      enum: ['happy', 'neutral', 'low', 'stressed', 'motivated'],
      required: true,
    },
    reflectionText: {
      type: String,
      required: [true, 'Please write your reflection'],
    },
    improvedToday: {
      type: String,
      default: '',
    },
    improveTomorrow: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// One entry per user per day only
entrySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Entry', entrySchema);
