/* ─────────────────────────────────────────────────────────
   streak.js  —  Reflect App
   Connects to backend API and populates streak.html
───────────────────────────────────────────────────────── */

const BASE_URL = "https://reflect-m5zh.onrender.com/api";

// ── AUTH CHECK ───────────────────────────────────────────
const token    = localStorage.getItem("token");
const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
const userName = storedUser.name || "";

if (!token) {
  window.location.href = "index.html";
}

// Set avatar initial
const userAvatar = document.getElementById("userAvatar");
if (userAvatar && userName) {
  userAvatar.textContent = userName[0].toUpperCase();
}

// ── HELPER: format date nicely ───────────────────────────
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en", { month: "long", day: "numeric" });
};

// ── STREAK MESSAGES ──────────────────────────────────────
const getStreakMessage = (streak) => {
  if (streak === 0)  return ["No active streak yet.", "Write today to start your streak!"];
  if (streak === 1)  return ["First step taken.", "Every journey starts with a single day."];
  if (streak < 3)    return ["Two days in.", "Keep going, you're building something real."];
  if (streak < 7)    return ["Three days in.", "Small habits are quietly compounding."];
  if (streak < 14)   return ["One week strong.", "You've written every day this week. Beautiful."];
  if (streak < 21)   return ["Two weeks of showing up.", "This is becoming a real practice now."];
  if (streak < 30)   return ["21-day milestone!", "Science says habits form around now — you're proof."];
  if (streak < 50)   return ["A full month!", "Thirty days of turning inward. That's extraordinary."];
  if (streak < 100)  return ["50 days of reflection.", "Half a century of showing up for yourself."];
  return ["100 days. 🌿", "You've built something truly rare here."];
};

// ── LOAD STREAK DATA ─────────────────────────────────────
const loadStreakData = async () => {
  try {
    const res  = await fetch(`${BASE_URL}/stats/streak`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    const current = data.currentStreak;
    const longest = data.longestStreak;

    // Flame hero + nav pill
    document.getElementById("streakCount").textContent = current;
    document.getElementById("heroStreak").textContent  = current;
    document.getElementById("statBest").textContent    = longest;

    // Streak message
    const [title] = getStreakMessage(current);
    document.getElementById("streakMsg").textContent = title;

    // "Since" date
    const today     = new Date();
    const sinceDate = new Date(today);
    sinceDate.setDate(today.getDate() - current + 1);
    const sinceStr  = current > 0
      ? formatDate(sinceDate.toISOString().slice(0, 10))
      : "—";

    document.getElementById("streakSub").innerHTML = current > 0
      ? `You've written every day since <strong>${sinceStr}</strong>`
      : "Start your streak by writing today's reflection.";

    // Next milestone progress bar
    updateMilestoneProgress(current);

    return { current, longest };

  } catch (err) {
    console.error("Error loading streak:", err);
    return { current: 0, longest: 0 };
  }
};

// ── LOAD SUMMARY STATS ───────────────────────────────────
const loadSummary = async () => {
  try {
    const res  = await fetch(`${BASE_URL}/stats/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    document.getElementById("statTotal").textContent = data.totalEntries;
    document.getElementById("statRate").textContent  = data.disciplineScore + "%";

  } catch (err) {
    console.error("Error loading summary:", err);
  }
};

// ── NEXT MILESTONE PROGRESS BAR ──────────────────────────
const updateMilestoneProgress = (current) => {
  const targets  = [3, 7, 14, 21, 30, 50, 100];
  const emojis   = { 3:"🌱", 7:"🌿", 14:"🌿", 21:"🌾", 30:"🍃", 50:"🌳", 100:"✨" };
  const next     = targets.find(t => t > current) || 100;
  const prev     = targets.filter(t => t <= current).pop() || 0;
  const pct      = prev === next ? 100
                 : Math.round((current - prev) / (next - prev) * 100);
  const daysLeft = next - current;

  document.getElementById("nextMsName").textContent   = `${next}-day streak ${emojis[next] || "🔥"}`;
  document.getElementById("nextMsPct").textContent    = pct + "%";
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("nmFooter").textContent     =
    daysLeft === 0
      ? "You reached this milestone! 🎉"
      : `${daysLeft} more day${daysLeft !== 1 ? "s" : ""} to go — you've got this.`;
};

// ── LOAD ALL ENTRIES → CALENDAR + HISTORY + MILESTONES ──
const loadEntriesAndCalendar = async () => {
  try {
    const res     = await fetch(`${BASE_URL}/entries`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const entries = await res.json();

    if (!res.ok) throw new Error(entries.message);

    const entryDates = new Set(entries.map(e => e.date));

    renderCalendar(entryDates);
    buildStreakHistory(entries);
    buildMilestones(entries.length);
    checkTodayCTA(entryDates);

    return entryDates;

  } catch (err) {
    console.error("Error loading entries:", err);
    return new Set();
  }
};

// ── CALENDAR ─────────────────────────────────────────────
let calYear   = new Date().getFullYear();
let calMonth  = new Date().getMonth();
let _entryDates = new Set(); // cached for prev/next navigation

const renderCalendar = (entryDates) => {
  if (entryDates) _entryDates = entryDates;

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  document.getElementById("calTitle").textContent =
    `${monthNames[calMonth]} ${calYear}`;

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr    = new Date().toISOString().slice(0, 10);

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday  = dateStr === todayStr;
    const isFuture = new Date(dateStr) > new Date();
    const hasEntry = _entryDates.has(dateStr);

    let cls = "cal-day";
    if (isToday)        cls += " today";
    else if (isFuture)  cls += " future";
    else if (hasEntry)  cls += " has-entry";

    html += `<div class="${cls}" title="${dateStr}">${d}</div>`;
  }

  document.getElementById("calDays").innerHTML = html;
};

// Exposed for HTML onclick buttons (prevMonth / nextMonth already in your HTML)
window.prevMonth = () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
};

window.nextMonth = () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
};

// ── STREAK HISTORY ───────────────────────────────────────
const buildStreakHistory = (entries) => {
  const historyEl = document.getElementById("historyList");
  historyEl.innerHTML = "";

  if (!entries.length) {
    historyEl.innerHTML = `<p style="color:var(--ink-soft);font-style:italic;padding:12px">No streaks yet — start writing!</p>`;
    return;
  }

  const dates = entries.map(e => e.date).sort();
  const streaks = [];
  let streakStart = dates[0];
  let streakLen   = 1;

  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
    if (diff === 1) {
      streakLen++;
    } else {
      streaks.push({ days: streakLen, start: streakStart, end: dates[i-1] });
      streakStart = dates[i];
      streakLen   = 1;
    }
  }
  streaks.push({ days: streakLen, start: streakStart, end: dates[dates.length-1] });
  streaks.sort((a, b) => b.days - a.days);

  const todayStr     = new Date().toISOString().slice(0, 10);
  const flameIcons   = ["🏆","🔥","🌿","🌱","🌱"];
  const badgeLabels  = { best:"Personal Best", recent:"Current", past:"Past" };
  const badgeClasses = { best:"badge-best", recent:"badge-recent", past:"badge-past" };

  streaks.slice(0, 5).forEach((s, i) => {
    const isBest   = i === 0;
    const isRecent = s.end === todayStr ||
                     s.end === new Date(Date.now() - 86400000).toISOString().slice(0,10);
    const badge    = isBest ? "best" : isRecent ? "recent" : "past";

    historyEl.innerHTML += `
      <div class="history-item ${isBest ? "best" : ""}">
        <span class="hi-rank">${i+1}</span>
        <span class="hi-flame">${flameIcons[i] || "🌱"}</span>
        <div class="hi-info">
          <div class="hi-days">${s.days} day${s.days > 1 ? "s" : ""}</div>
          <div class="hi-dates">${formatDate(s.start)} – ${s.end === todayStr ? "Today" : formatDate(s.end)}</div>
        </div>
        <span class="hi-badge ${badgeClasses[badge]}">${badgeLabels[badge]}</span>
      </div>`;
  });
};

// ── MILESTONES ───────────────────────────────────────────
const buildMilestones = (totalEntries) => {
  const bestStreak = parseInt(document.getElementById("statBest").textContent) || 0;

  const milestones = [
    { emoji:"🌱", name:"First Spark",     req:"3-day streak",    earned: bestStreak >= 3 },
    { emoji:"🌿", name:"One Week",         req:"7-day streak",    earned: bestStreak >= 7 },
    { emoji:"🌾", name:"Three Weeks",      req:"21-day streak",   earned: bestStreak >= 21 },
    { emoji:"🍃", name:"A Full Month",     req:"30-day streak",   earned: bestStreak >= 30 },
    { emoji:"🌳", name:"50 Days Deep",     req:"50-day streak",   earned: bestStreak >= 50 },
    { emoji:"✨", name:"Century",          req:"100-day streak",  earned: bestStreak >= 100 },
    { emoji:"📓", name:"Faithful Writer",  req:"25 total entries",earned: totalEntries >= 25 },
    { emoji:"💯", name:"Completionist",    req:"50 total entries",earned: totalEntries >= 50 },
  ];

  const msGrid = document.getElementById("milestonesGrid");
  msGrid.innerHTML = "";

  milestones.forEach(m => {
    msGrid.innerHTML += `
      <div class="milestone-card ${m.earned ? "earned" : ""}">
        <div class="ms-checkmark">✓</div>
        <span class="ms-badge">${m.emoji}</span>
        <div class="ms-name">${m.name}</div>
        <div class="ms-req">${m.earned ? "Unlocked ✓" : m.req}</div>
      </div>`;
  });
};

// ── QUOTES ───────────────────────────────────────────────
const loadQuote = () => {
  const quotes = [
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
    { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
    { text: "Motivation gets you going. Discipline keeps you growing.", author: "John C. Maxwell" },
    { text: "You don't rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  ];
  const q = quotes[new Date().getDay() % quotes.length];
  document.getElementById("quoteText").textContent   = q.text;
  document.getElementById("quoteAuthor").textContent = "— " + q.author;
};

// ── CTA CARD ─────────────────────────────────────────────
const checkTodayCTA = (entryDates) => {
  const todayStr   = new Date().toISOString().slice(0, 10);
  const wroteToday = entryDates.has(todayStr);
  const journeyBtn = document.querySelector(".btn-journal");

  if (wroteToday) {
    document.getElementById("ctaTitle").textContent = "You wrote today — well done! 🌿";
    document.getElementById("ctaSub").textContent =
      "Your streak is safe. Come back tomorrow to keep the momentum going.";
    if (journeyBtn) journeyBtn.textContent = "✏️ Edit today's entry";
  }
};

// ── LOGOUT (attach to avatar or any logout button) ───────
window.logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
};

// ── INIT ─────────────────────────────────────────────────
const init = async () => {
  loadQuote();
  await loadStreakData();
  await loadSummary();
  await loadEntriesAndCalendar();
};

init();