/* ============================================================
   dashboard.js — Reflect App
   Handles: Main dashboard (dashboard.html)
   API:
     GET /api/stats/summary  — total entries, discipline score
     GET /api/stats/streak   — current & longest streak
     GET /api/stats/mood     — top mood
     GET /api/entries        — recent entries list
     GET /api/entries/:date  — today's entry (for mood banner)
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';

/* ── Auth guard ──────────────────────────────────────────── */
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

const user = JSON.parse(localStorage.getItem('user') || '{}');


/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */

function authHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const MOOD_CONFIG = {
  happy:     { emoji: '😊', label: 'Happy',     cls: 'mood-happy'     },
  neutral:   { emoji: '😐', label: 'Neutral',   cls: 'mood-neutral'   },
  low:       { emoji: '😔', label: 'Low',        cls: 'mood-low'       },
  stressed:  { emoji: '😤', label: 'Stressed',  cls: 'mood-stressed'  },
  motivated: { emoji: '🔥', label: 'Motivated', cls: 'mood-motivated' },
};

// Daily quotes pool — deterministic by day of year
const QUOTES = [
  { text: "The only journey is the journey within.",                                   author: "Rainer Maria Rilke"  },
  { text: "We do not learn from experience. We learn from reflecting on experience.",  author: "John Dewey"          },
  { text: "In the middle of difficulty lies opportunity.",                             author: "Albert Einstein"     },
  { text: "Small steps every day lead to big change over time.",                       author: "Unknown"             },
  { text: "Your life is your story. Write well. Edit often.",                          author: "Susan Statham"       },
  { text: "Growth is never by mere chance; it is the result of forces working together.", author: "James Cash Penney" },
  { text: "What you do today can improve all your tomorrows.",                         author: "Ralph Marston"       },
];


/* ══════════════════════════════════════════════════════════
   POPULATE UI BASICS  (no API needed)
   ══════════════════════════════════════════════════════════ */

function populateBasics() {
  const name = user.name || 'there';

  const topbarGreeting = document.getElementById('topbarGreeting');
  if (topbarGreeting) topbarGreeting.textContent = `${getGreeting()}, ${name} 🌿`;

  const topbarDate = document.getElementById('topbarDate');
  if (topbarDate) topbarDate.textContent = formatToday();

  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = name;

  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();

  // Daily quote — deterministic pick by day of year
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const q = QUOTES[dayOfYear % QUOTES.length];

  const quoteText   = document.getElementById('quoteText');
  const quoteAuthor = document.getElementById('quoteAuthor');
  if (quoteText)   quoteText.textContent   = q.text;
  if (quoteAuthor) quoteAuthor.textContent = `— ${q.author}`;
}


/* ══════════════════════════════════════════════════════════
   LOAD STATS
   ══════════════════════════════════════════════════════════ */

async function loadStats() {
  try {
    const res  = await fetch(`${API_BASE}/stats/summary`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Stats API ${res.status}`);
    const data = await res.json();

    const statTotal = document.getElementById('statTotal');
    if (statTotal) statTotal.textContent = data.totalEntries ?? 0;

    const statTotalSub = document.getElementById('statTotalSub');
    if (statTotalSub) {
      const n = data.totalEntries ?? 0;
      statTotalSub.textContent = n === 1 ? '1 entry written' : `${n} entries written`;
    }

    const statDiscipline = document.getElementById('statDiscipline');
    if (statDiscipline) statDiscipline.textContent = (data.disciplineScore ?? 0) + '%';

    const qsDaysWritten = document.getElementById('qsDaysWritten');
    if (qsDaysWritten) qsDaysWritten.textContent = (data.daysWrittenThisMonth ?? 0) + ' days';

    const qsDaysMissed = document.getElementById('qsDaysMissed');
    if (qsDaysMissed) qsDaysMissed.textContent = (data.daysMissedThisMonth ?? 0) + ' days';

    const qsAvgWords = document.getElementById('qsAvgWords');
    if (qsAvgWords) qsAvgWords.textContent = (data.avgWords ?? 0) + ' words';

  } catch (err) {
    console.warn('Stats load failed:', err);
  }
}


/* ══════════════════════════════════════════════════════════
   LOAD STREAK
   ══════════════════════════════════════════════════════════ */

async function loadStreak() {
  try {
    const res  = await fetch(`${API_BASE}/stats/streak`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Streak API ${res.status}`);
    const data = await res.json();

    const curr = data.currentStreak ?? 0;
    const best = data.longestStreak ?? 0;

    const statStreak = document.getElementById('statStreak');
    if (statStreak) statStreak.textContent = curr;

    const statStreakSub = document.getElementById('statStreakSub');
    if (statStreakSub) statStreakSub.textContent = curr === 1 ? 'day in a row' : 'days in a row';

    const statLongest = document.getElementById('statLongest');
    if (statLongest) statLongest.textContent = best;

    const streakNum = document.getElementById('streakNum');
    if (streakNum) streakNum.textContent = curr;

    const streakBest = document.getElementById('streakBest');
    if (streakBest) streakBest.textContent = `${best} days`;

    // Show nudge if user hasn't written today
    if (!data.writtenToday) {
      const nudge = document.getElementById('streakNudge');
      if (nudge) nudge.classList.add('visible');
    }

  } catch (err) {
    console.warn('Streak load failed:', err);
  }
}


/* ══════════════════════════════════════════════════════════
   LOAD MOOD  +  TODAY'S ENTRY
   ══════════════════════════════════════════════════════════ */

async function loadMood() {
  try {
    // Top mood across all entries
    const res  = await fetch(`${API_BASE}/stats/mood`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Mood API ${res.status}`);
    const data = await res.json();

    const qsMood = document.getElementById('qsMood');
    if (qsMood && data.topMood) qsMood.textContent = data.topMood;

    // Check today's entry specifically for the mood banner
    const today    = new Date().toISOString().split('T')[0];
    const entryRes = await fetch(`${API_BASE}/entries/${today}`, { headers: authHeaders() });

    if (entryRes.ok) {
      const entry = await entryRes.json();

      if (entry && entry.mood) {
        const m = MOOD_CONFIG[entry.mood] || { emoji: '✨', label: entry.mood };

        const bannerIcon  = document.getElementById('moodBannerIcon');
        const bannerValue = document.getElementById('moodBannerValue');
        if (bannerIcon)  bannerIcon.textContent  = m.emoji;
        if (bannerValue) bannerValue.textContent = m.label;

        // Hide the "write today" CTA since user already wrote
        const writeCta = document.getElementById('writeCta');
        if (writeCta) writeCta.style.display = 'none';
      }
    }

  } catch (err) {
    console.warn('Mood load failed:', err);
  }
}


/* ══════════════════════════════════════════════════════════
   LOAD RECENT ENTRIES
   ══════════════════════════════════════════════════════════ */

async function loadEntries() {
  const skeleton   = document.getElementById('entriesSkeleton');
  const list       = document.getElementById('entriesList');
  const emptyState = document.getElementById('entriesEmpty');

  try {
    const res     = await fetch(`${API_BASE}/entries`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Entries API ${res.status}`);
    const entries = await res.json();

    if (skeleton) skeleton.style.display = 'none';

    if (!entries || entries.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (list) list.style.display = 'flex';

    // Show the 5 most recent entries
    const recent = entries.slice(0, 5);

    recent.forEach(entry => {
      const m   = MOOD_CONFIG[entry.mood] || { emoji: '✨', label: entry.mood || 'No mood', cls: 'mood-neutral' };
      const div = document.createElement('a');
      div.href      = `journal.html?date=${entry.date}`;
      div.className = 'entry-card';
      div.innerHTML = `
        <div class="entry-card-top">
          <span class="entry-date">${formatDate(entry.date)}</span>
          <span class="entry-mood-badge ${m.cls}">${m.emoji} ${m.label}</span>
        </div>
        <div class="entry-preview ${entry.content ? '' : 'empty'}">
          ${entry.content
            ? entry.content.substring(0, 160) + (entry.content.length > 160 ? '…' : '')
            : 'No reflection text saved.'}
        </div>
      `;
      if (list) list.appendChild(div);
    });

  } catch (err) {
    console.warn('Entries load failed:', err);
    if (skeleton)   skeleton.style.display   = 'none';
    if (emptyState) emptyState.style.display = 'block';
  }
}


/* ══════════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════════ */

function attachEventListeners() {
  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    });
  }

  // Mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  const openSidebar  = () => { sidebar?.classList.add('open');    overlay?.classList.add('visible');    };
  const closeSidebar = () => { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); };

  // Dashboard.html uses onclick="openSidebar()" on the button, so expose globally too
  window.openSidebar  = openSidebar;
  window.closeSidebar = closeSidebar;

  if (overlay) overlay.addEventListener('click', closeSidebar);
}


/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

async function init() {
  populateBasics();
  attachEventListeners();

  // Load all data in parallel
  await Promise.all([
    loadStats(),
    loadStreak(),
    loadMood(),
    loadEntries(),
  ]);

  // Remove page loader
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
}

init();
