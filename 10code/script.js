// ============================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================

const testUsers = {
  user1: "1234",
  user2: "1234",
  user3: "1234",
};

let currentUser = null;

function checkAuthStatus() {
  const loggedInUser = sessionStorage.getItem("currentUser");
  if (loggedInUser) {
    currentUser = loggedInUser;
    showAppUI();
    loadData();
    init();
  } else {
    showLoginUI();
  }
}

function showLoginUI() {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");
  loginContainer.classList.remove("hidden");
  loginContainer.style.display = "";
  appContainer.classList.add("hidden");
  appContainer.style.display = "none";
}

function showAppUI() {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");
  if (loginContainer) {
    loginContainer.classList.add("hidden");
    loginContainer.style.display = "none";
    updateUserGreeting();
  }
  if (appContainer) {
    appContainer.classList.remove("hidden");
    appContainer.style.display = "";
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorDiv = document.getElementById("loginError");

  if (testUsers[username] && testUsers[username] === password) {
    sessionStorage.setItem("currentUser", username);
    currentUser = username;
    errorDiv.style.display = "none";
    document.getElementById("loginForm").reset();
    showAppUI();
    loadData();
    init();
  } else {
    errorDiv.textContent = "❌ Invalid username or password. Try user1/1234";
    errorDiv.style.display = "block";
  }
}

function updateUserGreeting() {
  const titleEl = document.getElementById("appTitle");
  if (!titleEl) return;
  // FIX: Never inject user-controlled data via innerHTML — use textContent to prevent XSS.
  titleEl.textContent = "";
  const titleText = document.createTextNode("Habit Tracker Pro ");
  titleEl.appendChild(titleText);
  if (currentUser) {
    const badge = document.createElement("span");
    badge.style.cssText =
      "color:var(--color-success);font-size:0.85em;font-weight:600;";
    // .textContent safely escapes any characters in the username — no script injection possible.
    badge.textContent = `👋 ${currentUser.toUpperCase()}`;
    titleEl.appendChild(badge);
  }
}

function handleLogout() {
  const confirmed = confirm("Are you sure you want to logout?");
  if (confirmed) {
    sessionStorage.removeItem("currentUser");
    currentUser = null;
    showLoginUI();
    document.getElementById("loginForm").reset();
    document.getElementById("loginError").style.display = "none";
  }
}

// ============================================
// DATA STRUCTURE
// ============================================

let habitData = {
  habits: [
    { id: 1, name: "Wake up at 05:00", emoji: "⏰", category: "mindset" },
    { id: 2, name: "Gym", emoji: "💪", category: "health" },
    { id: 3, name: "Reading / Learning", emoji: "📚", category: "learning" },
    { id: 4, name: "Day Planning", emoji: "📝", category: "mindset" },
    { id: 5, name: "Budget Tracking", emoji: "💰", category: "finance" },
    { id: 6, name: "Project Work", emoji: "🎯", category: "learning" },
    { id: 7, name: "No Alcohol", emoji: "🚫", category: "health" },
    { id: 8, name: "Social Media Detox", emoji: "🌿", category: "mindset" },
    { id: 9, name: "Goal Journaling", emoji: "📓", category: "mindset" },
    { id: 10, name: "Cold Shower", emoji: "🚿", category: "health" },
  ],
  completions: {},
  mentalState: {
    mood: {},
    motivation: {},
  },
  dayNotes: {}, // NEW: { "2025-11-01": "note text" }
  streakFreezes: 0, // NEW: available freezes
  freezeUsedDates: [], // NEW: dates protected by a freeze
  perfectDayStreak: 0, // NEW: consecutive fully-completed days
  lastPerfectDay: null, // NEW: last date all habits were done
  currentMonth: 10,
  currentYear: 2025,
  mentalStateView: "month",
  calendarView: "month",
  theme: "light",
  currentWeekStart: null,
  activeCategory: "all", // NEW: filter
};

const categoryColors = {
  health: { bg: "#e3f2fd", accent: "#1976d2", label: "🔵 Health" },
  finance: { bg: "#fffde7", accent: "#f9a825", label: "🟡 Finance" },
  learning: { bg: "#e8f5e9", accent: "#388e3c", label: "🟢 Learning" },
  mindset: { bg: "#f3e5f5", accent: "#7b1fa2", label: "🟣 Mindset" },
  other: { bg: "#f5f5f5", accent: "#757575", label: "⚪ Other" },
};

const emojis = [
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

const badges = [
  {
    id: "first_day",
    name: "First Step",
    icon: "👣",
    requirement: 1,
    desc: "Complete 1 day",
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    icon: "⚔️",
    requirement: 7,
    desc: "7 day streak",
  },
  {
    id: "month_master",
    name: "Month Master",
    icon: "👑",
    requirement: 30,
    desc: "30 day streak",
  },
  {
    id: "perfect_week",
    name: "Perfect Week",
    icon: "✨",
    requirement: 7,
    desc: "100% for 7 days",
  },
  {
    id: "century",
    name: "Centurion",
    icon: "💯",
    requirement: 100,
    desc: "100 completions",
  },
  {
    id: "dedication",
    name: "Dedicated",
    icon: "🔥",
    requirement: 50,
    desc: "50 day streak",
  },
  {
    id: "freeze_pro",
    name: "Ice Cold",
    icon: "🧊",
    requirement: 1,
    desc: "Use a streak freeze",
  },
];

let selectedEmoji = "⏰";
let selectedCategory = "health";
let progressChart, mentalChart;
let isInitializing = false;
let currentNotesDate = null;

// FIX: One shared AudioContext for the lifetime of the page.
// Browsers cap active AudioContexts at ~6. Creating a new one per celebration
// would hit that limit quickly and silently break the sound effect.
let sharedAudioContext = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) sharedAudioContext = new AC();
  }
  return sharedAudioContext;
}

// ============================================
// INIT
// ============================================

function init() {
  if (isInitializing) return;
  isInitializing = true;
  try {
    loadData();
    applyTheme();
    generateEmojiGrid();
    generateCalendar();
    updateStats();
    generateStreaksAndBadges();
    createCharts();
    generateAnalysis();
    updateToggleButtons();
    updateFreezeBanner();
    checkAndAwardFreezes();
  } finally {
    isInitializing = false;
  }
}

// ============================================
// LOCAL STORAGE
// ============================================

function saveData() {
  const key = `user_${currentUser}_habitTrackerData`;
  localStorage.setItem(key, JSON.stringify(habitData));
}

function loadData() {
  const key = `user_${currentUser}_habitTrackerData`;
  const saved = localStorage.getItem(key);
  if (saved) {
    habitData = JSON.parse(saved);
    if (!habitData.mentalStateView) habitData.mentalStateView = "month";
    if (!habitData.calendarView) habitData.calendarView = "month";
    if (!habitData.theme) habitData.theme = "light";
    if (!habitData.dayNotes) habitData.dayNotes = {};
    if (habitData.streakFreezes == null) habitData.streakFreezes = 0;
    if (!habitData.freezeUsedDates) habitData.freezeUsedDates = [];
    if (!habitData.activeCategory) habitData.activeCategory = "all";
    if (habitData.perfectDaysCount == null) habitData.perfectDaysCount = 0;
    if (!habitData._lastPerfectDayRecorded)
      habitData._lastPerfectDayRecorded = null;
    // Ensure all habits have a category
    habitData.habits.forEach((h) => {
      if (!h.category) h.category = "other";
    });
  } else {
    generateSampleData();
  }
}

function generateSampleData() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  habitData.habits.forEach((habit) => {
    habitData.completions[habit.id] = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(
        habitData.currentYear,
        habitData.currentMonth + 1,
        day,
      );
      if (Math.random() > 0.3) habitData.completions[habit.id][dateStr] = true;
    }
  });
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDate(
      habitData.currentYear,
      habitData.currentMonth + 1,
      day,
    );
    habitData.mentalState.mood[dateStr] = Math.floor(Math.random() * 4) + 6;
    habitData.mentalState.motivation[dateStr] =
      Math.floor(Math.random() * 4) + 5;
  }
  saveData();
}

// ============================================
// HELPERS
// ============================================

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayStr() {
  const t = new Date();
  return formatDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

// ============================================
// THEME
// ============================================

function toggleTheme() {
  habitData.theme = habitData.theme === "light" ? "dark" : "light";
  saveData();
  applyTheme();
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", habitData.theme);
  const themeIcon = document.querySelector(".theme-icon");
  if (themeIcon)
    themeIcon.textContent = habitData.theme === "light" ? "🌙" : "☀️";
}

// ============================================
// CALENDAR VIEW
// ============================================

function setCalendarView(view) {
  habitData.calendarView = view;
  if (view === "week" && !habitData.currentWeekStart) {
    habitData.currentWeekStart = getWeekStart(new Date());
  }
  saveData();
  updateCalendarViewButtons();
  generateCalendar();
}

function updateCalendarViewButtons() {
  document
    .getElementById("monthViewCalBtn")
    .classList.toggle("active", habitData.calendarView === "month");
  document
    .getElementById("weekViewCalBtn")
    .classList.toggle("active", habitData.calendarView === "week");
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function setMentalStateView(view) {
  habitData.mentalStateView = view;
  saveData();
  updateToggleButtons();
  generateMentalStateGrids();
}

function updateToggleButtons() {
  const monthBtn = document.getElementById("monthViewBtn");
  const dayBtn = document.getElementById("dayViewBtn");
  if (monthBtn)
    monthBtn.classList.toggle("active", habitData.mentalStateView === "month");
  if (dayBtn)
    dayBtn.classList.toggle("active", habitData.mentalStateView === "day");
  updateCalendarViewButtons();
}

// ============================================
// FEATURE 1: STREAK FREEZES
// ============================================

function checkAndAwardFreezes() {
  // FIX: The old 60-day rolling window + lifetime counter math was broken — once
  // perfect days aged out of the window, the counter could never grow again.
  // New approach: habitData.perfectDaysCount is a persistent accumulator.
  // Every time a day becomes "perfect" (all habits done) we increment it once.
  // When it hits 14, award 1 freeze and reset the counter to 0.
  // This runs after each habit toggle for today only, to avoid re-scanning history.
  const today = todayStr();
  if (habitData.habits.length === 0) return;

  const todayAllDone = habitData.habits.every(
    (h) => habitData.completions[h.id]?.[today],
  );

  // Only award if today is newly perfect (not already recorded)
  if (todayAllDone && habitData._lastPerfectDayRecorded !== today) {
    habitData._lastPerfectDayRecorded = today;
    habitData.perfectDaysCount = (habitData.perfectDaysCount || 0) + 1;

    if (habitData.perfectDaysCount >= 14) {
      habitData.streakFreezes = (habitData.streakFreezes || 0) + 1;
      habitData.perfectDaysCount = 0;
      showToast("🧊 Streak freeze earned! 14 perfect days tracked.");
    }
    saveData();
  }
  updateFreezeBanner();
}

function updateFreezeBanner() {
  const banner = document.getElementById("freezeBanner");
  const countEl = document.getElementById("freezeCount");
  const statEl = document.getElementById("streakFreezes");
  if (banner) {
    banner.style.display = habitData.streakFreezes > 0 ? "flex" : "none";
    if (countEl) countEl.textContent = habitData.streakFreezes;
  }
  if (statEl) statEl.textContent = habitData.streakFreezes;
}

function useStreakFreeze() {
  if (habitData.streakFreezes <= 0) {
    alert(
      "❌ No streak freezes available! Earn one by completing all habits for 14 days straight.",
    );
    return;
  }
  const today = todayStr();
  if (habitData.freezeUsedDates.includes(today)) {
    alert("✅ You've already used a freeze for today.");
    return;
  }
  if (
    confirm(
      "🧊 Use a streak freeze for today? This will protect your streaks from resetting.",
    )
  ) {
    habitData.streakFreezes--;
    habitData.freezeUsedDates.push(today);
    saveData();
    updateFreezeBanner();
    generateStreaksAndBadges();
    generateCalendar();
    showToast("🧊 Streak freeze applied! Your streaks are safe today.");
  }
}

// ============================================
// FEATURE 2: CELEBRATORY MICRO-INTERACTIONS
// ============================================

function triggerConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  if (!canvas) return;
  canvas.style.display = "block";
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4,
    d: Math.random() * 3 + 1,
    color: `hsl(${Math.random() * 360}, 90%, 60%)`,
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltAngleDelta: Math.random() * 0.1 + 0.05,
  }));

  let frame = 0;
  const maxFrames = 120;

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
    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
    }
  }
  draw();

  // Neon glow on progress bar
  const bar = document.getElementById("progressBar");
  if (bar) {
    bar.classList.add("neon-glow");
    setTimeout(() => bar.classList.remove("neon-glow"), 2000);
  }

  // Level-up sound using the shared Web Audio context
  try {
    const ac = getAudioContext();
    if (ac) {
      // Resume in case the browser suspended it (autoplay policy)
      ac.resume().then(() => {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
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
      });
    }
  } catch (e) {}
}

function showToast(msg) {
  let toast = document.getElementById("habitToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "habitToast";
    toast.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
      background:var(--color-success); color:white; padding:12px 24px;
      border-radius:30px; font-size:14px; font-weight:600; z-index:99999;
      box-shadow:0 4px 20px rgba(0,0,0,0.2); transition:opacity 0.4s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2500);
}

function checkDayComplete(dateStr) {
  if (habitData.habits.length === 0) return false;
  return habitData.habits
    .filter(
      (h) =>
        habitData.activeCategory === "all" ||
        h.category === habitData.activeCategory,
    )
    .every((h) => habitData.completions[h.id]?.[dateStr]);
}

// ============================================
// FEATURE 3: DAILY NOTES / FRICTION LOGS
// ============================================

function openDayNotesModal(dateStr, dayLabel) {
  currentNotesDate = dateStr;
  document.getElementById("dayNotesTitle").textContent =
    `📝 Notes for ${dayLabel}`;
  document.getElementById("dayNotesInput").value =
    habitData.dayNotes[dateStr] || "";
  document.getElementById("dayNotesSavedMsg").style.display = "none";
  document.getElementById("dayNotesModal").classList.add("active");
}

function closeDayNotesModal() {
  document.getElementById("dayNotesModal").classList.remove("active");
  currentNotesDate = null;
}

function saveDayNote() {
  if (!currentNotesDate) return;
  const text = document.getElementById("dayNotesInput").value.trim();
  habitData.dayNotes[currentNotesDate] = text;
  saveData();
  document.getElementById("dayNotesSavedMsg").style.display = "block";
  setTimeout(closeDayNotesModal, 900);
}

// ============================================
// FEATURE 4: HABIT CATEGORIZATION (TAGS)
// ============================================

function selectCategory(cat) {
  selectedCategory = cat;
  document.querySelectorAll("#categoryPicker .cat-option").forEach((el) => {
    el.classList.toggle("selected", el.dataset.cat === cat);
  });
}

function filterByCategory(cat) {
  habitData.activeCategory = cat;
  saveData();
  document.querySelectorAll(".cat-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === cat);
  });
  generateCalendar();
  generateAnalysis();
  updateStats();
}

function getCategoryColor(category) {
  return categoryColors[category] || categoryColors["other"];
}

// ============================================
// STREAK CALCULATIONS
// ============================================

function calculateStreak(habitId) {
  const today = new Date();
  let streak = 0;
  let currentDate = new Date(today);

  while (true) {
    const ds = formatDate(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      currentDate.getDate(),
    );
    if (
      habitData.completions[habitId]?.[ds] ||
      habitData.freezeUsedDates.includes(ds)
    ) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function calculateBestStreak(habitId) {
  const completionDates = Object.keys(habitData.completions[habitId] || {})
    .filter((date) => habitData.completions[habitId][date])
    .sort();

  let maxStreak = 0,
    currentStreak = 0;
  let prevDate = null;

  completionDates.forEach((dateStr) => {
    const currentDate = new Date(dateStr);
    if (prevDate) {
      const dayDiff = Math.floor(
        (currentDate - prevDate) / (1000 * 60 * 60 * 24),
      );
      currentStreak = dayDiff === 1 ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    prevDate = currentDate;
  });
  return maxStreak;
}

// ============================================
// STREAKS & BADGES
// ============================================

function generateStreaksAndBadges() {
  let streaksHtml = '<div class="section-title">🔥 Current Streaks</div>';
  let maxStreak = 0;
  let anyStreak = false;

  habitData.habits.forEach((habit) => {
    const streak = calculateStreak(habit.id);
    if (streak > 0) {
      anyStreak = true;
      const cat = getCategoryColor(habit.category || "other");
      streaksHtml += `
        <div class="streak-item">
          <span class="streak-name" style="border-left:3px solid ${cat.accent}; padding-left:6px;">
            ${habit.emoji} ${habit.name}
          </span>
          <span class="streak-count">${streak} ${streak === 1 ? "day" : "days"} <span class="streak-fire">🔥</span></span>
        </div>`;
      maxStreak = Math.max(maxStreak, calculateBestStreak(habit.id));
    }
  });

  if (!anyStreak) {
    streaksHtml +=
      '<div style="text-align:center;color:var(--color-text-secondary);padding:20px;">Start completing habits to build streaks!</div>';
  }

  document.getElementById("streaksContainer").innerHTML = streaksHtml;
  document.getElementById("bestStreak").textContent = maxStreak + " days";

  const earnedBadges = getEarnedBadges();
  let badgesHtml =
    '<div class="section-title">🏆 Achievements</div><div class="badges-grid">';
  badges.forEach((badge) => {
    const earned = earnedBadges.includes(badge.id);
    badgesHtml += `
      <div class="badge ${earned ? "earned" : ""}" title="${badge.desc}">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-name">${badge.name}</div>
      </div>`;
  });
  badgesHtml += "</div>";
  document.getElementById("badgesContainer").innerHTML = badgesHtml;
}

function getTotalCompletions() {
  let total = 0;
  habitData.habits.forEach((habit) => {
    Object.values(habitData.completions[habit.id] || {}).forEach((v) => {
      if (v) total++;
    });
  });
  return total;
}

function getEarnedBadges() {
  const earned = [];
  const totalCompletions = getTotalCompletions();

  habitData.habits.forEach((habit) => {
    const streak = calculateBestStreak(habit.id);
    if (totalCompletions >= 1 && !earned.includes("first_day"))
      earned.push("first_day");
    if (streak >= 7 && !earned.includes("week_warrior"))
      earned.push("week_warrior");
    if (streak >= 30 && !earned.includes("month_master"))
      earned.push("month_master");
    if (streak >= 50 && !earned.includes("dedication"))
      earned.push("dedication");
    if (totalCompletions >= 100 && !earned.includes("century"))
      earned.push("century");
  });

  // Perfect week
  const today = new Date();
  let perfectWeek = habitData.habits.length > 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    if (!habitData.habits.every((h) => habitData.completions[h.id]?.[ds])) {
      perfectWeek = false;
      break;
    }
  }
  if (perfectWeek) earned.push("perfect_week");

  // Freeze badge
  if ((habitData.freezeUsedDates || []).length > 0) earned.push("freeze_pro");

  return earned;
}

// ============================================
// CALENDAR GENERATION
// ============================================

function generateCalendar() {
  if (habitData.calendarView === "week") {
    generateWeekView();
  } else {
    generateMonthView();
  }
}

function getVisibleHabits() {
  if (habitData.activeCategory === "all") return habitData.habits;
  return habitData.habits.filter(
    (h) => h.category === habitData.activeCategory,
  );
}

function generateWeekView() {
  const weekStart = habitData.currentWeekStart
    ? new Date(habitData.currentWeekStart)
    : getWeekStart(new Date());
  const monthNames = [
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
  document.getElementById("monthTitle").textContent =
    `Week of ${monthNames[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()}`;

  const dayNames = [
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
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const ds = formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hasNote = habitData.dayNotes[ds];
    html += `<th>${dayNames[i]}<br>${d.getDate()}
      <span class="note-dot-btn" onclick="openDayNotesModal('${ds}','${dayNames[i]} ${d.getDate()}')" title="${hasNote ? "Has note" : "Add note"}">
        ${hasNote ? "📝" : "＋"}
      </span>
    </th>`;
  }
  html += "</tr></thead><tbody>";

  const visibleHabits = getVisibleHabits();
  visibleHabits.forEach((habit) => {
    const cat = getCategoryColor(habit.category || "other");
    html += `<tr><td class="habit-name" style="border-left:3px solid ${cat.accent}">${habit.name} ${habit.emoji}</td>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const ds = formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const isChecked = habitData.completions[habit.id]?.[ds] || false;
      const isFrozen = habitData.freezeUsedDates?.includes(ds);
      html += `<td><div class="checkbox ${isChecked ? "checked" : ""} ${isFrozen ? "frozen" : ""}"
        onclick="toggleHabit(${habit.id}, '${ds}')"></div></td>`;
    }
    html += "</tr>";
  });
  html += "</tbody>";
  document.getElementById("calendarTable").innerHTML = html;
  generateMentalStateGrids();
}

function generateMonthView() {
  const monthNames = [
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
  document.getElementById("monthTitle").textContent =
    `${monthNames[habitData.currentMonth]} ${habitData.currentYear}`;

  const firstDay = new Date(
    habitData.currentYear,
    habitData.currentMonth,
    1,
  ).getDay();
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  const weeks = Math.ceil((firstDay + daysInMonth) / 7);
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  let html = "<thead><tr><th>My Habits</th>";
  for (let w = 1; w <= weeks; w++) html += `<th colspan="7">Week ${w}</th>`;
  html += "</tr><tr><th></th>";
  for (let w = 0; w < weeks; w++)
    dayNames.forEach((d) => {
      html += `<th>${d}</th>`;
    });
  html += "</tr>";

  // Day numbers row with note buttons
  html += '<tr class="day-numbers-row"><th>Day</th>';
  let dayCounter = 1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      if ((w === 0 && d < firstDay) || dayCounter > daysInMonth) {
        html += "<th></th>";
      } else {
        const ds = formatDate(
          habitData.currentYear,
          habitData.currentMonth + 1,
          dayCounter,
        );
        const hasNote = habitData.dayNotes[ds];
        const isFrozen = habitData.freezeUsedDates?.includes(ds);
        html += `<th class="day-number-cell ${isFrozen ? "frozen-day" : ""}">
          ${dayCounter}
          <span class="note-dot-btn" onclick="openDayNotesModal('${ds}','${monthNames[habitData.currentMonth]} ${dayCounter}')" title="${hasNote ? "Has note" : "Add note"}">
            ${hasNote ? "📝" : ""}
          </span>
          ${isFrozen ? '<span title="Streak Freeze Used">🧊</span>' : ""}
        </th>`;
        dayCounter++;
      }
    }
  }
  html += "</tr></thead><tbody>";

  const visibleHabits = getVisibleHabits();
  visibleHabits.forEach((habit) => {
    const cat = getCategoryColor(habit.category || "other");
    html += `<tr><td class="habit-name" style="border-left:3px solid ${cat.accent}">${habit.name} ${habit.emoji}</td>`;
    dayCounter = 1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDay) || dayCounter > daysInMonth) {
          html += "<td></td>";
        } else {
          const ds = formatDate(
            habitData.currentYear,
            habitData.currentMonth + 1,
            dayCounter,
          );
          const isChecked = habitData.completions[habit.id]?.[ds] || false;
          const isFrozen = habitData.freezeUsedDates?.includes(ds);
          html += `<td><div class="checkbox ${isChecked ? "checked" : ""} ${isFrozen ? "frozen" : ""}"
            onclick="toggleHabit(${habit.id}, '${ds}')"></div></td>`;
          dayCounter++;
        }
      }
    }
    html += "</tr>";
  });

  // Summary rows
  const summaryRows = [
    { label: "Progress", fn: (ds) => calculateDayProgress(ds) + "%" },
    { label: "Done", fn: (ds) => calculateDayDone(ds) },
    {
      label: "Not Done",
      fn: (ds) => habitData.habits.length - calculateDayDone(ds),
    },
  ];
  summaryRows.forEach((row) => {
    html += `<tr class="summary-row"><td>${row.label}</td>`;
    dayCounter = 1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDay) || dayCounter > daysInMonth) {
          html += "<td></td>";
        } else {
          const ds = formatDate(
            habitData.currentYear,
            habitData.currentMonth + 1,
            dayCounter,
          );
          html += `<td>${row.fn(ds)}</td>`;
          dayCounter++;
        }
      }
    }
    html += "</tr>";
  });

  html += "</tbody>";
  document.getElementById("calendarTable").innerHTML = html;
  generateMentalStateGrids();
}

function generateMentalStateGrids() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  let dayHtml = '<div class="mental-label">Day</div>';
  let moodHtml = '<div class="mental-label">Mood</div>';
  let motivationHtml = '<div class="mental-label">Motivation</div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const ds = formatDate(
      habitData.currentYear,
      habitData.currentMonth + 1,
      day,
    );
    const mood = habitData.mentalState.mood[ds] || "-";
    const motivation = habitData.mentalState.motivation[ds] || "-";
    dayHtml += `<div class="day-number">${day}</div>`;
    moodHtml += `<div class="mental-value" onclick="setMentalState('mood','${ds}',${day})">${mood}</div>`;
    motivationHtml += `<div class="mental-value" onclick="setMentalState('motivation','${ds}',${day})">${motivation}</div>`;
  }

  document.getElementById("dayNumberGrid").innerHTML = dayHtml;
  document.getElementById("moodGrid").innerHTML = moodHtml;
  document.getElementById("motivationGrid").innerHTML = motivationHtml;
}

function setMentalState(type, dateStr, dayNum) {
  const value = prompt(`Enter ${type} rating for Day ${dayNum} (1-10):`);
  if (value === null || value === "") return;
  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue < 1 || numValue > 10) {
    alert("❌ Please enter a number between 1 and 10");
    return;
  }
  habitData.mentalState[type][dateStr] = numValue;
  saveData();
  generateMentalStateGrids();
  updateMentalChart();
}

function calculateDayProgress(dateStr) {
  const habits = getVisibleHabits();
  if (!habits.length) return 0;
  let completed = habits.filter(
    (h) => habitData.completions[h.id]?.[dateStr],
  ).length;
  return Math.round((completed / habits.length) * 100);
}

function calculateDayDone(dateStr) {
  return habitData.habits.filter((h) => habitData.completions[h.id]?.[dateStr])
    .length;
}

// ============================================
// TOGGLE HABIT + MICRO-INTERACTION CHECK
// ============================================

function toggleHabit(habitId, dateStr) {
  if (!habitData.completions[habitId]) habitData.completions[habitId] = {};
  habitData.completions[habitId][dateStr] =
    !habitData.completions[habitId][dateStr];
  saveData();

  // Check if all habits done for the day → celebrate!
  const allDone = habitData.habits.every(
    (h) => habitData.completions[h.id]?.[dateStr],
  );
  if (allDone && habitData.habits.length > 0 && dateStr === todayStr()) {
    triggerConfetti();
    showToast("🎉 All habits complete for today! Amazing work!");
    checkAndAwardFreezes();
  }

  generateCalendar();
  updateStats();
  generateStreaksAndBadges();
  updateProgressChart();
  generateAnalysis();
}

function updateStats() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  let totalCompletions = 0;
  const totalPossible = habitData.habits.length * daysInMonth;

  habitData.habits.forEach((habit) => {
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = formatDate(
        habitData.currentYear,
        habitData.currentMonth + 1,
        day,
      );
      if (habitData.completions[habit.id]?.[ds]) totalCompletions++;
    }
  });

  const progress =
    totalPossible > 0
      ? Math.round((totalCompletions / totalPossible) * 100)
      : 0;
  document.getElementById("totalHabits").textContent = habitData.habits.length;
  document.getElementById("completedHabits").textContent = totalCompletions;
  document.getElementById("progressPercent").textContent = progress + "%";
  document.getElementById("progressBar").style.width = progress + "%";
}

// ============================================
// FEATURE 5: VISUAL CHAIN (streak chain in analysis)
// ============================================

function generateAnalysis() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  const visibleHabits = getVisibleHabits();
  let html = "";

  const habitProgress = visibleHabits.map((habit) => {
    let completed = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = formatDate(
        habitData.currentYear,
        habitData.currentMonth + 1,
        day,
      );
      if (habitData.completions[habit.id]?.[ds]) completed++;
    }
    const streak = calculateStreak(habit.id);
    const cat = getCategoryColor(habit.category || "other");
    return { habit, completed, goal: daysInMonth, streak, cat };
  });

  habitProgress.sort((a, b) => b.completed - a.completed);

  habitProgress.forEach((item) => {
    const percent = Math.round((item.completed / item.goal) * 100);
    // Streak chain visualization: glow intensity based on streak length
    const glowStrength = Math.min(item.streak * 2, 20);
    const chainColor =
      item.streak > 0
        ? `rgba(${item.streak > 14 ? "255,140,0" : "76,175,80"},${0.4 + Math.min(item.streak / 30, 0.6)})`
        : "var(--color-border)";

    html += `
      <div class="analysis-item">
        <div class="analysis-habit-header" style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:var(--color-text);">${item.habit.emoji} ${item.habit.name}</span>
          <span class="cat-tag" style="background:${item.cat.bg};color:${item.cat.accent};border:1px solid ${item.cat.accent};font-size:10px;padding:2px 6px;border-radius:10px;">${item.cat.label}</span>
        </div>
        <div class="analysis-label">Goal</div>
        <div class="analysis-value">${item.goal}</div>
        <div class="analysis-label" style="grid-column:1">${item.completed}</div>
        <div class="analysis-bar" style="grid-column:2/4">
          <div class="analysis-bar-fill" style="width:${percent}%;background:${item.cat.accent};"></div>
        </div>
        <div style="grid-column:1/-1;margin-top:4px;">
          <div class="streak-chain" title="${item.streak} day streak" style="
            height:8px;border-radius:4px;
            background:${chainColor};
            width:${Math.min(100, item.streak * 3)}%;
            min-width:${item.streak > 0 ? 8 : 0}px;
            box-shadow:${item.streak > 7 ? `0 0 ${glowStrength}px ${chainColor}` : "none"};
            transition:all 0.5s ease;
          "></div>
          ${item.streak > 0 ? `<span style="font-size:10px;color:var(--color-streak);">🔥 ${item.streak}-day chain</span>` : ""}
        </div>
      </div>`;
  });

  if (!html)
    html =
      '<div style="text-align:center;color:var(--color-text-secondary);padding:20px;">No habits in this category.</div>';
  document.getElementById("analysisContainer").innerHTML = html;
}

// ============================================
// CHARTS  (Fix 4: lazy-init, never destroy on data change)
// ============================================

// Call once on init. On subsequent data changes, call refreshCharts() instead.
function createCharts() {
  createProgressChart();
  createMentalChart();
}

// Build the progress data array for the current month view
function buildProgressData() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  const labels = [],
    data = [];
  for (let day = 1; day <= daysInMonth; day++) {
    labels.push(day);
    data.push(
      calculateDayProgress(
        formatDate(habitData.currentYear, habitData.currentMonth + 1, day),
      ),
    );
  }
  return { labels, data };
}

// Build the mood data array for the current month view
function buildMoodData() {
  const daysInMonth = new Date(
    habitData.currentYear,
    habitData.currentMonth + 1,
    0,
  ).getDate();
  const labels = [],
    data = [];
  for (let day = 1; day <= daysInMonth; day++) {
    labels.push(day);
    const ds = formatDate(
      habitData.currentYear,
      habitData.currentMonth + 1,
      day,
    );
    data.push((habitData.mentalState.mood[ds] || 0) * 10);
  }
  return { labels, data };
}

function createProgressChart() {
  const canvasEl = document.getElementById("progressChart");
  if (!canvasEl) return;

  // If a chart already exists on this canvas, destroy it first (only happens once at startup)
  try {
    const ex = Chart.getChart(canvasEl);
    if (ex) ex.destroy();
  } catch (e) {}
  if (progressChart) {
    try {
      progressChart.destroy();
    } catch (e) {}
  }

  const { labels, data } = buildProgressData();
  progressChart = new Chart(canvasEl.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Daily Progress",
          data,
          backgroundColor: "rgba(139, 195, 74, 0.3)",
          borderColor: "rgba(139, 195, 74, 1)",
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
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
      },
    },
  });
}

function createMentalChart() {
  const canvasEl = document.getElementById("mentalChart");
  if (!canvasEl) return;

  try {
    const ex = Chart.getChart(canvasEl);
    if (ex) ex.destroy();
  } catch (e) {}
  if (mentalChart) {
    try {
      mentalChart.destroy();
    } catch (e) {}
  }

  const { labels, data } = buildMoodData();
  mentalChart = new Chart(canvasEl.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Mood",
          data,
          backgroundColor: "rgba(225, 190, 231, 0.3)",
          borderColor: "rgba(225, 190, 231, 1)",
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
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
      },
    },
  });
}

// FIX 4: When month/view changes, just swap in new data — keep the chart instance alive.
// This preserves Chart.js smooth animations and avoids the heavy destroy+recreate cycle.
function refreshCharts() {
  if (progressChart) {
    const { labels, data } = buildProgressData();
    progressChart.data.labels = labels;
    progressChart.data.datasets[0].data = data;
    progressChart.update("active"); // "active" uses the configured animation
  } else {
    createProgressChart();
  }

  if (mentalChart) {
    const { labels, data } = buildMoodData();
    mentalChart.data.labels = labels;
    mentalChart.data.datasets[0].data = data;
    mentalChart.update("active");
  } else {
    createMentalChart();
  }
}

// Used by toggleHabit / removeHabit — only updates the progress chart data, not labels
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

function changeMonth(direction) {
  if (habitData.calendarView === "week") {
    const newWeekStart = new Date(
      habitData.currentWeekStart || getWeekStart(new Date()),
    );
    newWeekStart.setDate(newWeekStart.getDate() + direction * 7);
    habitData.currentWeekStart = newWeekStart;
  } else {
    habitData.currentMonth += direction;
    if (habitData.currentMonth > 11) {
      habitData.currentMonth = 0;
      habitData.currentYear++;
    } else if (habitData.currentMonth < 0) {
      habitData.currentMonth = 11;
      habitData.currentYear--;
    }
  }
  generateCalendar();
  updateStats();
  // FIX 4: Reuse the existing chart instances — just push new data in.
  // No destroy/recreate needed; this keeps animations smooth and avoids repaints.
  refreshCharts();
  generateAnalysis();
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function generateEmojiGrid() {
  let html = "";
  emojis.forEach((emoji) => {
    html += `<div class="emoji-option ${emoji === selectedEmoji ? "selected" : ""}" onclick="selectEmoji('${emoji}')">${emoji}</div>`;
  });
  document.getElementById("emojiGrid").innerHTML = html;
}

function selectEmoji(emoji) {
  selectedEmoji = emoji;
  generateEmojiGrid();
}

function openHabitModal() {
  document.getElementById("habitModal").classList.add("active");
  document.getElementById("habitNameInput").value = "";
}

function closeHabitModal() {
  document.getElementById("habitModal").classList.remove("active");
}

function addHabit() {
  const name = document.getElementById("habitNameInput").value.trim();
  if (!name) {
    alert("Please enter a habit name");
    return;
  }

  const newId = Math.max(...habitData.habits.map((h) => h.id), 0) + 1;
  habitData.habits.push({
    id: newId,
    name,
    emoji: selectedEmoji,
    category: selectedCategory,
  });
  habitData.completions[newId] = {};
  saveData();
  closeHabitModal();
  generateCalendar();
  updateStats();
  generateStreaksAndBadges();
  generateAnalysis();
}

function openRemoveModal() {
  generateHabitList();
  document.getElementById("removeHabitModal").classList.add("active");
}

function closeRemoveModal() {
  document.getElementById("removeHabitModal").classList.remove("active");
}

function generateHabitList() {
  let html = "";
  if (habitData.habits.length === 0) {
    html =
      '<p style="text-align:center;color:#999;padding:20px;">No habits to remove</p>';
  } else {
    habitData.habits.forEach((habit) => {
      const cat = getCategoryColor(habit.category || "other");
      html += `
        <div class="habit-item">
          <div class="habit-item-name">${habit.emoji} ${habit.name}
            <span class="cat-tag" style="background:${cat.bg};color:${cat.accent};border:1px solid ${cat.accent};font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">${cat.label}</span>
          </div>
          <button class="btn-remove" onclick="removeHabit(${habit.id})">Remove</button>
        </div>`;
    });
  }
  document.getElementById("habitListToRemove").innerHTML = html;
}

function removeHabit(habitId) {
  if (
    confirm(
      "Are you sure you want to remove this habit? All data will be permanently deleted.",
    )
  ) {
    habitData.habits = habitData.habits.filter((h) => h.id !== habitId);
    delete habitData.completions[habitId];
    saveData();
    generateHabitList();
    generateCalendar();
    updateStats();
    generateStreaksAndBadges();
    updateProgressChart();
    generateAnalysis();
  }
}

// ============================================
// DOM READY
// ============================================

document.addEventListener("DOMContentLoaded", function () {
  checkAuthStatus();
});
