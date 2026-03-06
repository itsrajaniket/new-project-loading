/**
 * Habit Tracker Pro — script.js
 * Architecture: Single IIFE — no globals pollute window except nothing.
 * Event binding: All via addEventListener after DOMContentLoaded.
 * XSS safety: sanitize() helper used on all user-generated text before innerHTML.
 *             Non-user content rendered with innerHTML; user content via textContent.
 * Performance: toggleHabit() surgically updates only the clicked checkbox cell.
 * Audio: Single shared AudioContext, created once, resumed on each play.
 */
(function () {
  "use strict";

  // ─────────────────────────────────────────
  // XSS SANITIZER
  // Escapes user-generated strings before injecting into innerHTML.
  // ─────────────────────────────────────────
  function sanitize(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ─────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────
  const TEST_USERS = { user1: "1234", user2: "1234", user3: "1234" };
  let currentUser = null;

  function checkAuthStatus() {
    const u = sessionStorage.getItem("currentUser");
    if (u) {
      currentUser = u;
      showAppUI();
      init(); // init() calls loadData() itself — no double-load
    } else showLoginUI();
  }
  function showLoginUI() {
    document.getElementById("loginContainer").hidden = false;
    document.getElementById("appContainer").hidden = true;
  }
  function showAppUI() {
    document.getElementById("loginContainer").hidden = true;
    document.getElementById("appContainer").hidden = false;
    updateUserGreeting();
  }
  function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById("username").value.trim();
    const p = document.getElementById("password").value;
    const err = document.getElementById("loginError");
    if (TEST_USERS[u] && TEST_USERS[u] === p) {
      sessionStorage.setItem("currentUser", u);
      currentUser = u;
      err.hidden = true;
      document.getElementById("loginForm").reset();
      showAppUI();
      init(); // init() calls loadData() — no double-load
    } else {
      err.textContent = "❌ Invalid username or password. Try user1/1234";
      err.hidden = false;
    }
  }
  function updateUserGreeting() {
    const el = document.getElementById("navGreeting");
    if (!el) return;
    el.textContent = "";
    if (currentUser) {
      el.appendChild(document.createTextNode("Welcome, "));
      const strong = document.createElement("strong");
      strong.textContent =
        currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
      el.appendChild(strong);
      el.appendChild(document.createTextNode(" 👋"));
    }
  }
  function handleLogout() {
    if (!confirm("Are you sure you want to logout?")) return;
    sessionStorage.removeItem("currentUser");
    currentUser = null;
    // Reset charts so they reinitialise on next login
    if (progressChart) {
      try {
        progressChart.destroy();
      } catch (_) {}
      progressChart = null;
    }
    if (mentalChart) {
      try {
        mentalChart.destroy();
      } catch (_) {}
      mentalChart = null;
    }
    showLoginUI();
    document.getElementById("loginForm").reset();
    document.getElementById("loginError").hidden = true;
  }

  // ─────────────────────────────────────────
  // DATA DEFAULTS
  // ─────────────────────────────────────────
  const DEFAULT_HABITS = [
    {
      id: 1,
      name: "Wake up at 05:00",
      emoji: "⏰",
      category: "mindset",
      board: "all",
    },
    { id: 2, name: "Gym", emoji: "💪", category: "health", board: "health" },
    {
      id: 3,
      name: "Reading/Learning",
      emoji: "📚",
      category: "learning",
      board: "personal",
    },
    {
      id: 4,
      name: "Day Planning",
      emoji: "📝",
      category: "mindset",
      board: "work",
    },
    {
      id: 5,
      name: "Budget Tracking",
      emoji: "💰",
      category: "finance",
      board: "personal",
    },
    {
      id: 6,
      name: "Project Work",
      emoji: "🎯",
      category: "learning",
      board: "work",
    },
    {
      id: 7,
      name: "No Alcohol",
      emoji: "🚫",
      category: "health",
      board: "health",
    },
    {
      id: 8,
      name: "Social Media Detox",
      emoji: "🌿",
      category: "mindset",
      board: "personal",
    },
    {
      id: 9,
      name: "Goal Journaling",
      emoji: "📓",
      category: "mindset",
      board: "personal",
    },
    {
      id: 10,
      name: "Cold Shower",
      emoji: "🚿",
      category: "health",
      board: "health",
    },
  ];

  function makeEmptyState() {
    return {
      habits: JSON.parse(JSON.stringify(DEFAULT_HABITS)),
      completions: {},
      mentalState: { mood: {}, motivation: {} },
      dayNotes: {},
      streakFreezes: 0,
      freezeUsedDates: [],
      perfectDaysCount: 0,
      _lastPerfectDayRecorded: null,
      bestMonthScores: {}, // keyed by "YYYY-MM" — replaces single bestMonthScore
      bestMonthScore: 0, // kept for backwards-compat reads, no longer written
      habitCreatedDates: {}, // habitId -> "YYYY-MM-DD" — tracks when habit was added
      activeBoard: "all",
      currentMonth: new Date().getMonth(),
      currentYear: new Date().getFullYear(),
      calendarView: "month",
      theme: "dark",
      currentWeekStart: null,
      activeCategory: "all",
    };
  }

  let state = makeEmptyState(); // module-level, not window-level

  const CATEGORY_COLORS = {
    health: { bg: "#e3f2fd", accent: "#1976d2", label: "🔵 Health" },
    finance: { bg: "#fffde7", accent: "#f9a825", label: "🟡 Finance" },
    learning: { bg: "#e8f5e9", accent: "#388e3c", label: "🟢 Learning" },
    mindset: { bg: "#f3e5f5", accent: "#7b1fa2", label: "🟣 Mindset" },
    other: { bg: "#f5f5f5", accent: "#757575", label: "⚪ Other" },
  };

  const EMOJIS = [
    "⏰",
    "💪",
    "📚",
    "📝",
    "💰",
    "🎯",
    "🚫",
    "🌿",
    "📓",
    "🚿",
    "🏃",
    "🧘",
    "💧",
    "🥗",
    "😴",
    "🎨",
    "🎵",
    "🧠",
    "💻",
    "📱",
    "🚶",
    "🚴",
    "🏊",
    "⚽",
    "🎮",
    "📖",
    "✍️",
    "🗣️",
  ];

  const MOOD_EMOJIS = [
    "😞",
    "😕",
    "😐",
    "🙂",
    "😊",
    "😄",
    "🤩",
    "💪",
    "🔥",
    "⚡",
  ];

  const BADGES = [
    { id: "first_day", name: "First Step", icon: "👣", desc: "Complete 1 day" },
    {
      id: "week_warrior",
      name: "Week Warrior",
      icon: "⚔️",
      desc: "7 day streak",
    },
    {
      id: "month_master",
      name: "Month Master",
      icon: "👑",
      desc: "30 day streak",
    },
    {
      id: "perfect_week",
      name: "Perfect Week",
      icon: "✨",
      desc: "100% for 7 days",
    },
    { id: "century", name: "Centurion", icon: "💯", desc: "100 completions" },
    { id: "dedication", name: "Dedicated", icon: "🔥", desc: "50 day streak" },
    {
      id: "freeze_pro",
      name: "Ice Cold",
      icon: "🧊",
      desc: "Use a streak freeze",
    },
  ];

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // UI state (never persisted)
  let selectedEmoji = "⏰";
  let selectedCategory = "health";
  let selectedHabitBoard = "all";
  let currentNotesDate = null;
  let progressChart = null;
  let mentalChart = null;

  // ─────────────────────────────────────────
  // SINGLE SHARED AUDIO CONTEXT
  // Created once; resumed before each play (browser autoplay policy).
  // ─────────────────────────────────────────
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) _audioCtx = new AC();
    }
    return _audioCtx;
  }

  // ─────────────────────────────────────────
  // STORAGE
  // ─────────────────────────────────────────
  function saveData() {
    try {
      localStorage.setItem(
        `user_${currentUser}_habitTrackerData`,
        JSON.stringify(state),
      );
    } catch (e) {
      // Storage quota exceeded or other error — notify user
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        showToast("⚠️ Storage full — data not saved. Please clear old data.");
      }
    }
  }
  function loadData() {
    try {
      const raw = localStorage.getItem(`user_${currentUser}_habitTrackerData`);
      if (!raw) {
        generateSampleData();
        return;
      }
      const saved = JSON.parse(raw);
      // Deep merge: start with a fresh default state, then overlay saved scalar
      // values, but explicitly merge nested objects so new sub-keys aren't lost.
      const base = makeEmptyState();
      state = Object.assign(base, saved);
      // Deep-merge nested objects that can grow over time
      state.mentalState = Object.assign(
        { mood: {}, motivation: {} },
        saved.mentalState || {},
      );
      state.mentalState.mood = Object.assign(
        {},
        (saved.mentalState || {}).mood || {},
      );
      state.mentalState.motivation = Object.assign(
        {},
        (saved.mentalState || {}).motivation || {},
      );
      state.completions = Object.assign({}, saved.completions || {});
      state.dayNotes = Object.assign({}, saved.dayNotes || {});
      // Back-fill missing fields
      if (!state.dayNotes) state.dayNotes = {};
      if (!state.freezeUsedDates) state.freezeUsedDates = [];
      if (!state.activeCategory) state.activeCategory = "all";
      if (state.perfectDaysCount == null) state.perfectDaysCount = 0;
      if (!state._lastPerfectDayRecorded) state._lastPerfectDayRecorded = null;
      // Migrate single bestMonthScore -> bestMonthScores map
      if (!state.bestMonthScores) {
        state.bestMonthScores = {};
        if (state.bestMonthScore > 0) {
          const mk = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, "0")}`;
          state.bestMonthScores[mk] = state.bestMonthScore;
        }
      }
      if (!state.habitCreatedDates) state.habitCreatedDates = {};
      if (!state.activeBoard) state.activeBoard = "all";
      if (!state.calendarView) state.calendarView = "month";
      if (!state.theme) state.theme = "dark";
      state.habits.forEach((h) => {
        if (!h.category) h.category = "other";
        if (!h.board) h.board = "all";
      });
    } catch (_) {
      state = makeEmptyState();
      generateSampleData();
    }
  }
  function generateSampleData() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    state.habits.forEach((h) => {
      state.completions[h.id] = {};
      for (let d = 1; d <= dim; d++) {
        const ds = fmt(state.currentYear, state.currentMonth + 1, d);
        if (Math.random() > 0.3) state.completions[h.id][ds] = true;
      }
    });
    for (let d = 1; d <= dim; d++) {
      const ds = fmt(state.currentYear, state.currentMonth + 1, d);
      state.mentalState.mood[ds] = Math.floor(Math.random() * 5) + 5;
      state.mentalState.motivation[ds] = Math.floor(Math.random() * 5) + 4;
    }
    saveData();
  }

  // ─────────────────────────────────────────
  // DATE HELPERS
  // ─────────────────────────────────────────
  function fmt(y, m, d) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function todayStr() {
    const t = new Date();
    return fmt(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  function yesterdayStr() {
    const t = new Date();
    t.setDate(t.getDate() - 1);
    return fmt(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  function daysInMonth(y, m) {
    // m = 0-based
    return new Date(y, m + 1, 0).getDate();
  }
  function weekStart(date) {
    const d = new Date(date);
    // Use local date to avoid UTC offset issues (Fix #13)
    d.setDate(d.getDate() - d.getDay());
    return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()); // return YYYY-MM-DD string
  }

  // ─────────────────────────────────────────
  // THEME
  // ─────────────────────────────────────────
  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    localStorage.setItem("habitTheme", state.theme);
    saveData();
    applyTheme();
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("habitTheme", state.theme);
    const icon = document.querySelector(".theme-icon");
    if (icon) icon.textContent = state.theme === "light" ? "🌙" : "☀️";
  }

  // ─────────────────────────────────────────
  // CATEGORY HELPERS
  // ─────────────────────────────────────────
  function getCatColor(cat) {
    return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
  }

  // Returns the count of habits that were active (created on or before) a given dateStr.
  // Falls back to state.habits.length if no creation dates are tracked (legacy data).
  function getActiveHabitCountOnDate(ds) {
    const allTracked = Object.keys(state.habitCreatedDates).length > 0;
    if (!allTracked) return state.habits.length; // legacy fallback
    return (
      state.habits.filter((h) => {
        const created = state.habitCreatedDates[h.id];
        return !created || created <= ds;
      }).length || state.habits.length
    );
  }

  function getHabitsActiveOnDate(ds) {
    const allTracked = Object.keys(state.habitCreatedDates).length > 0;
    if (!allTracked) return state.habits;
    return state.habits.filter((h) => {
      const created = state.habitCreatedDates[h.id];
      return !created || created <= ds;
    });
  }

  function getVisibleHabits() {
    let h =
      state.activeBoard === "all"
        ? state.habits
        : state.habits.filter(
            (x) => x.board === state.activeBoard || x.board === "all",
          );
    if (state.activeCategory !== "all")
      h = h.filter((x) => x.category === state.activeCategory);
    return h;
  }

  // ─────────────────────────────────────────
  // STREAK CALCULATIONS
  // ─────────────────────────────────────────
  function calcStreak(habitId) {
    let streak = 0,
      cur = new Date();
    const todayDs = todayStr();
    const todayDone =
      !!state.completions[habitId]?.[todayDs] ||
      !!state.freezeUsedDates?.includes(todayDs);
    // If today isn't done yet, don't penalise — start counting from yesterday
    if (!todayDone) cur.setDate(cur.getDate() - 1);
    while (streak < 3650) {
      // cap at 10 years to prevent runaway loop
      const ds = fmt(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
      if (
        state.completions[habitId]?.[ds] ||
        state.freezeUsedDates?.includes(ds)
      ) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return streak;
  }
  function calcBestStreak(habitId) {
    // Merge completion dates with freeze dates so freezes don't break best streak
    const completionDates = Object.keys(
      state.completions[habitId] || {},
    ).filter((d) => state.completions[habitId][d]);
    const freezeDates = state.freezeUsedDates || [];
    const allDates = Array.from(
      new Set([...completionDates, ...freezeDates]),
    ).sort();
    let max = 0,
      cur = 0,
      prev = null;
    allDates.forEach((ds) => {
      const d = new Date(ds + "T00:00:00");
      if (prev) {
        const diff = Math.round((d - prev) / 86400000);
        cur = diff === 1 ? cur + 1 : 1;
      } else cur = 1;
      max = Math.max(max, cur);
      prev = d;
    });
    return max;
  }
  function getTotalCompletions() {
    let t = 0;
    state.habits.forEach((h) =>
      Object.values(state.completions[h.id] || {}).forEach((v) => {
        if (v) t++;
      }),
    );
    return t;
  }
  function getEarnedBadges() {
    const earned = [],
      tc = getTotalCompletions();
    state.habits.forEach((h) => {
      const s = calcBestStreak(h.id);
      if (tc >= 1 && !earned.includes("first_day")) earned.push("first_day");
      if (s >= 7 && !earned.includes("week_warrior"))
        earned.push("week_warrior");
      if (s >= 30 && !earned.includes("month_master"))
        earned.push("month_master");
      if (s >= 50 && !earned.includes("dedication")) earned.push("dedication");
      if (tc >= 100 && !earned.includes("century")) earned.push("century");
    });
    const today = new Date();
    let pw = state.habits.length > 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
      if (!state.habits.every((h) => state.completions[h.id]?.[ds])) {
        pw = false;
        break;
      }
    }
    if (pw) earned.push("perfect_week");
    if ((state.freezeUsedDates || []).length > 0) earned.push("freeze_pro");
    return earned;
  }

  // ─────────────────────────────────────────
  // STREAK FREEZES
  // ─────────────────────────────────────────
  function checkAndAwardFreezes() {
    if (!state.habits.length) return;
    const today = todayStr();
    const allDone = state.habits.every((h) => state.completions[h.id]?.[today]);
    if (allDone && state._lastPerfectDayRecorded !== today) {
      state._lastPerfectDayRecorded = today;
      state.perfectDaysCount = (state.perfectDaysCount || 0) + 1;
      if (state.perfectDaysCount >= 14) {
        state.streakFreezes = (state.streakFreezes || 0) + 1;
        state.perfectDaysCount = 0;
        showToast("🧊 Streak freeze earned! 14 perfect days tracked.");
      }
      saveData();
    }
    updateFreezeBanner();
  }
  function updateFreezeBanner() {
    const banner = document.getElementById("freezeBanner");
    const cEl = document.getElementById("freezeCount");
    const sEl = document.getElementById("streakFreezes");
    if (banner) banner.hidden = state.streakFreezes <= 0;
    if (cEl) cEl.textContent = state.streakFreezes;
    if (sEl) sEl.textContent = state.streakFreezes;
  }
  function useStreakFreeze() {
    if (state.streakFreezes <= 0) {
      showToast(
        "❌ No freezes available! Earn one by completing all habits for 14 days.",
      );
      return;
    }
    const today = todayStr();
    if (state.freezeUsedDates.includes(today)) {
      showToast("✅ Already used a freeze today.");
      return;
    }
    if (!confirm("🧊 Use a streak freeze for today?")) return;
    state.streakFreezes--;
    state.freezeUsedDates.push(today);
    saveData();
    updateFreezeBanner();
    generateStreaksAndBadges();
    generateCalendar();
    showToast("🧊 Streak freeze applied! Your streaks are safe today.");
  }

  // ─────────────────────────────────────────
  // CONFETTI + SOUND
  // ─────────────────────────────────────────
  function triggerConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    if (!canvas) return;
    canvas.hidden = false;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 8 + 4,
      d: Math.random() * 3 + 1,
      color: `hsl(${Math.random() * 360},90%,60%)`,
      tilt: 0,
      tiltAngle: 0,
      tiltAngleDelta: Math.random() * 0.1 + 0.05,
    }));
    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.tiltAngle += p.tiltAngleDelta;
        p.y += p.d + 1;
        p.tilt = Math.sin(p.tiltAngle) * 15;
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();
      });
      if (++frame < 120) requestAnimationFrame(draw);
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.hidden = true;
      }
    }
    draw();
    const bar = document.getElementById("progressBar");
    if (bar) {
      bar.classList.add("neon-glow");
      setTimeout(() => bar.classList.remove("neon-glow"), 2000);
    }
    try {
      const ac = getAudioCtx();
      if (ac)
        ac.resume()
          .then(() => {
            [523, 659, 784, 1047].forEach((freq, i) => {
              const osc = ac.createOscillator(),
                gain = ac.createGain();
              osc.connect(gain);
              gain.connect(ac.destination);
              osc.type = "sine";
              osc.frequency.value = freq;
              gain.gain.setValueAtTime(0.15, ac.currentTime + i * 0.12);
              gain.gain.exponentialRampToValueAtTime(
                0.001,
                ac.currentTime + i * 0.12 + 0.3,
              );
              osc.start(ac.currentTime + i * 0.12);
              osc.stop(ac.currentTime + i * 0.12 + 0.35);
            });
          })
          .catch(() => {}); // Fix #6: prevent unhandled rejection if no user gesture
    } catch (_) {}
  }

  function showToast(msg) {
    let t = document.getElementById("habitToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "habitToast";
      t.className = "toast";
      t.setAttribute("role", "status"); // Fix #15: screen reader support
      t.setAttribute("aria-live", "polite"); // Fix #15
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._to);
    t._to = setTimeout(() => {
      t.style.opacity = "0";
    }, 2500);
  }

  // ─────────────────────────────────────────
  // DAY NOTES
  // ─────────────────────────────────────────
  function openDayNotesModal(dateStr, label) {
    currentNotesDate = dateStr;
    // textContent — label comes from our code, but be safe
    document.getElementById("dayNotesTitle").textContent =
      `📝 Notes for ${label}`;
    document.getElementById("dayNotesInput").value =
      state.dayNotes[dateStr] || "";
    document.getElementById("dayNotesSavedMsg").hidden = true;
    document.getElementById("dayNotesModal").classList.add("active");
  }
  function closeDayNotesModal() {
    document.getElementById("dayNotesModal").classList.remove("active");
    currentNotesDate = null;
  }
  function saveDayNote() {
    if (!currentNotesDate) return;
    state.dayNotes[currentNotesDate] = document
      .getElementById("dayNotesInput")
      .value.trim();
    saveData();
    document.getElementById("dayNotesSavedMsg").hidden = false;
    setTimeout(closeDayNotesModal, 900);
  }

  // ─────────────────────────────────────────
  // STREAKS & BADGES
  // ─────────────────────────────────────────
  function generateStreaksAndBadges() {
    const sc = document.getElementById("streaksContainer");
    const bc = document.getElementById("badgesContainer");
    if (!sc || !bc) return;

    // Build streaks using DOM — habit names sanitized via textContent
    sc.innerHTML = "";

    let maxS = 0,
      any = false;
    state.habits.forEach((h) => {
      const s = calcStreak(h.id);
      if (s > 0) {
        any = true;
        const cat = getCatColor(h.category || "other");
        const row = document.createElement("div");
        row.className = "streak-item";
        const nameSpan = document.createElement("span");
        nameSpan.className = "streak-name";
        nameSpan.style.cssText = `border-left:3px solid ${cat.accent};padding-left:6px`;
        nameSpan.textContent = `${h.emoji} ${h.name}`; // textContent — XSS safe
        const countSpan = document.createElement("span");
        countSpan.className = "streak-count";
        countSpan.textContent = `${s} ${s === 1 ? "day" : "days"} 🔥`;
        row.appendChild(nameSpan);
        row.appendChild(countSpan);
        sc.appendChild(row);
        maxS = Math.max(maxS, calcBestStreak(h.id));
      }
    });
    if (!any) {
      const empty = document.createElement("div");
      empty.className = "empty-msg";
      empty.textContent = "Start completing habits to build streaks!";
      sc.appendChild(empty);
    }
    const bestEl = document.getElementById("bestStreak");
    if (bestEl) bestEl.textContent = maxS + "d";

    // Badges (no user data in badge labels — safe innerHTML)
    const earned = getEarnedBadges();
    let bHtml = '<div class="badges-grid">';
    BADGES.forEach((b) => {
      bHtml += `<div class="badge ${earned.includes(b.id) ? "earned" : ""}" title="${sanitize(b.desc)}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${sanitize(b.name)}</div>
      </div>`;
    });
    bHtml += "</div>";
    bc.innerHTML = bHtml;
  }

  // ─────────────────────────────────────────
  // CALENDAR (inline handlers replaced with data-attrs + delegated listener)
  // ─────────────────────────────────────────
  function generateCalendar() {
    if (state.calendarView === "week") generateWeekView();
    else if (state.calendarView === "today") generateTodayView();
    else generateMonthView();
  }

  // ─────────────────────────────────────────
  // FIX #15: TODAY VIEW — focused daily checklist
  // ─────────────────────────────────────────
  function generateTodayView() {
    const table = document.getElementById("calendarTable");
    const today = todayStr();
    const now = new Date();
    const titleEl = document.getElementById("monthTitle");
    if (titleEl)
      titleEl.textContent = `Today — ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    const habits = getVisibleHabits();

    if (!habits.length) {
      table.innerHTML = "";
      return;
    }

    let html =
      '<thead><tr><th colspan="2" style="text-align:left;padding:8px 12px;font-size:13px;font-weight:700;">☀️ Today\'s Habits</th></tr></thead><tbody>';
    habits.forEach((h) => {
      const chk = !!state.completions[h.id]?.[today];
      const cat = getCatColor(h.category || "other");
      html += `<tr class="today-habit-row${chk ? " today-done" : ""}">
        <td class="today-habit-name" style="border-left:4px solid ${cat.accent}">
          <span class="today-emoji">${sanitize(h.emoji)}</span>
          <span class="today-name-text">${sanitize(h.name)}</span>
        </td>
        <td class="today-checkbox-cell">
          <div class="today-checkbox${chk ? " checked" : ""}" data-toggle="${h.id}" data-date="${today}" title="${sanitize(h.emoji)} ${sanitize(h.name)}">
            ${chk ? "✓" : ""}
          </div>
        </td>
      </tr>`;
    });
    html += "</tbody>";
    table.innerHTML = html;
    generateMentalStateGrids();
  }

  function generateWeekView() {
    const wsStr = state.currentWeekStart || weekStart(new Date());
    const ws = new Date(wsStr + "T00:00:00"); // parse as local time (Fix #13)
    const titleEl = document.getElementById("monthTitle");
    if (titleEl)
      titleEl.textContent = `Week of ${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}, ${ws.getFullYear()}`;
    const DAY_NAMES = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    let html = "<thead><tr><th>My Habits</th>";
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      const ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const hasNote = !!state.dayNotes[ds];
      html += `<th>${DAY_NAMES[i]}<br>${d.getDate()}
        <span class="note-dot-btn" data-open-note="${sanitize(ds)}" data-note-label="${sanitize(DAY_NAMES[i] + " " + d.getDate())}" title="${hasNote ? "Has note" : "Add note"}">${hasNote ? "📝" : "＋"}</span>
      </th>`;
    }
    html += "</tr></thead><tbody>";

    const visibleForWeek = getVisibleHabits();
    if (!visibleForWeek.length && state.habits.length > 0) {
      html += `<tr><td colspan="8" style="padding:48px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🔍</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">No habits found for this filter</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">Try a different board or category filter above.</div>
      </td></tr>`;
      html += "</tbody>";
      document.getElementById("calendarTable").innerHTML = html;
      generateMentalStateGrids();
      return;
    }

    visibleForWeek.forEach((h) => {
      const cat = getCatColor(h.category || "other");
      html += `<tr draggable="true" data-habit-id="${h.id}" class="habit-row">
        <td class="habit-name" style="border-left:3px solid ${cat.accent}">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="habit-name-label" data-inline-edit="${h.id}" title="Double-click to rename">${sanitize(h.emoji)} ${sanitize(h.name)}</span>
          <span class="habit-meatball" data-meatball="${h.id}" title="Habit options">⋮</span>
        </td>`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        const ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const chk = !!state.completions[h.id]?.[ds];
        const frz = state.freezeUsedDates?.includes(ds);
        const isYesterday = ds === yesterdayStr();
        const tipDate = `${DAY_NAMES[i]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
        html += `<td class="${isYesterday ? "yesterday-col" : ""}"><div class="checkbox${chk ? " checked" : ""}${frz ? " frozen" : ""}"
          data-toggle="${h.id}" data-date="${ds}"
          title="${sanitize(h.emoji)} ${sanitize(h.name)} — ${tipDate}"></div></td>`;
      }
      html += "</tr>";
    });
    html += "</tbody>";
    document.getElementById("calendarTable").innerHTML = html;
    generateMentalStateGrids();
  }

  function generateMonthView() {
    const titleEl = document.getElementById("monthTitle");
    if (titleEl)
      titleEl.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;

    const visibleHabits = getVisibleHabits();

    // Fix #1: Smart empty state for active filters
    const table = document.getElementById("calendarTable");
    if (!visibleHabits.length && state.habits.length > 0) {
      table.innerHTML = `<tbody><tr><td colspan="50" style="padding:48px 24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🔍</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px;">No habits found for this filter</div>
        <div style="font-size:13px;color:var(--color-text-secondary)">Try a different board or category, or <button onclick="document.getElementById('addHabitFab').click()" style="background:none;border:none;color:var(--color-success);font-weight:700;cursor:pointer;font-size:13px;">add a new habit</button> here.</div>
      </td></tr></tbody>`;
      return;
    }
    const firstDay = new Date(
      state.currentYear,
      state.currentMonth,
      1,
    ).getDay();
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const weeks = Math.ceil((firstDay + dim) / 7);
    const DN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    let html = "<thead><tr><th>My Habits</th>";
    for (let w = 1; w <= weeks; w++) html += `<th colspan="7">Week ${w}</th>`;
    html += "</tr><tr><th></th>";
    for (let w = 0; w < weeks; w++)
      DN.forEach((d) => {
        html += `<th>${d}</th>`;
      });
    html += '</tr><tr class="day-numbers-row"><th>Day</th>';
    let dc = 1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDay) || dc > dim) {
          html += "<th></th>";
          continue;
        }
        const ds = fmt(state.currentYear, state.currentMonth + 1, dc);
        const hasNote = !!state.dayNotes[ds];
        const frz = state.freezeUsedDates?.includes(ds);
        const isYd = ds === yesterdayStr();
        html += `<th class="day-number-cell${frz ? " frozen-day" : ""}${isYd ? " yesterday-col" : ""}">${dc}
          <span class="note-dot-btn" data-open-note="${ds}" data-note-label="${MONTH_NAMES[state.currentMonth]} ${dc}" title="${hasNote ? "Has note" : "Add note"}">${hasNote ? "📝" : ""}</span>
          ${frz ? '<span title="Freeze">🧊</span>' : ""}
        </th>`;
        dc++;
      }
    }
    html += "</tr></thead><tbody>";
    visibleHabits.forEach((h) => {
      const cat = getCatColor(h.category || "other");
      html += `<tr draggable="true" data-habit-id="${h.id}" class="habit-row">
        <td class="habit-name" style="border-left:3px solid ${cat.accent}">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="habit-name-label" data-inline-edit="${h.id}" title="Double-click to rename">${sanitize(h.emoji)} ${sanitize(h.name)}</span>
          <span class="habit-meatball" data-meatball="${h.id}" title="Habit options">⋮</span>
        </td>`;
      dc = 1;
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          if ((w === 0 && d < firstDay) || dc > dim) {
            html += "<td></td>";
            continue;
          }
          const ds = fmt(state.currentYear, state.currentMonth + 1, dc);
          const chk = !!state.completions[h.id]?.[ds];
          const frz = state.freezeUsedDates?.includes(ds);
          const isYesterday = ds === yesterdayStr();
          const tipDate = `${MONTH_NAMES[state.currentMonth]} ${dc}`;
          html += `<td class="${isYesterday ? "yesterday-col" : ""}"><div class="checkbox${chk ? " checked" : ""}${frz ? " frozen" : ""}"
            data-toggle="${h.id}" data-date="${ds}"
            title="${sanitize(h.emoji)} ${sanitize(h.name)} — ${tipDate}"></div></td>`;
          dc++;
        }
      }
      html += "</tr>";
    });
    // Summary rows
    [
      { label: "Progress", fn: (ds) => calcDayPct(ds) + "%" },
      { label: "Done", fn: (ds) => calcDayDone(ds) },
      {
        label: "Not Done",
        fn: (ds) => getVisibleHabits().length - calcDayDone(ds),
      },
    ].forEach((row) => {
      html += `<tr class="summary-row"><td>${row.label}</td>`;
      dc = 1;
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          if ((w === 0 && d < firstDay) || dc > dim) {
            html += "<td></td>";
            continue;
          }
          const ds = fmt(state.currentYear, state.currentMonth + 1, dc);
          html += `<td>${row.fn(ds)}</td>`;
          dc++;
        }
      }
      html += "</tr>";
    });
    html += "</tbody>";
    document.getElementById("calendarTable").innerHTML = html;
    generateMentalStateGrids();
  }

  // ─────────────────────────────────────────
  // SURGICAL TOGGLE — no full calendar rebuild
  // ─────────────────────────────────────────
  function toggleHabit(habitId, dateStr, checkboxEl) {
    if (!state.completions[habitId]) state.completions[habitId] = {};
    const newVal = !state.completions[habitId][dateStr];
    state.completions[habitId][dateStr] = newVal;
    saveData();

    // SURGICAL DOM UPDATE: just flip the class on the single element
    checkboxEl.classList.toggle("checked", newVal);

    // Update progress summary cells for this date column (if month view)
    updateSummaryCellsForDate(dateStr);

    // Celebrate if all done today
    const allDone = state.habits.every(
      (h) => state.completions[h.id]?.[dateStr],
    );
    if (allDone && state.habits.length > 0 && dateStr === todayStr()) {
      triggerConfetti();
      showToast("🎉 All habits complete for today! Amazing work!");
      checkAndAwardFreezes();
    }

    // Update lightweight panels — no full rebuild
    updateStats();
    generateStreaksAndBadges();
    updateProgressChart();
    generateAnalysis();
    generateProgressRings();
    generateReportCard();
    checkBestMonthBanner();
    updatePrediction();
    generateStrugglingBanner();
    updateShareCard();
  }

  function updateSummaryCellsForDate(dateStr) {
    // Find all data-toggle divs for this date to count done habits
    const table = document.getElementById("calendarTable");
    if (!table) return;
    // Summary row cells are identified by their position; simpler to just re-render summary
    // rows only — which are the last 3 <tr class="summary-row"> rows.
    const summaryRows = table.querySelectorAll(".summary-row");
    if (!summaryRows.length) return;
    // Find column index for this date
    const allDateCells = table.querySelectorAll("[data-date]");
    let colIndex = -1;
    for (const cell of allDateCells) {
      if (cell.dataset.date === dateStr) {
        // Get td index within its row
        const td = cell.closest("td");
        if (td) {
          colIndex = Array.from(td.parentElement.children).indexOf(td);
          break;
        }
      }
    }
    if (colIndex < 0) return;
    const fns = [
      (ds) => calcDayPct(ds) + "%",
      (ds) => calcDayDone(ds),
      (ds) => getVisibleHabits().length - calcDayDone(ds),
    ];
    summaryRows.forEach((row, i) => {
      const td = row.children[colIndex];
      if (td && fns[i]) td.textContent = fns[i](dateStr);
    });
  }

  // Day progress helpers
  function calcDayPct(ds) {
    const h = getVisibleHabits();
    if (!h.length) return 0;
    return Math.round(
      (h.filter((x) => state.completions[x.id]?.[ds]).length / h.length) * 100,
    );
  }
  function calcDayDone(ds) {
    // Fix: use getVisibleHabits() so summary row respects board/category filter
    return getVisibleHabits().filter((h) => state.completions[h.id]?.[ds])
      .length;
  }

  // ─────────────────────────────────────────
  // MOOD PICKER (F11)
  // ─────────────────────────────────────────
  function generateMentalStateGrids() {
    // Fix #20: in week view show only the 7 days of the current week
    let days = [];
    if (state.calendarView === "week") {
      const wsStr = state.currentWeekStart || weekStart(new Date());
      const ws = new Date(wsStr + "T00:00:00"); // local time (Fix #13)
      for (let i = 0; i < 7; i++) {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        days.push({
          d: d.getDate(),
          ds: fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()),
        });
      }
    } else {
      const dim = daysInMonth(state.currentYear, state.currentMonth);
      for (let d = 1; d <= dim; d++) {
        days.push({ d, ds: fmt(state.currentYear, state.currentMonth + 1, d) });
      }
    }

    let dayH = '<div class="mental-label">Day</div>';
    let moodH = '<div class="mental-label">Mood</div>';
    let motH = '<div class="mental-label">Motivation</div>';
    days.forEach(({ d, ds }) => {
      const mood = state.mentalState.mood[ds];
      const mot = state.mentalState.motivation[ds];
      const moodDisplay = mood != null ? MOOD_EMOJIS[mood - 1] || mood : "−";
      dayH += `<div class="day-number">${d}</div>`;
      moodH += `<div class="mental-value mood-cell" data-open-mood="${ds}" title="Set mood">${moodDisplay}</div>`;
      motH += `<div class="mental-value" data-open-mot="${ds}" data-mot-day="${d}">${mot != null ? mot : "−"}</div>`;
    });
    document.getElementById("dayNumberGrid").innerHTML = dayH;
    document.getElementById("moodGrid").innerHTML = moodH;
    document.getElementById("motivationGrid").innerHTML = motH;
  }

  function openMoodPicker(dateStr, cell) {
    const pop = document.getElementById("moodPickerPopover");
    pop.innerHTML = "";
    MOOD_EMOJIS.forEach((em, i) => {
      const btn = document.createElement("button");
      btn.className = "mood-emoji-btn";
      btn.textContent = em;
      btn.title = `Level ${i + 1}`;
      btn.addEventListener("click", () => {
        state.mentalState.mood[dateStr] = i + 1;
        saveData();
        pop.hidden = true;
        generateMentalStateGrids();
        updateMentalChart();
      });
      pop.appendChild(btn);
    });
    const rect = cell.getBoundingClientRect();
    pop.style.top = rect.bottom + window.scrollY + 4 + "px";
    pop.style.left =
      Math.min(rect.left + window.scrollX, window.innerWidth - 220) + "px";
    pop.hidden = false;
    setTimeout(() => {
      document.addEventListener("click", closeMoodPickerOutside, {
        once: true,
      });
    }, 50);
  }
  function closeMoodPickerOutside(e) {
    const pop = document.getElementById("moodPickerPopover");
    if (pop && !pop.contains(e.target)) pop.hidden = true;
  }
  function openMotivationPicker(dateStr, dayNum) {
    // Fix: use a popover instead of browser-blocking prompt()
    const existing = document.getElementById("motivationPopover");
    if (existing) existing.remove();

    const pop = document.createElement("div");
    pop.id = "motivationPopover";
    pop.className = "mood-picker-popover motivation-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Set motivation for day ${dayNum}`);

    const title = document.createElement("div");
    title.className = "mot-popover-title";
    title.textContent = `Day ${dayNum} motivation (1–10)`;
    pop.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "mot-btn-grid";
    const current = state.mentalState.motivation[dateStr];
    for (let n = 1; n <= 10; n++) {
      const btn = document.createElement("button");
      btn.className =
        "mood-emoji-btn mot-num-btn" + (current === n ? " mot-selected" : "");
      btn.textContent = n;
      btn.title = `Motivation: ${n}`;
      btn.addEventListener("click", () => {
        state.mentalState.motivation[dateStr] = n;
        saveData();
        pop.remove();
        generateMentalStateGrids();
        updateMentalChart();
      });
      grid.appendChild(btn);
    }
    pop.appendChild(grid);

    // Position near the clicked cell
    const cell = document.querySelector(`[data-open-mot="${dateStr}"]`);
    if (cell) {
      const rect = cell.getBoundingClientRect();
      pop.style.position = "fixed";
      pop.style.top = rect.bottom + 4 + "px";
      pop.style.left = Math.min(rect.left, window.innerWidth - 230) + "px";
    } else {
      pop.style.position = "fixed";
      pop.style.top = "50%";
      pop.style.left = "50%";
      pop.style.transform = "translate(-50%,-50%)";
    }
    document.body.appendChild(pop);
    setTimeout(() => {
      document.addEventListener("click", function closeMotPop(e) {
        if (!pop.contains(e.target)) {
          pop.remove();
          document.removeEventListener("click", closeMotPop);
        }
      });
    }, 50);
  }

  // ─────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────
  function updateStats() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    let total = 0;
    const possible = state.habits.length * dim;
    state.habits.forEach((h) => {
      for (let d = 1; d <= dim; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          total++;
      }
    });
    const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
    document.getElementById("totalHabits").textContent = state.habits.length;
    document.getElementById("completedHabits").textContent = total;
    document.getElementById("progressPercent").textContent = pct + "%";
    document.getElementById("progressBar").style.width = pct + "%";
  }

  // ─────────────────────────────────────────
  // FIX #18: DRAG-AND-DROP REORDERING
  // ─────────────────────────────────────────
  let dragSrcId = null;

  function initDragAndDrop() {
    const table = document.getElementById("calendarTable");
    if (!table) return;

    table.addEventListener("dragstart", (e) => {
      const row = e.target.closest("[data-habit-id]");
      if (!row) return;
      dragSrcId = parseInt(row.dataset.habitId);
      row.classList.add("drag-dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    table.addEventListener("dragend", (e) => {
      const row = e.target.closest("[data-habit-id]");
      if (row) row.classList.remove("drag-dragging");
      table
        .querySelectorAll(".drag-over")
        .forEach((r) => r.classList.remove("drag-over"));
    });

    table.addEventListener("dragover", (e) => {
      e.preventDefault();
      const row = e.target.closest("[data-habit-id]");
      if (!row) return;
      table
        .querySelectorAll(".drag-over")
        .forEach((r) => r.classList.remove("drag-over"));
      row.classList.add("drag-over");
    });

    table.addEventListener("drop", (e) => {
      e.preventDefault();
      const row = e.target.closest("[data-habit-id]");
      if (!row) return;
      const dropId = parseInt(row.dataset.habitId);
      if (dragSrcId === dropId) return;
      // Reorder in state
      const fromIdx = state.habits.findIndex((h) => h.id === dragSrcId);
      const toIdx = state.habits.findIndex((h) => h.id === dropId);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = state.habits.splice(fromIdx, 1);
      state.habits.splice(toIdx, 0, moved);
      saveData();
      generateCalendar();
      showToast("↕️ Habit order saved!");
    });
  }

  // ─────────────────────────────────────────
  // FIX #16: MEATBALL MENU (contextual habit management)
  // ─────────────────────────────────────────
  function openMeatballMenu(habitId, anchorEl) {
    // Remove any existing menu
    const existing = document.getElementById("meatballMenu");
    if (existing) existing.remove();

    const h = state.habits.find((x) => x.id === habitId);
    if (!h) return;

    const menu = document.createElement("div");
    menu.id = "meatballMenu";
    menu.className = "meatball-menu";

    const rename = document.createElement("button");
    rename.className = "meatball-item";
    rename.textContent = "✏️ Rename";
    rename.addEventListener("click", () => {
      menu.remove();
      startInlineEdit(habitId);
    });

    const del = document.createElement("button");
    del.className = "meatball-item meatball-danger";
    del.textContent = "🗑 Delete";
    del.addEventListener("click", () => {
      menu.remove();
      removeHabit(habitId);
    });

    menu.appendChild(rename);
    menu.appendChild(del);

    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.left = Math.min(rect.left, window.innerWidth - 160) + "px";
    document.body.appendChild(menu);

    setTimeout(() => {
      document.addEventListener("click", function closeMeatball(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", closeMeatball);
        }
      });
    }, 50);
  }

  // ─────────────────────────────────────────
  // FIX #17: INLINE HABIT RENAMING
  // ─────────────────────────────────────────
  function startInlineEdit(habitId) {
    const h = state.habits.find((x) => x.id === habitId);
    if (!h) return;
    const label = document.querySelector(`[data-inline-edit="${habitId}"]`);
    if (!label) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "inline-edit-input";
    input.value = h.name;
    input.setAttribute("aria-label", "Rename habit");

    label.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const newName = input.value.trim();
      if (newName && newName !== h.name) {
        h.name = newName;
        saveData();
        showToast("✅ Habit renamed!");
      }
      generateCalendar();
      generateAnalysis();
      generateStreaksAndBadges();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        input.value = h.name;
        input.blur();
      }
    });
  }

  // ─────────────────────────────────────────
  // FIX #12: COLLAPSIBLE STATE PERSISTENCE
  // ─────────────────────────────────────────
  const COLLAPSIBLE_STORAGE_KEY = () => `ht_collapse_${currentUser || "anon"}`;

  function loadCollapsibleState() {
    try {
      const raw = localStorage.getItem(COLLAPSIBLE_STORAGE_KEY());
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveCollapsibleState(targetId, isCollapsed) {
    try {
      const saved = loadCollapsibleState();
      saved[targetId] = isCollapsed;
      localStorage.setItem(COLLAPSIBLE_STORAGE_KEY(), JSON.stringify(saved));
    } catch (_) {}
  }

  function applyCollapsibleState() {
    const saved = loadCollapsibleState();
    document.querySelectorAll(".collapsible-trigger").forEach((trigger) => {
      const targetId = trigger.dataset.target;
      const body = document.getElementById(targetId);
      if (!body) return;
      // Default: streaks & analysis expanded; badges collapsed
      const defaultCollapsed = targetId === "badgesBody";
      const isCollapsed =
        saved[targetId] !== undefined ? saved[targetId] : defaultCollapsed;
      if (isCollapsed) {
        body.classList.add("collapsed");
        trigger.classList.add("collapsed");
      }
    });
  }

  // ─────────────────────────────────────────
  // FIX #1 (smart empty state for week view too)
  // ─────────────────────────────────────────
  function generateAnalysis() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const container = document.getElementById("analysisContainer");
    if (!container) return;

    // Show/hide empty state
    const emptyState = document.getElementById("emptyState");
    if (emptyState) emptyState.hidden = state.habits.length > 0;

    const habits = getVisibleHabits();
    if (!habits.length) {
      container.innerHTML =
        '<div class="empty-msg">No habits match this filter.</div>';
      return;
    }

    const items = habits
      .map((h) => {
        let done = 0;
        for (let d = 1; d <= dim; d++) {
          if (
            state.completions[h.id]?.[
              fmt(state.currentYear, state.currentMonth + 1, d)
            ]
          )
            done++;
        }
        const streak = calcStreak(h.id);
        const cat = getCatColor(h.category || "other");
        return { h, done, goal: dim, streak, cat };
      })
      .sort((a, b) => b.done - a.done);

    // Build with DOM to keep habit names XSS-safe
    container.innerHTML = "";
    items.forEach(({ h, done, goal, streak, cat }) => {
      const pct = Math.round((done / goal) * 100);
      const glowPx = Math.min(streak * 2, 20);
      const chainCol =
        streak > 0
          ? `rgba(${streak > 14 ? "255,140,0" : "76,175,80"},${0.4 + Math.min(streak / 30, 0.6)})`
          : "var(--color-border)";

      const item = document.createElement("div");
      item.className = "analysis-item";

      // Header row: name + category tag + trash icon
      const hdr = document.createElement("div");
      hdr.className = "analysis-item-header";
      const nameSpan = document.createElement("span");
      nameSpan.className = "analysis-habit-name";
      nameSpan.textContent = `${h.emoji} ${h.name}`; // textContent — XSS safe

      const catTag = document.createElement("span");
      catTag.className = "cat-tag";
      catTag.style.cssText = `background:${cat.bg};color:${cat.accent};border:1px solid ${cat.accent}`;
      catTag.textContent = cat.label;

      const trashBtn = document.createElement("button");
      trashBtn.className = "trash-btn";
      trashBtn.title = `Remove ${h.name}`;
      trashBtn.setAttribute("aria-label", `Remove ${h.name}`);
      trashBtn.textContent = "🗑";
      trashBtn.dataset.removeHabit = h.id;

      hdr.appendChild(nameSpan);
      hdr.appendChild(catTag);
      hdr.appendChild(trashBtn);
      item.appendChild(hdr);

      // Progress bar row
      const barWrap = document.createElement("div");
      barWrap.className = "analysis-bar-row";
      const barBg = document.createElement("div");
      barBg.className = "analysis-bar";
      const barFill = document.createElement("div");
      barFill.className = "analysis-bar-fill";
      barFill.style.cssText = `width:${pct}%;background:${cat.accent}`;
      const barLabel = document.createElement("span");
      barLabel.className = "analysis-bar-label";
      barLabel.textContent = `${done}/${goal} — ${pct}%`;
      barBg.appendChild(barFill);
      barWrap.appendChild(barBg);
      barWrap.appendChild(barLabel);
      item.appendChild(barWrap);

      // Streak chain
      if (streak > 0) {
        const chainWrap = document.createElement("div");
        chainWrap.className = "chain-wrap";
        const chain = document.createElement("div");
        chain.className = "streak-chain";
        chain.style.cssText = `background:${chainCol};width:${Math.min(100, streak * 3)}%;box-shadow:${streak > 7 ? `0 0 ${glowPx}px ${chainCol}` : "none"}`;
        const chainLabel = document.createElement("span");
        chainLabel.className = "chain-label";
        chainLabel.textContent = `🔥 ${streak}-day chain`;
        chainWrap.appendChild(chain);
        chainWrap.appendChild(chainLabel);
        item.appendChild(chainWrap);
      }

      container.appendChild(item);
    });
  }

  function removeHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    if (!confirm(`Remove "${h.name}"? All data will be permanently deleted.`))
      return;
    state.habits = state.habits.filter((x) => x.id !== id);
    delete state.completions[id];
    if (state.habitCreatedDates) delete state.habitCreatedDates[id];
    saveData();
    generateCalendar();
    updateStats();
    generateStreaksAndBadges();
    updateProgressChart();
    generateAnalysis();
    generateProgressRings();
    generateReportCard();
    generateStrugglingBanner();
  }

  // ─────────────────────────────────────────
  // CHARTS
  // ─────────────────────────────────────────
  function buildProgressData() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const labels = [],
      data = [];
    for (let d = 1; d <= dim; d++) {
      labels.push(d);
      data.push(calcDayPct(fmt(state.currentYear, state.currentMonth + 1, d)));
    }
    return { labels, data };
  }
  function buildMoodData() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const labels = [],
      data = [];
    for (let d = 1; d <= dim; d++) {
      labels.push(d);
      const ds = fmt(state.currentYear, state.currentMonth + 1, d);
      data.push((state.mentalState.mood[ds] || 0) * 10);
    }
    return { labels, data };
  }
  function createCharts() {
    createProgressChart();
    createMentalChart();
  }
  function createProgressChart() {
    const el = document.getElementById("progressChart");
    if (!el) return;
    try {
      const ex = Chart.getChart(el);
      if (ex) ex.destroy();
    } catch (_) {}
    if (progressChart) {
      try {
        progressChart.destroy();
      } catch (_) {}
    }
    const { labels, data } = buildProgressData();
    progressChart = new Chart(el.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Daily Progress",
            data,
            backgroundColor: "rgba(139,195,74,0.3)",
            borderColor: "rgba(139,195,74,1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => v + "%" },
          },
        },
      },
    });
  }
  function createMentalChart() {
    const el = document.getElementById("mentalChart");
    if (!el) return;
    try {
      const ex = Chart.getChart(el);
      if (ex) ex.destroy();
    } catch (_) {}
    if (mentalChart) {
      try {
        mentalChart.destroy();
      } catch (_) {}
    }
    const { labels, data } = buildMoodData();
    mentalChart = new Chart(el.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Mood",
            data,
            backgroundColor: "rgba(225,190,231,0.3)",
            borderColor: "rgba(225,190,231,1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => v + "%" },
          },
        },
      },
    });
  }
  function refreshCharts() {
    if (progressChart) {
      const { labels, data } = buildProgressData();
      progressChart.data.labels = labels;
      progressChart.data.datasets[0].data = data;
      progressChart.update("active");
    } else createProgressChart();
    if (mentalChart) {
      const { labels, data } = buildMoodData();
      mentalChart.data.labels = labels;
      mentalChart.data.datasets[0].data = data;
      mentalChart.update("active");
    } else createMentalChart();
  }
  function updateProgressChart() {
    if (!progressChart) return;
    const { data } = buildProgressData();
    progressChart.data.datasets[0].data = data;
    progressChart.update("active");
  }
  function updateMentalChart() {
    if (!mentalChart) return;
    const { data } = buildMoodData();
    mentalChart.data.datasets[0].data = data;
    mentalChart.update("active");
  }

  function changeMonth(dir) {
    if (state.calendarView === "week") {
      const wsStr = state.currentWeekStart || weekStart(new Date());
      const w = new Date(wsStr + "T00:00:00");
      w.setDate(w.getDate() + dir * 7);
      state.currentWeekStart = fmt(
        w.getFullYear(),
        w.getMonth() + 1,
        w.getDate(),
      ); // Fix #13: local date string
    } else {
      state.currentMonth += dir;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
      } else if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
      }
    }
    generateCalendar();
    initDragAndDrop(); // Fix #18: rebind after DOM rebuild
    updateStats();
    refreshCharts();
    generateAnalysis();
    generateHeatmap();
    generateProgressRings();
    generateReportCard();
    checkBestMonthBanner();
    generateDowAnalysis();
    updatePrediction();
    generateStrugglingBanner();
    updateShareCard();
    generateStreaksAndBadges(); // Fix #18: refresh streaks after month change
    updateFreezeBanner(); // Fix #18: refresh freeze banner after month change
  }

  // ─────────────────────────────────────────
  // FEATURE 1: YEAR HEATMAP
  // ─────────────────────────────────────────
  function generateHeatmap() {
    const grid = document.getElementById("heatmapGrid");
    if (!grid) return;
    const today = new Date();
    const startDate = new Date(today.getFullYear(), 0, 1);
    const totalHabits = state.habits.length || 1;
    const startDow = startDate.getDay();
    let html = '<div class="hm-month-labels">';
    for (let m = 0; m < 12; m++)
      html += `<div class="hm-month-label">${MONTH_NAMES[m].slice(0, 3)}</div>`;
    html += '</div><div class="hm-weeks"><div class="hm-week">';
    for (let pad = 0; pad < startDow; pad++)
      html += '<div class="hm-cell hm-empty"></div>';
    let weekCells = startDow;
    let cellDate = new Date(startDate);
    while (cellDate <= today) {
      const ds = fmt(
        cellDate.getFullYear(),
        cellDate.getMonth() + 1,
        cellDate.getDate(),
      );
      let done = 0;
      state.habits.forEach((h) => {
        if (state.completions[h.id]?.[ds]) done++;
      });
      const activeCount = getActiveHabitCountOnDate(ds) || 1;
      const pct = done / activeCount;
      const level =
        done === 0 ? 0 : pct < 0.25 ? 1 : pct < 0.5 ? 2 : pct < 0.75 ? 3 : 4;
      html += `<div class="hm-cell hm-lv${level}" title="${ds}: ${done}/${activeCount} habits"></div>`;
      weekCells++;
      if (weekCells === 7) {
        html += '</div><div class="hm-week">';
        weekCells = 0;
      }
      const next = new Date(cellDate);
      next.setDate(next.getDate() + 1);
      cellDate = next;
    }
    html += "</div></div>";
    grid.innerHTML = html;
  }

  // ─────────────────────────────────────────
  // FEATURE 2: PROGRESS RINGS
  // ─────────────────────────────────────────
  function generateProgressRings() {
    const grid = document.getElementById("ringsGrid");
    if (!grid) return;
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const today = new Date();
    const isCurrent =
      today.getMonth() === state.currentMonth &&
      today.getFullYear() === state.currentYear;
    const elapsed = isCurrent ? today.getDate() : dim;
    const habits = getVisibleHabits();
    if (!habits.length) {
      grid.innerHTML = '<div class="empty-msg">No habits to display.</div>';
      return;
    }
    let html = "";
    habits.forEach((h) => {
      let done = 0;
      for (let d = 1; d <= elapsed; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          done++;
      }
      const pct = Math.round((done / elapsed) * 100);
      const cat = getCatColor(h.category || "other");
      const r = 28,
        circ = 2 * Math.PI * r,
        offset = circ * (1 - pct / 100);
      // h.name sanitized via sanitize() inside SVG text
      html += `<div class="ring-item">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--color-border)" stroke-width="6"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="${cat.accent}" stroke-width="6"
            stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 36 36)" style="transition:stroke-dashoffset 0.6s ease"/>
          <text x="36" y="40" text-anchor="middle" font-size="13" font-weight="700" fill="${cat.accent}">${pct}%</text>
        </svg>
        <div class="ring-label">${sanitize(h.emoji)} ${sanitize(h.name)}</div>
      </div>`;
    });
    grid.innerHTML = html;
  }

  // ─────────────────────────────────────────
  // FEATURE 3: REPORT CARD
  // ─────────────────────────────────────────
  function gradeFromPct(pct) {
    if (pct >= 90) return { g: "A+", c: "#2e7d32" };
    if (pct >= 80) return { g: "A", c: "#388e3c" };
    if (pct >= 70) return { g: "B", c: "#558b2f" };
    if (pct >= 60) return { g: "C", c: "#f57f17" };
    if (pct >= 50) return { g: "D", c: "#e65100" };
    return { g: "F", c: "#c62828" };
  }
  function generateReportCard() {
    const grid = document.getElementById("reportCardGrid");
    if (!grid) return;
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const today = new Date();
    const isCurrent =
      today.getMonth() === state.currentMonth &&
      today.getFullYear() === state.currentYear;
    const elapsed = isCurrent ? today.getDate() : dim;
    const habits = getVisibleHabits();
    if (!habits.length) {
      grid.innerHTML = '<div class="empty-msg">No habits to grade.</div>';
      return;
    }
    grid.innerHTML = "";
    const hdr = document.createElement("div");
    hdr.className = "rc-header";
    hdr.innerHTML =
      "<span>Habit</span><span>Done</span><span>Rate</span><span>Grade</span>";
    grid.appendChild(hdr);
    habits.forEach((h) => {
      let done = 0;
      for (let d = 1; d <= elapsed; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          done++;
      }
      const pct = Math.round((done / elapsed) * 100);
      const { g, c } = gradeFromPct(pct);
      const row = document.createElement("div");
      row.className = "rc-row";
      // name cell — textContent, not innerHTML
      const nameCell = document.createElement("span");
      nameCell.className = "rc-name";
      nameCell.textContent = `${h.emoji} ${h.name}`;
      const doneCell = document.createElement("span");
      doneCell.className = "rc-done";
      doneCell.textContent = `${done}/${elapsed}`;
      const pctCell = document.createElement("span");
      pctCell.className = "rc-pct";
      pctCell.textContent = pct + "%";
      const gradeCell = document.createElement("span");
      gradeCell.className = "rc-grade";
      gradeCell.style.cssText = `color:${c};border-color:${c}`;
      gradeCell.textContent = g;
      row.append(nameCell, doneCell, pctCell, gradeCell);
      grid.appendChild(row);
    });
  }

  // ─────────────────────────────────────────
  // FEATURE 4: BEST MONTH BANNER
  // ─────────────────────────────────────────
  function checkBestMonthBanner() {
    const banner = document.getElementById("bestMonthBanner");
    if (!banner) return;
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    let total = 0,
      possible = 0;
    state.habits.forEach((h) => {
      for (let d = 1; d <= dim; d++) {
        const ds = fmt(state.currentYear, state.currentMonth + 1, d);
        possible++;
        if (state.completions[h.id]?.[ds]) total++;
      }
    });
    const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
    // Fix #19: use per-month key so navigating away never resets the record
    const monthKey = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, "0")}`;
    if (!state.bestMonthScores) state.bestMonthScores = {};
    const prevBest = state.bestMonthScores[monthKey] || 0;
    if (pct > 0 && pct > prevBest) {
      state.bestMonthScores[monthKey] = pct;
      saveData();
      const txt = document.getElementById("bestMonthText");
      if (txt)
        txt.textContent = `New personal record! ${pct}% in ${MONTH_NAMES[state.currentMonth]} — your best month yet! 🔥`;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  // ─────────────────────────────────────────
  // FEATURE 5: DAY-OF-WEEK ANALYSIS
  // ─────────────────────────────────────────
  function generateDowAnalysis() {
    const grid = document.getElementById("dowGrid");
    if (!grid) return;
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = new Array(7).fill(0),
      counts = new Array(7).fill(0);
    const habits =
      state.activeBoard === "all"
        ? state.habits
        : state.habits.filter(
            (h) => h.board === state.activeBoard || h.board === "all",
          );
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dow = d.getDay(),
        ds = fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
      let done = 0;
      habits.forEach((h) => {
        if (state.completions[h.id]?.[ds]) done++;
      });
      if (habits.length > 0) {
        totals[dow] += (done / habits.length) * 100;
        counts[dow]++;
      }
    }
    const avgs = totals.map((t, i) =>
      counts[i] > 0 ? Math.round(t / counts[i]) : 0,
    );
    const max = Math.max(...avgs, 1);
    let html = "";
    DAY_NAMES.forEach((name, i) => {
      const pct = avgs[i],
        barPct = Math.round((pct / max) * 100),
        isTop = pct === max && pct > 0;
      html += `<div class="dow-item${isTop ? " dow-best" : ""}">
        <div class="dow-name">${name}</div>
        <div class="dow-bar-wrap"><div class="dow-bar-fill" style="width:${barPct}%;background:${isTop ? "var(--color-streak)" : "var(--color-success)"}"></div></div>
        <div class="dow-pct">${pct}%${isTop ? " 🏆" : ""}</div>
      </div>`;
    });
    grid.innerHTML = html;
  }

  // ─────────────────────────────────────────
  // FEATURE 6: PREDICTION
  // ─────────────────────────────────────────
  function updatePrediction() {
    const badge = document.getElementById("predictionBadge");
    const val = document.getElementById("predictionValue");
    if (!badge || !val) return;
    const today = new Date();
    if (
      today.getMonth() !== state.currentMonth ||
      today.getFullYear() !== state.currentYear
    ) {
      badge.hidden = true;
      return;
    }
    const elapsed = today.getDate(),
      possible = state.habits.length * elapsed;
    let done = 0;
    state.habits.forEach((h) => {
      for (let d = 1; d <= elapsed; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          done++;
      }
    });
    if (!possible) {
      badge.hidden = true;
      return;
    }
    val.textContent = `${Math.round((done / possible) * 100)}% by end of ${MONTH_NAMES[state.currentMonth]}`;
    badge.hidden = false;
  }

  // ─────────────────────────────────────────
  // FEATURE 7: STRUGGLING HABITS
  // ─────────────────────────────────────────
  function generateStrugglingBanner() {
    const banner = document.getElementById("strugglingBanner");
    const list = document.getElementById("strugglingList");
    if (!banner || !list) return;
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    const today = new Date();
    const isCurrent =
      today.getMonth() === state.currentMonth &&
      today.getFullYear() === state.currentYear;
    const elapsed = isCurrent ? today.getDate() : dim;
    const struggling = [];
    state.habits.forEach((h) => {
      let done = 0;
      for (let d = 1; d <= elapsed; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          done++;
      }
      const pct = Math.round((done / elapsed) * 100);
      if (pct < 40 && elapsed > 3) struggling.push({ h, pct });
    });
    if (!struggling.length) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    list.innerHTML = "";
    struggling.forEach(({ h, pct }) => {
      const item = document.createElement("div");
      item.className = "struggling-item";
      const name = document.createElement("span");
      name.textContent = `${h.emoji} ${h.name}`; // safe
      const pctSpan = document.createElement("span");
      pctSpan.className = "struggling-pct";
      pctSpan.textContent = pct + "%";
      item.append(name, pctSpan);
      list.appendChild(item);
    });
  }

  // ─────────────────────────────────────────
  // FEATURE 8: BULK CHECK-IN
  // ─────────────────────────────────────────
  function openBulkCheckin() {
    const yesterday = yesterdayStr();
    const panel = document.getElementById("bulkCheckinBar");
    const container = document.getElementById("bulkCheckinHabits");
    if (!panel || !container) return;
    container.innerHTML = "";
    const dateInfo = document.createElement("div");
    dateInfo.className = "bulk-date-info";
    dateInfo.textContent = `Date: ${yesterday}`;
    container.appendChild(dateInfo);
    state.habits.forEach((h) => {
      const checked = !!state.completions[h.id]?.[yesterday];
      const label = document.createElement("label");
      label.className = `bulk-item${checked ? " bulk-checked" : ""}`;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.dataset.bulkHabit = h.id;
      cb.dataset.bulkDate = yesterday;
      const text = document.createElement("span");
      text.textContent = `${h.emoji} ${h.name}`; // safe
      label.append(cb, text);
      container.appendChild(label);
    });
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function closeBulkCheckin() {
    document.getElementById("bulkCheckinBar").hidden = true;
  }
  function bulkCheckAll() {
    const yesterday = yesterdayStr();
    state.habits.forEach((h) => {
      if (!state.completions[h.id]) state.completions[h.id] = {};
      state.completions[h.id][yesterday] = true;
    });
    saveData();
    // Update all checkboxes in the panel
    document.querySelectorAll("[data-bulk-habit]").forEach((cb) => {
      cb.checked = true;
      cb.closest("label")?.classList.add("bulk-checked");
    });
    updateStats();
    updateProgressChart();
    generateCalendar();
    generateAnalysis();
    generateProgressRings();
    generateReportCard();
    generateStrugglingBanner();
    checkBestMonthBanner();
    updatePrediction();
    checkAndAwardFreezes(); // Fix #5: award freezes if yesterday was perfect
    showToast("✅ All yesterday's habits checked!");
  }

  // ─────────────────────────────────────────
  // FEATURE 9: SHARE CARD
  // ─────────────────────────────────────────
  function updateShareCard() {
    const dim = daysInMonth(state.currentYear, state.currentMonth);
    let total = 0;
    state.habits.forEach((h) => {
      for (let d = 1; d <= dim; d++) {
        if (
          state.completions[h.id]?.[
            fmt(state.currentYear, state.currentMonth + 1, d)
          ]
        )
          total++;
      }
    });
    const possible = state.habits.length * dim;
    const pct = possible > 0 ? Math.round((total / possible) * 100) : 0;
    let maxStreak = 0;
    state.habits.forEach((h) => {
      maxStreak = Math.max(maxStreak, calcBestStreak(h.id));
    });
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("shareCardUser", currentUser ? `👤 ${currentUser.toUpperCase()}` : "");
    set(
      "shareCardMonth",
      `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`,
    );
    set("shareCardBig", `${pct}%`);
    set("shareCardStats", `${total} / ${possible} habits completed`);
    set(
      "shareCardStreak",
      maxStreak > 0 ? `🔥 Best Streak: ${maxStreak} days` : "",
    );
  }
  function downloadShareCard() {
    updateShareCard();
    const w = 320,
      h = 220,
      canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#1a237e");
    grad.addColorStop(1, "#283593");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w - 30, 30, 50, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.font = "bold 14px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.fillStyle = "#90caf9";
    ctx.fillText("Habit Tracker Pro", 16, 28);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(
      document.getElementById("shareCardUser")?.textContent || "",
      16,
      50,
    );
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#b3e5fc";
    ctx.fillText(
      document.getElementById("shareCardMonth")?.textContent || "",
      16,
      70,
    );
    ctx.font = "bold 56px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      document.getElementById("shareCardBig")?.textContent || "",
      16,
      135,
    );
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(
      document.getElementById("shareCardStats")?.textContent || "",
      16,
      158,
    );
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#ffcc02";
    ctx.fillText(
      document.getElementById("shareCardStreak")?.textContent || "",
      16,
      180,
    );
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("habit tracker pro", 16, 208);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `habit-${MONTH_NAMES[state.currentMonth]}-${state.currentYear}.png`;
    a.click();
    showToast("📥 Progress card downloaded!");
  }

  // ─────────────────────────────────────────
  // MODALS (emoji grid)
  // ─────────────────────────────────────────
  function generateEmojiGrid() {
    const grid = document.getElementById("emojiGrid");
    if (!grid) return;
    grid.innerHTML = "";
    EMOJIS.forEach((em) => {
      const div = document.createElement("div");
      div.className = `emoji-option${em === selectedEmoji ? " selected" : ""}`;
      div.textContent = em;
      div.dataset.emoji = em;
      grid.appendChild(div);
    });
  }

  function addHabit() {
    const input = document.getElementById("habitNameInput");
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = "var(--color-danger)";
      input.placeholder = "⚠️ Please enter a habit name";
      input.focus();
      setTimeout(() => {
        input.style.borderColor = "";
        input.placeholder = "e.g., Morning Exercise";
      }, 2000);
      return;
    }
    const newId = Math.max(0, ...state.habits.map((h) => h.id)) + 1;
    state.habits.push({
      id: newId,
      name,
      emoji: selectedEmoji,
      category: selectedCategory,
      board: selectedHabitBoard,
    });
    state.completions[newId] = {};
    // Record creation date for historical accuracy in % calculations
    if (!state.habitCreatedDates) state.habitCreatedDates = {};
    state.habitCreatedDates[newId] = todayStr();
    saveData();
    document.getElementById("habitModal").classList.remove("active");
    generateCalendar();
    updateStats();
    generateStreaksAndBadges();
    generateAnalysis();
    generateProgressRings();
    generateReportCard();
    generateStrugglingBanner();
    generateHeatmap();
    updateShareCard();
    updatePrediction();
  }

  // ─────────────────────────────────────────
  // BOARDS & CATEGORY FILTER
  // ─────────────────────────────────────────
  function syncBoardButtons() {
    document.querySelectorAll("[data-board]").forEach((b) => {
      if (b.closest("#boardSwitcher"))
        b.classList.toggle("active", b.dataset.board === state.activeBoard);
    });
  }
  function syncCategoryButtons() {
    document.querySelectorAll("[data-cat]").forEach((b) => {
      if (b.closest("#categoryFilter"))
        b.classList.toggle("active", b.dataset.cat === state.activeCategory);
    });
  }
  function syncCalendarViewButtons() {
    document
      .getElementById("monthViewCalBtn")
      ?.classList.toggle("active", state.calendarView === "month");
    document
      .getElementById("weekViewCalBtn")
      ?.classList.toggle("active", state.calendarView === "week");
    document
      .getElementById("todayViewCalBtn")
      ?.classList.toggle("active", state.calendarView === "today");
  }

  // ─────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────
  function init() {
    loadData();
    applyTheme();
    generateEmojiGrid();
    generateCalendar();
    updateStats();
    generateStreaksAndBadges();
    createCharts();
    generateAnalysis();
    updateFreezeBanner();
    checkAndAwardFreezes();
    generateHeatmap();
    generateProgressRings();
    generateReportCard();
    checkBestMonthBanner();
    generateDowAnalysis();
    updatePrediction();
    generateStrugglingBanner();
    updateShareCard();
    syncBoardButtons();
    syncCategoryButtons();
    syncCalendarViewButtons();
    applyCollapsibleState(); // Fix #12
    requestAnimationFrame(() => {
      scrollToYesterday();
      initDragAndDrop(); // Fix #18
    });
  }

  // Smoothly scrolls the calendar grid so yesterday's column is visible on load
  function scrollToYesterday() {
    const yd = yesterdayStr();
    const calGrid = document.querySelector(".calendar-grid");
    if (!calGrid) return;
    // Find the first checkbox for yesterday
    const cell = calGrid.querySelector(`[data-date="${yd}"]`);
    if (!cell) return;
    const td = cell.closest("td");
    if (!td) return;
    // Scroll the overflow container so yesterday's column is roughly centered
    const containerRect = calGrid.getBoundingClientRect();
    const cellRect = td.getBoundingClientRect();
    const scrollLeft =
      calGrid.scrollLeft +
      (cellRect.left - containerRect.left) -
      containerRect.width / 2 +
      cellRect.width / 2;
    calGrid.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
  }

  // ─────────────────────────────────────────
  // EVENT BINDING — all addEventListener, zero inline handlers
  // ─────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // Auth
    document
      .getElementById("loginForm")
      .addEventListener("submit", handleLogin);
    document
      .getElementById("logoutBtn")
      .addEventListener("click", handleLogout);
    document
      .getElementById("themeToggleBtn")
      .addEventListener("click", toggleTheme);

    // Calendar nav
    document
      .getElementById("prevBtn")
      .addEventListener("click", () => changeMonth(-1));
    document
      .getElementById("nextBtn")
      .addEventListener("click", () => changeMonth(1));

    // Calendar view toggle
    document.getElementById("monthViewCalBtn").addEventListener("click", () => {
      state.calendarView = "month";
      saveData();
      syncCalendarViewButtons();
      generateCalendar();
      initDragAndDrop(); // Fix #18
    });
    document.getElementById("weekViewCalBtn").addEventListener("click", () => {
      state.calendarView = "week";
      if (!state.currentWeekStart)
        state.currentWeekStart = weekStart(new Date()); // Fix #13: already returns local date string
      saveData();
      syncCalendarViewButtons();
      generateCalendar();
      initDragAndDrop(); // Fix #18
    });

    // Fix #15: Today view button
    document.getElementById("todayViewCalBtn").addEventListener("click", () => {
      state.calendarView = "today";
      saveData();
      syncCalendarViewButtons();
      generateCalendar();
    });

    // Board switcher (delegated)
    document.getElementById("boardSwitcher").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-board]");
      if (!btn) return;
      state.activeBoard = btn.dataset.board;
      saveData();
      syncBoardButtons();
      generateCalendar();
      initDragAndDrop(); // Fix #18
      updateStats();
      generateAnalysis();
      generateProgressRings();
      generateReportCard();
      generateStrugglingBanner();
      generateDowAnalysis();
      updatePrediction();
      refreshCharts();
    });

    // Category filter (delegated)
    document.getElementById("categoryFilter").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      state.activeCategory = btn.dataset.cat;
      saveData();
      syncCategoryButtons();
      generateCalendar();
      initDragAndDrop(); // Fix #18
      generateAnalysis();
      updateStats();
      generateProgressRings();
      generateReportCard();
    });

    // Log yesterday
    document
      .getElementById("openBulkBtn")
      ?.addEventListener("click", openBulkCheckin);
    document
      .getElementById("bulkCloseBtn")
      .addEventListener("click", closeBulkCheckin);
    document
      .getElementById("bulkDoneBtn")
      .addEventListener("click", closeBulkCheckin);
    document
      .getElementById("bulkAllBtn")
      .addEventListener("click", bulkCheckAll);

    // Bulk checkboxes (delegated)
    document
      .getElementById("bulkCheckinHabits")
      .addEventListener("change", (e) => {
        const cb = e.target.closest("[data-bulk-habit]");
        if (!cb) return;
        const id = parseInt(cb.dataset.bulkHabit),
          ds = cb.dataset.bulkDate;
        if (!state.completions[id]) state.completions[id] = {};
        state.completions[id][ds] = cb.checked;
        cb.closest("label")?.classList.toggle("bulk-checked", cb.checked);
        saveData();
        updateStats();
        updateProgressChart();
        generateAnalysis();
        generateProgressRings();
        generateReportCard();
      });

    // Calendar table — checkbox toggle + note button + meatball + inline edit (delegated)
    document.getElementById("calendarTable").addEventListener("click", (e) => {
      const cb = e.target.closest("[data-toggle]");
      if (cb) {
        toggleHabit(parseInt(cb.dataset.toggle), cb.dataset.date, cb);
        return;
      }
      const noteBtn = e.target.closest("[data-open-note]");
      if (noteBtn) {
        openDayNotesModal(noteBtn.dataset.openNote, noteBtn.dataset.noteLabel);
        return;
      }
      // Fix #16: Meatball menu
      const meatball = e.target.closest("[data-meatball]");
      if (meatball) {
        e.stopPropagation();
        openMeatballMenu(parseInt(meatball.dataset.meatball), meatball);
        return;
      }
    });

    // Fix #17: Inline edit on double-click of habit name label
    document
      .getElementById("calendarTable")
      .addEventListener("dblclick", (e) => {
        const label = e.target.closest("[data-inline-edit]");
        if (label) startInlineEdit(parseInt(label.dataset.inlineEdit));
      });

    // Mental state grids (delegated)
    document.getElementById("moodGrid").addEventListener("click", (e) => {
      const cell = e.target.closest("[data-open-mood]");
      if (cell) openMoodPicker(cell.dataset.openMood, cell);
    });
    document.getElementById("motivationGrid").addEventListener("click", (e) => {
      const cell = e.target.closest("[data-open-mot]");
      if (cell)
        openMotivationPicker(
          cell.dataset.openMot,
          parseInt(cell.dataset.motDay),
        );
    });

    // Analysis sidebar — trash buttons (delegated)
    document
      .getElementById("analysisContainer")
      .addEventListener("click", (e) => {
        const btn = e.target.closest("[data-remove-habit]");
        if (btn) removeHabit(parseInt(btn.dataset.removeHabit));
      });

    // Add Habit FAB
    document.getElementById("addHabitFab").addEventListener("click", () => {
      document.getElementById("habitNameInput").value = "";
      selectedEmoji = "⏰";
      selectedCategory = "health";
      selectedHabitBoard = "all";
      generateEmojiGrid();
      // Sync category picker visuals
      document
        .querySelectorAll("#categoryPicker [data-cat]")
        .forEach((el) =>
          el.classList.toggle("selected", el.dataset.cat === selectedCategory),
        );
      // Sync board picker visuals
      document
        .querySelectorAll("#boardPicker [data-board]")
        .forEach((el) =>
          el.classList.toggle(
            "selected",
            el.dataset.board === selectedHabitBoard,
          ),
        );
      document.getElementById("habitModal").classList.add("active");
    });

    // Empty state CTA — same as FAB
    document.getElementById("emptyStateCta")?.addEventListener("click", () => {
      document.getElementById("habitNameInput").value = "";
      selectedEmoji = "⏰";
      selectedCategory = "health";
      selectedHabitBoard = "all";
      generateEmojiGrid();
      document
        .querySelectorAll("#categoryPicker [data-cat]")
        .forEach((el) =>
          el.classList.toggle("selected", el.dataset.cat === selectedCategory),
        );
      document
        .querySelectorAll("#boardPicker [data-board]")
        .forEach((el) =>
          el.classList.toggle(
            "selected",
            el.dataset.board === selectedHabitBoard,
          ),
        );
      document.getElementById("habitModal").classList.add("active");
    });

    // Collapsible sidebar sections (Fix #12: persist state)
    document.querySelectorAll(".collapsible-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const targetId = trigger.dataset.target;
        const body = document.getElementById(targetId);
        if (!body) return;
        const isCollapsed = body.classList.toggle("collapsed");
        trigger.classList.toggle("collapsed", isCollapsed);
        saveCollapsibleState(targetId, isCollapsed); // Fix #12
      });
    });
    document
      .getElementById("cancelAddHabitBtn")
      .addEventListener("click", () => {
        document.getElementById("habitModal").classList.remove("active");
      });
    document
      .getElementById("confirmAddHabitBtn")
      .addEventListener("click", addHabit);

    // Emoji grid (delegated)
    document.getElementById("emojiGrid").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-emoji]");
      if (!opt) return;
      selectedEmoji = opt.dataset.emoji;
      document
        .querySelectorAll(".emoji-option")
        .forEach((el) =>
          el.classList.toggle("selected", el.dataset.emoji === selectedEmoji),
        );
    });

    // Category picker in modal (delegated)
    document.getElementById("categoryPicker").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-cat]");
      if (!opt) return;
      selectedCategory = opt.dataset.cat;
      document
        .querySelectorAll("#categoryPicker [data-cat]")
        .forEach((el) =>
          el.classList.toggle("selected", el.dataset.cat === selectedCategory),
        );
    });

    // Board picker in modal (delegated)
    document.getElementById("boardPicker").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-board]");
      if (!opt) return;
      selectedHabitBoard = opt.dataset.board;
      document
        .querySelectorAll("#boardPicker [data-board]")
        .forEach((el) =>
          el.classList.toggle(
            "selected",
            el.dataset.board === selectedHabitBoard,
          ),
        );
    });

    // Day notes modal
    document
      .getElementById("saveNoteBtn")
      .addEventListener("click", saveDayNote);
    document
      .getElementById("cancelNoteBtn")
      .addEventListener("click", closeDayNotesModal);

    // Freeze
    document
      .getElementById("useFreezeBtn")
      .addEventListener("click", useStreakFreeze);

    // Share card download
    document
      .getElementById("downloadCardBtn")
      .addEventListener("click", downloadShareCard);

    // Close modals on backdrop click
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
    });

    // Fix #16: Modal focus trap — keep Tab key inside open modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".modal.active")
          .forEach((m) => m.classList.remove("active"));
        const motPop = document.getElementById("motivationPopover");
        if (motPop) motPop.remove();
        const moodPop = document.getElementById("moodPickerPopover");
        if (moodPop) moodPop.hidden = true;
      }
      if (e.key !== "Tab") return;
      const activeModal = document.querySelector(".modal.active");
      if (!activeModal) return;
      const focusable = Array.from(
        activeModal.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    });

    // Analytics footer progressive disclosure (Fix #11)
    document
      .getElementById("analyticsToggleBtn")
      ?.addEventListener("click", () => {
        const body = document.getElementById("analyticsBody");
        const btn = document.getElementById("analyticsToggleBtn");
        if (!body || !btn) return;
        const isCollapsed = body.classList.toggle("collapsed");
        btn.textContent = isCollapsed ? "Show ▾" : "Hide ▴";
        btn.setAttribute("aria-expanded", String(!isCollapsed));
        // Lazy-render analytics only when first opened
        if (!isCollapsed && !body.dataset.rendered) {
          body.dataset.rendered = "1";
          generateHeatmap();
          generateProgressRings();
          generateReportCard();
          generateDowAnalysis();
          generateMentalStateGrids();
          createMentalChart();
        }
      });

    // Boot
    checkAuthStatus();
  });
})(); // end IIFE
