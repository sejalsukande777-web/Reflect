/* ============================================================
   auth.js — Reflect App
   Handles: Login (index.html) + Register (register.html)
   API: POST /api/auth/login  |  POST /api/auth/register
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';

/* ── Redirect if already logged in ──────────────────────── */
if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}


/* ══════════════════════════════════════════════════════════
   SHARED HELPERS
   ══════════════════════════════════════════════════════════ */

/**
 * Show the error banner with a custom message.
 * Adds .error class to all <input> elements in the form.
 */
function showError(msg) {
  const errorMsg  = document.getElementById('errorMsg');
  const errorText = document.getElementById('errorText');
  if (!errorMsg || !errorText) return;

  errorText.textContent = msg;
  errorMsg.classList.add('visible');

  // Highlight all inputs as errored
  document.querySelectorAll('.field input').forEach(i => i.classList.add('error'));
}

/**
 * Clear the error banner and remove error state from inputs.
 */
function clearError() {
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) errorMsg.classList.remove('visible');
  document.querySelectorAll('.field input').forEach(i => i.classList.remove('error'));
}

/**
 * Toggle the submit button loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} on
 */
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

/**
 * Show the success toast notification.
 */
function showToast() {
  const toast = document.getElementById('toast');
  if (toast) toast.classList.add('visible');
}

/**
 * Basic email format check.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

/* ── Clear errors on any input change ───────────────────── */
document.addEventListener('input', (e) => {
  if (e.target.matches('.field input')) clearError();
});


/* ══════════════════════════════════════════════════════════
   PASSWORD TOGGLE  (shared — works on both pages)
   ══════════════════════════════════════════════════════════ */

const EYE_OPEN = `
  <path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z"
        stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.4"/>`;

const EYE_CLOSED = `
  <path d="M2 2L16 16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M7.5 3.5C8 3.18 8.5 3 9 3C14 3 17 9 17 9C16.4 10.1 15.6 11.2 14.7 12.1"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5.3 5.3C3.5 6.5 2 9 2 9C2 9 5 15 9 15C10.4 15 11.7 14.4 12.8 13.5"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`;

/**
 * Attach show/hide toggle to a password field pair.
 * @param {string} toggleId  — button id
 * @param {string} inputId   — password input id
 * @param {string} iconId    — svg icon id
 */
function attachPasswordToggle(toggleId, inputId, iconId) {
  const toggle = document.getElementById(toggleId);
  const input  = document.getElementById(inputId);
  const icon   = document.getElementById(iconId);
  if (!toggle || !input || !icon) return;

  toggle.addEventListener('click', () => {
    const hidden = input.type === 'password';
    input.type   = hidden ? 'text' : 'password';
    icon.innerHTML = hidden ? EYE_CLOSED : EYE_OPEN;
  });
}

// Login page: single password field
attachPasswordToggle('pwToggle', 'password', 'eyeIcon');

// Register page: may have two password fields (password + confirm)
attachPasswordToggle('pwToggle',        'password',        'eyeIcon');
attachPasswordToggle('pwToggleConfirm', 'confirmPassword', 'eyeIconConfirm');


/* ══════════════════════════════════════════════════════════
   LOGIN  (index.html)
   ══════════════════════════════════════════════════════════ */

const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    // ── Client-side validation ──
    if (!email)              { showError('Please enter your email address.');        return; }
    if (!isValidEmail(email)){ showError('Please enter a valid email address.');     return; }
    if (!password)           { showError('Please enter your password.');             return; }

    setLoading(loginBtn, true);

    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || 'Wrong email or password. Please try again.');
        setLoading(loginBtn, false);
        return;
      }

      // ── Persist session ──
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));

      // ── Success: show toast → redirect ──
      showToast();
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);

    } catch (err) {
      console.error('Login error:', err);
      showError('Could not connect to server. Please check your connection.');
      setLoading(loginBtn, false);
    }
  });
}


/* ══════════════════════════════════════════════════════════
   REGISTER  (register.html)
   ══════════════════════════════════════════════════════════ */

const registerForm = document.getElementById('registerForm');

if (registerForm) {

  /* ── Live password strength indicator ─────────────────── */
  const passwordInput    = document.getElementById('password');
  const strengthBar      = document.getElementById('strengthBar');
  const strengthText     = document.getElementById('strengthText');

  if (passwordInput && strengthBar) {
    passwordInput.addEventListener('input', () => {
      const val      = passwordInput.value;
      const strength = getPasswordStrength(val);
      updateStrengthUI(strength);
    });
  }

  /**
   * Score a password 0–4.
   * @param {string} pw
   * @returns {{ score: number, label: string, color: string }}
   */
  function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 8)              score++;
    if (/[A-Z]/.test(pw))            score++;
    if (/[0-9]/.test(pw))            score++;
    if (/[^A-Za-z0-9]/.test(pw))     score++;

    const levels = [
      { label: '',         color: 'transparent' },
      { label: 'Weak',     color: '#c4686a' },
      { label: 'Fair',     color: '#c97c2c' },
      { label: 'Good',     color: '#a8c5b0' },
      { label: 'Strong',   color: '#4a7c59' },
    ];
    return { score, ...levels[score] };
  }

  function updateStrengthUI({ score, label, color }) {
    if (!strengthBar) return;
    const pct = (score / 4) * 100;
    strengthBar.style.width      = `${pct}%`;
    strengthBar.style.background = color;
    if (strengthText) strengthText.textContent = label;
  }

  /* ── Register form submit ──────────────────────────────── */
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const name            = (document.getElementById('name')?.value            || '').trim();
    const email           = (document.getElementById('email')?.value           || '').trim();
    const password        = (document.getElementById('password')?.value        || '');
    const confirmPassword = (document.getElementById('confirmPassword')?.value || '');
    const registerBtn     = document.getElementById('registerBtn');

    // ── Client-side validation ──
    if (!name)                        { showError('Please enter your name.');                  return; }
    if (name.length < 2)              { showError('Name must be at least 2 characters.');      return; }
    if (!email)                       { showError('Please enter your email address.');         return; }
    if (!isValidEmail(email))         { showError('Please enter a valid email address.');      return; }
    if (!password)                    { showError('Please enter a password.');                 return; }
    if (password.length < 6)          { showError('Password must be at least 6 characters.'); return; }
    if (confirmPassword && password !== confirmPassword) {
      showError('Passwords do not match. Please try again.');
      return;
    }

    setLoading(registerBtn, true);

    try {
      const res  = await fetch(`${API_BASE}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.message || 'Registration failed. Please try again.');
        setLoading(registerBtn, false);
        return;
      }

      // ── Persist session ──
      localStorage.setItem('token', data.token);
      localStorage.setItem('user',  JSON.stringify(data.user));

      // ── Success: show toast → redirect ──
      showToast();
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1400);

    } catch (err) {
      console.error('Register error:', err);
      showError('Could not connect to server. Please check your connection.');
      setLoading(registerBtn, false);
    }
  });
}
