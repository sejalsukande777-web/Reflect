const Entry = require('../models/Entry');

// GET /api/stats/streak
const getStreak = async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.user._id }).sort({ date: 1 });
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (entries.length === 0) {
      return res.status(200).json({ currentStreak: 0, longestStreak: 0, writtenToday: false });
    }

    const dates = entries.map(e => e.date);
    const writtenToday = dates.includes(today);

    // Longest streak
    let longestStreak = 1, tempStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
      if (diff === 1) { tempStreak++; if (tempStreak > longestStreak) longestStreak = tempStreak; }
      else tempStreak = 1;
    }

    // Current streak (count backwards from today or yesterday)
    const lastDate = dates[dates.length - 1];
    let currentStreak = 0;
    if (lastDate === today || lastDate === yesterday) {
      currentStreak = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
        if (diff === 1) currentStreak++;
        else break;
      }
    }

    res.status(200).json({ currentStreak, longestStreak, writtenToday });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/stats/mood
const getMoodStats = async (req, res) => {
  try {
    const entries = await Entry.find({ userId: req.user._id });
    const distribution = { happy: 0, neutral: 0, low: 0, stressed: 0, motivated: 0 };
    entries.forEach(e => { if (distribution[e.mood] !== undefined) distribution[e.mood]++; });

    // Find top mood
    const topMood = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    res.status(200).json({ distribution, topMood });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/stats/summary
const getSummary = async (req, res) => {
  try {
    const allEntries = await Entry.find({ userId: req.user._id });
    const totalEntries = allEntries.length;

    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonthPrefix = `${year}-${month}`;
    const daysPassed  = now.getDate();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

    const thisMonthEntries = allEntries.filter(e => e.date.startsWith(thisMonthPrefix));
    const daysWrittenThisMonth = thisMonthEntries.length;
    const daysMissedThisMonth  = Math.max(0, daysPassed - daysWrittenThisMonth);
    const disciplineScore = daysPassed > 0
      ? Math.min(100, Math.round((daysWrittenThisMonth / daysPassed) * 100))
      : 0;

    // Average word count
    const avgWords = totalEntries > 0
      ? Math.round(allEntries.reduce((sum, e) => {
          const text = e.reflectionText || '';
          return sum + (text.trim() ? text.trim().split(/\s+/).length : 0);
        }, 0) / totalEntries)
      : 0;

    // Weekly activity
    const weeklyActivity = { Sun:0, Mon:0, Tue:0, Wed:0, Thu:0, Fri:0, Sat:0 };
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    allEntries.forEach(e => { weeklyActivity[dayNames[new Date(e.date).getDay()]]++; });

    res.status(200).json({
      totalEntries,
      thisMonthEntries: daysWrittenThisMonth,
      daysWrittenThisMonth,
      daysMissedThisMonth,
      daysInMonth,
      disciplineScore,
      avgWords,
      weeklyActivity,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getStreak, getMoodStats, getSummary };