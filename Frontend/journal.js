/* ============================================================
   journal.js — Reflect App
   Handles: Daily reflection entry page (journal.html)
   API:
     GET    /api/entries/:date  — load existing entry for a date
     POST   /api/entries        — create new entry
     PUT    /api/entries/:id    — update existing entry
     DELETE /api/entries/:id    — delete entry
   ============================================================ */

const API_BASE = 'https://reflect-backend.onrender.com/api';

/* ── Auth guard ──────────────────────────────────────────── */
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

const user = JSON.parse(localStorage.getItem('user') || '{}');


/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */

let currentEntryId   = null;   // _id of loaded entry (null = new)
let selectedMood     = null;   // currently selected mood string
let autoSaveTimer    = null;   // debounce handle for auto-save
let isDirty          = false;  // unsaved changes flag

// Mood config — matches your backend's accepted values
const MOODS = [
  { value: 'happy',     emoji: '😊', label: 'Happy'     },
  { value: 'motivated', emoji: '🔥', label: 'Motivated' },
  { value: 'neutral',   emoji: '😐', label: 'Neutral'   },
  { value: 'low',       emoji: '😔', label: 'Low'       },
  { value: 'stressed',  emoji: '😤', label: 'Stressed'  },
];


/* ══════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════ */

function authHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/** Format a YYYY-MM-DD string to a readable label. */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Get today as YYYY-MM-DD. */
function todayString() {
  return new Date().toISOString().split('T')[0];
}

/** Parse ?date=YYYY-MM-DD from URL, fallback to today. */
function getTargetDate() {
  const params = new URLSearchParams(window.location.search);
  return params.get('date') || todayString();
}

/** Count words in a string. */
function wordCount(str) {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

/** Show a status message (auto-save indicator etc.). */
function setStatus(msg, type = 'idle') {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = msg;
  el.className   = `save-status save-status--${type}`;
}

/** Show the toast notification. */
function showToast(msg) {
  const toast     = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  if (!toast) return;
  if (toastText) toastText.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

/** Show inline error banner. */
function showError(msg) {
  const el = document.getElementById('errorMsg');
  const tx = document.getElementById('errorText');
  if (!el) return;
  if (tx) tx.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}


/* ══════════════════════════════════════════════════════════
   MOOD SELECTOR
   ══════════════════════════════════════════════════════════ */

/** Render mood buttons into #moodGrid. */
function renderMoods() {
  const grid = document.getElementById('moodGrid');
  if (!grid) return;

  grid.innerHTML = '';

  MOODS.forEach(({ value, emoji, label }) => {
    const btn = document.createElement('button');
    btn.type          = 'button';
    btn.className     = 'mood-btn';
    btn.dataset.mood  = value;
    btn.innerHTML     = `<span class="mood-emoji">${emoji}</span><span class="mood-label">${label}</span>`;

    btn.addEventListener('click', () => selectMood(value));
    grid.appendChild(btn);
  });
}

/** Activate a mood selection visually and in state. */
function selectMood(value) {
  selectedMood = value;
  isDirty      = true;

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mood === value);
  });

  scheduleAutoSave();
}

/** Pre-select a mood (e.g. when loading an existing entry). */
function preSelectMood(value) {
  selectedMood = value;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mood === value);
  });
}


/* ══════════════════════════════════════════════════════════
   LOAD ENTRY FOR DATE
   ══════════════════════════════════════════════════════════ */

async function loadEntry(date) {
  setStatus('Loading…', 'loading');

  try {
    const res = await fetch(`${API_BASE}/entries/${date}`, { headers: authHeaders() });

    if (res.status === 404) {
      // No entry yet — blank slate
      currentEntryId = null;
      setStatus('New entry', 'idle');
      return;
    }

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const entry = await res.json();

    // Populate fields
    currentEntryId = entry._id;

    const contentEl = document.getElementById('entryContent');
    if (contentEl) {
      contentEl.value = entry.content || '';
      updateWordCount(entry.content || '');
    }

    if (entry.mood) preSelectMood(entry.mood);

    // Improvements / notes field (optional)
    const improvEl = document.getElementById('entryImprovements');
    if (improvEl && entry.improvements) improvEl.value = entry.improvements;

    setStatus('Loaded', 'saved');
    isDirty = false;

  } catch (err) {
    console.error('Load entry error:', err);
    setStatus('Could not load entry', 'error');
  }
}


/* ══════════════════════════════════════════════════════════
   SAVE ENTRY  (create or update)
   ══════════════════════════════════════════════════════════ */

async function saveEntry(silent = false) {
  const contentEl = document.getElementById('entryContent');
  const content   = contentEl ? contentEl.value.trim() : '';

  if (!content && !selectedMood) {
    if (!silent) showError('Please write something or choose a mood before saving.');
    return false;
  }

  const targetDate   = getTargetDate();
  const improvEl     = document.getElementById('entryImprovements');
  const improvements = improvEl ? improvEl.value.trim() : '';

  const payload = {
    content,
    mood: selectedMood,
    date: targetDate,
    ...(improvements && { improvements }),
  };

  setStatus('Saving…', 'saving');

  try {
    let res;

    if (currentEntryId) {
      // Update existing entry
      res = await fetch(`${API_BASE}/entries/${currentEntryId}`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
    } else {
      // Create new entry
      res = await fetch(`${API_BASE}/entries`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify(payload),
      });
    }

    const data = await res.json();

    if (!res.ok) {
      setStatus('Save failed', 'error');
      if (!silent) showError(data.message || 'Failed to save. Please try again.');
      return false;
    }

    // Store new _id if just created
    if (!currentEntryId && data._id) currentEntryId = data._id;

    isDirty = false;
    setStatus('Saved ✓', 'saved');
    if (!silent) showToast('Reflection saved! 🌿');
    return true;

  } catch (err) {
    console.error('Save entry error:', err);
    setStatus('Save failed', 'error');
    if (!silent) showError('Could not connect to server.');
    return false;
  }
}


/* ══════════════════════════════════════════════════════════
   DELETE ENTRY
   ══════════════════════════════════════════════════════════ */

async function deleteEntry() {
  if (!currentEntryId) return;

  const confirmed = window.confirm('Delete this reflection? This cannot be undone.');
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/entries/${currentEntryId}`, {
      method:  'DELETE',
      headers: authHeaders(),
    });

    if (!res.ok) {
      showError('Could not delete entry. Please try again.');
      return;
    }

    // Reset state
    currentEntryId = null;
    selectedMood   = null;
    isDirty        = false;

    const contentEl = document.getElementById('entryContent');
    if (contentEl) contentEl.value = '';

    const improvEl = document.getElementById('entryImprovements');
    if (improvEl) improvEl.value = '';

    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));

    setStatus('Entry deleted', 'idle');
    showToast('Entry deleted.');

  } catch (err) {
    console.error('Delete error:', err);
    showError('Could not connect to server.');
  }
}


/* ══════════════════════════════════════════════════════════
   AUTO-SAVE  (debounced, 3 s after last keystroke)
   ══════════════════════════════════════════════════════════ */

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  setStatus('Unsaved changes…', 'dirty');
  autoSaveTimer = setTimeout(() => saveEntry(true), 3000);
}


/* ══════════════════════════════════════════════════════════
   WORD COUNT
   ══════════════════════════════════════════════════════════ */

function updateWordCount(text) {
  const el = document.getElementById('wordCount');
  if (!el) return;
  const count = wordCount(text);
  el.textContent = `${count} word${count !== 1 ? 's' : ''}`;
}


/* ══════════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════════ */

function attachEventListeners() {
  // ── Content textarea ──
  const contentEl = document.getElementById('entryContent');
  if (contentEl) {
    contentEl.addEventListener('input', () => {
      isDirty = true;
      updateWordCount(contentEl.value);
      scheduleAutoSave();
    });
  }

  // ── Improvements textarea ──
  const improvEl = document.getElementById('entryImprovements');
  if (improvEl) {
    improvEl.addEventListener('input', () => {
      isDirty = true;
      scheduleAutoSave();
    });
  }

  // ── Save button ──
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveEntry(false));
  }

  // ── Delete button ──
  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteEntry);
  }

  // ── Back / nav buttons — warn if unsaved ──
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}


/* ══════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════ */

async function init() {
  const targetDate = getTargetDate();

  // Set date heading
  const dateHeading = document.getElementById('entryDateHeading');
  if (dateHeading) dateHeading.textContent = formatDate(targetDate);

  // Set user name in sidebar if present
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = user.name || '';

  const userAvatar = document.getElementById('userAvatar');
  if (userAvatar) userAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

  // Render mood grid
  renderMoods();

  // Attach all listeners
  attachEventListeners();

  // Load existing entry (if any) for this date
  await loadEntry(targetDate);

  // Remove page loader if present
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  }

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    });
  }

  // Mobile sidebar
  const menuBtn  = document.getElementById('mobileMenuBtn');
  const overlay  = document.getElementById('sidebarOverlay');
  const sidebar  = document.getElementById('sidebar');

  if (menuBtn)  menuBtn.addEventListener('click',  () => { sidebar?.classList.add('open');    overlay?.classList.add('visible');    });
  if (overlay)  overlay.addEventListener('click',  () => { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); });
}

init();
