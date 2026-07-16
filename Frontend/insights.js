/* ============================================================
   insights.js — Reflect App
   Handles: Growth charts & mood history (insights.html)
   Requires: Chart.js (loaded in HTML via CDN)
   API:
     GET /api/stats/mood     — mood distribution
     GET /api/stats/summary  — totals & weekly activity
     GET /api/entries        — all entries for timeline chart
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

// Mood → display config
const MOOD_CONFIG = {
  happy:     { label: 'Happy',     color: '#4a7c59', bg: 'rgba(74,124,89,0.15)'    },
  motivated: { label: 'Motivated', color: '#c97c2c', bg: 'rgba(201,124,44,0.15)'   },
  neutral:   { label: 'Neutral',   color: '#8a9690', bg: 'rgba(138,150,144,0.15)'  },
  low:       { label: 'Low',       color: '#3a7bbf', bg: 'rgba(58,123,191,0.15)'   },
  stressed:  { label: 'Stressed',  color: '#c4686a', bg: 'rgba(196,104,106,0.15)'  },
};

// Numeric score for mood trend line
const MOOD_SCORE = { motivated: 5, happy: 4, neutral: 3, low: 2, stressed: 1 };

/** Format YYYY-MM-DD to short label (e.g. "Jan 5"). */
function shortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** Get last N days as YYYY-MM-DD strings (today last). */
function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** Global Chart.js defaults — match the Reflect design system. */
function applyChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family       = "'DM Sans', sans-serif";
  Chart.defaults.font.size         = 12;
  Chart.defaults.color             = '#8a9690';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1e2822';
  Chart.defaults.plugins.tooltip.titleColor       = 'white';
  Chart.defaults.plugins.tooltip.bodyColor        = 'rgba(255,255,255,0.7)';
  Chart.defaults.plugins.tooltip.padding          = 10;
  Chart.defaults.plugins.tooltip.cornerRadius     = 8;
}


/* ══════════════════════════════════════════════════════════
   CHART 1 — MOOD DISTRIBUTION  (Doughnut)
   Canvas ID: moodDonutChart
   ══════════════════════════════════════════════════════════ */

async function renderMoodChart() {
  const canvas = document.getElementById('moodDonutChart');
  if (!canvas) return;

  try {
    const res  = await fetch(`${API_BASE}/stats/mood`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Mood API ${res.status}`);
    const data = await res.json();

    /*
      Expected shape from backend:
      {
        topMood: "happy",
        distribution: { happy: 12, neutral: 8, low: 3, stressed: 2, motivated: 5 }
      }
    */
    const dist   = data.distribution || {};
    const labels = Object.keys(dist);
    const values = Object.values(dist);
    const colors = labels.map(k => MOOD_CONFIG[k]?.color || '#ccc');

    // Update top mood stat card if present
    const topMoodEl    = document.getElementById('topMoodValue');
    const topMoodEmoji = { happy: '😊', motivated: '🔥', neutral: '😐', low: '😔', stressed: '😤' };
    if (topMoodEl && data.topMood) {
      topMoodEl.textContent = `${topMoodEmoji[data.topMood] || ''} ${MOOD_CONFIG[data.topMood]?.label || data.topMood}`;
    }

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data:            values,
          backgroundColor: colors,
          borderWidth:     0,
          hoverOffset:     6,
        }],
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: {
            display:  true,
            position: 'bottom',
            labels: {
              padding:    16,
              usePointStyle: true,
              pointStyle: 'circle',
              color:      '#4a5550',
              font:       { size: 12 },
              generateLabels(chart) {
                const ds = chart.data.datasets[0];
                return chart.data.labels.map((lbl, i) => ({
                  text:        MOOD_CONFIG[lbl]?.label || lbl,
                  fillStyle:   ds.backgroundColor[i],
                  strokeStyle: ds.backgroundColor[i],
                  index:       i,
                }));
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} entries`,
            },
          },
        },
      },
    });

  } catch (err) {
    console.warn('Mood chart error:', err);
    showChartError('moodDonutChart', 'Could not load mood data.');
  }
}


/* ══════════════════════════════════════════════════════════
   CHART 2 — MOOD TREND OVER TIME  (Line)
   Canvas ID: moodTrendChart
   Uses entries to plot mood score over the last 30 days.
   ══════════════════════════════════════════════════════════ */

async function renderMoodTrendChart(entries) {
  const canvas = document.getElementById('moodTrendChart');
  if (!canvas) return;

  try {
    // Build a map of date → mood score from entries
    const entryMap = {};
    (entries || []).forEach(e => {
      if (e.date && e.mood) entryMap[e.date] = MOOD_SCORE[e.mood] ?? null;
    });

    const days   = lastNDays(30);
    const labels = days.map(shortDate);
    const values = days.map(d => entryMap[d] ?? null);

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data:            values,
          borderColor:     '#4a7c59',
          backgroundColor: 'rgba(74,124,89,0.08)',
          borderWidth:     2,
          pointRadius:     3,
          pointBackgroundColor: '#4a7c59',
          pointHoverRadius:    5,
          tension:         0.4,
          fill:            true,
          spanGaps:        true,    // connect across missing days
        }],
      },
      options: {
        scales: {
          x: {
            grid:  { display: false },
            ticks: { maxTicksLimit: 7, color: '#8a9690' },
          },
          y: {
            min:   0,
            max:   6,
            grid:  { color: 'rgba(30,40,34,0.06)' },
            ticks: {
              stepSize: 1,
              color:    '#8a9690',
              callback: (val) => {
                const map = { 1: 'Stressed', 2: 'Low', 3: 'Neutral', 4: 'Happy', 5: 'Motivated' };
                return map[val] || '';
              },
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const map = { 1: 'Stressed', 2: 'Low', 3: 'Neutral', 4: 'Happy', 5: 'Motivated' };
                return ` ${map[ctx.raw] || '—'}`;
              },
            },
          },
        },
      },
    });

  } catch (err) {
    console.warn('Mood trend chart error:', err);
    showChartError('moodTrendChart', 'Could not load trend data.');
  }
}


/* ══════════════════════════════════════════════════════════
   CHART 3 — WEEKLY ACTIVITY  (Bar)
   Canvas ID: weeklyBarChart
   Shows entries per day for the last 7 days.
   ══════════════════════════════════════════════════════════ */

function renderWeeklyChart(entries) {
  const canvas = document.getElementById('weeklyBarChart');
  if (!canvas) return;

  const days   = lastNDays(7);
  const labels = days.map(d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' }));

  // Build set of dates with entries
  const entryDates = new Set((entries || []).map(e => e.date));
  const values     = days.map(d => (entryDates.has(d) ? 1 : 0));

  // Color: green if wrote, light grey if missed
  const colors = values.map(v => v ? '#4a7c59' : 'rgba(30,40,34,0.07)');

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8a9690' } },
        y: {
          display: false,
          min: 0,
          max: 1.5,
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.raw === 1 ? ' Wrote today ✓' : ' No entry',
          },
        },
      },
    },
  });
}


/* ══════════════════════════════════════════════════════════
   CHART 4 — MONTHLY ACTIVITY HEATMAP  (simulated via Bar)
   Canvas ID: monthlyActivityChart
   Entry count per week for the last 12 weeks.
   ══════════════════════════════════════════════════════════ */

function renderMonthlyChart(entries) {
  const canvas = document.getElementById('monthlyActivityChart');
  if (!canvas) return;

  // Build week buckets for last 12 weeks
  const weeks  = [];
  const counts = [];

  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay());

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const entrySet = new Set((entries || []).map(e => e.date));
    const count    = weekDates.filter(d => entrySet.has(d)).length;

    weeks.push(weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
    counts.push(count);
  }

  // Color intensity by count (0–7)
  const colors = counts.map(c => {
    const alpha = c === 0 ? 0.07 : 0.2 + (c / 7) * 0.7;
    return `rgba(74,124,89,${alpha.toFixed(2)})`;
  });

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [{
        data:            counts,
        backgroundColor: colors,
        borderRadius:    5,
        borderSkipped:   false,
      }],
    },
    options: {
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8a9690', maxTicksLimit: 6 } },
        y: {
          grid:  { color: 'rgba(30,40,34,0.06)' },
          ticks: { stepSize: 1, color: '#8a9690' },
          min:   0,
          max:   7,
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw} / 7 days`,
          },
        },
      },
    },
  });
}


/* ══════════════════════════════════════════════════════════
   SUMMARY STAT CARDS
   ══════════════════════════════════════════════════════════ */

async function loadSummaryStats() {
  try {
    const res  = await fetch(`${API_BASE}/stats/summary`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Summary API ${res.status}`);
    const data = await res.json();

    const els = {
      insightTotal:      data.totalEntries      ?? 0,
      insightDiscipline: (data.disciplineScore  ?? 0) + '%',
      insightAvgWords:   (data.avgWords         ?? 0) + ' words',
      insightThisMonth:  (data.daysWrittenThisMonth ?? 0) + ' days',
    };

    Object.entries(els).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

  } catch (err) {
    console.warn('Summary stats error:', err);
  }
}


/* ══════════════════════════════════════════════════════════
   ERROR FALLBACK FOR CANVAS
   ══════════════════════════════════════════════════════════ */

function showChartError(canvasId, msg) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.style.display = 'none';
  const err = document.createElement('p');
  err.style.cssText = 'text-align:center;color:#8a9690;font-size:13px;padding:24px 0;';
  err.textContent   = msg;
  parent.appendChild(err);
}


/* ══════════════════════════════════════════════════════════
   POPULATE USER  +  SIDEBAR
   ══════════════════════════════════════════════════════════ */

function populateBasics() {
  const name = user.name || 'there';

  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = name;

  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();

  const pageTitle = document.getElementById('insightsTitle');
  if (pageTitle) pageTitle.textContent = `${name}'s Insights`;
}


/* ══════════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════════ */

function attachEventListeners() {
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

  window.openSidebar  = () => { sidebar?.classList.add('open');    overlay?.classList.add('visible');    };
  window.closeSidebar = () => { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); };

  if (overlay) overlay.addEventListener('click', window.closeSidebar);
}


/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

async function init() {
  populateBasics();
  attachEventListeners();
  applyChartDefaults();

  // Fetch all entries once — reused by multiple charts
  let entries = [];
  try {
    const res = await fetch(`${API_BASE}/entries`, { headers: authHeaders() });
    if (res.ok) entries = await res.json();
  } catch (err) {
    console.warn('Entries fetch error:', err);
  }

  // Render everything in parallel
  await Promise.all([
    loadSummaryStats(),
    renderMoodChart(),
    renderMoodTrendChart(entries),
  ]);

  // Sync (use already-loaded entries)
  renderWeeklyChart(entries);
  renderMonthlyChart(entries);

  // Remove page loader
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }
}

init();
