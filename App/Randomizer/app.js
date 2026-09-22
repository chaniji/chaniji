import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";

const db = new PGlite("idb://habit-bag");

const BLANK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours, configurable
const BLANK_CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 min
const LAST_ACTIVITY_KEY = "habitBag.lastActivity";
const BANNER_DISMISSED_KEY = "habitBag.bannerDismissedAt";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK (type IN ('good','bad')) NOT NULL,
      monthly_count INT NOT NULL,
      remaining INT NOT NULL,
      month_key TEXT NOT NULL
    );
  `);
}

// ---------- DOM refs ----------
const emptyHint = document.getElementById("empty-hint");

const habitForm = document.getElementById("habit-form");
const habitNameInput = document.getElementById("habit-name");
const habitCountInput = document.getElementById("habit-count");
const habitList = document.getElementById("habit-list");

const shuffleBtn = document.getElementById("shuffle-btn");
const shuffleIcon = document.getElementById("shuffle-icon");
const shuffleLabel = document.getElementById("shuffle-label");
const newMonthBtn = document.getElementById("new-month-btn");

const addHabitFab = document.getElementById("add-habit-fab");
const manageModal = document.getElementById("manage-modal");
const manageClose = document.getElementById("manage-close");

const blankBanner = document.getElementById("blank-banner");
const bannerShuffleBtn = document.getElementById("banner-shuffle");
const bannerDismissBtn = document.getElementById("banner-dismiss");

// ---------- Modal helpers ----------
function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeModal(modal) {
  modal.classList.add("hidden");
  const anyOpen = document.querySelector(".fixed.z-50:not(.hidden)");
  if (!anyOpen) document.body.classList.remove("modal-open");
}

addHabitFab.addEventListener("click", () => openModal(manageModal));
manageClose.addEventListener("click", () => closeModal(manageModal));
manageModal.addEventListener("click", (e) => {
  if (e.target === manageModal) closeModal(manageModal);
});

// ---------- Activity tracking ----------
function markActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch (e) {
    /* localStorage unavailable, ignore */
  }
  hideBanner();
}

function getLastActivity() {
  try {
    const v = localStorage.getItem(LAST_ACTIVITY_KEY);
    return v ? Number(v) : Date.now();
  } catch (e) {
    return Date.now();
  }
}

function hideBanner() {
  blankBanner.classList.add("hidden");
}

function checkBlankTime() {
  try {
    const dismissedAt = Number(localStorage.getItem(BANNER_DISMISSED_KEY) || 0);
    if (Date.now() - dismissedAt < BLANK_CHECK_INTERVAL_MS) return;
  } catch (e) {
    /* ignore */
  }
  const last = getLastActivity();
  if (Date.now() - last > BLANK_THRESHOLD_MS) {
    blankBanner.classList.remove("hidden");
  }
}

["click", "submit", "keydown"].forEach((evt) => {
  document.addEventListener(evt, markActivity, { passive: true });
});

setInterval(checkBlankTime, BLANK_CHECK_INTERVAL_MS);

bannerDismissBtn.addEventListener("click", () => {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, String(Date.now()));
  } catch (e) {
    /* ignore */
  }
  hideBanner();
});

bannerShuffleBtn.addEventListener("click", () => {
  hideBanner();
  doShuffle();
});

// ---------- Habit CRUD ----------
async function getHabits() {
  const monthKey = currentMonthKey();
  const res = await db.query(
    `SELECT id, name, type, monthly_count, remaining, month_key
     FROM habits WHERE month_key = $1 ORDER BY id ASC`,
    [monthKey]
  );
  return res.rows;
}

async function addHabit(name, type, monthlyCount) {
  const monthKey = currentMonthKey();
  await db.query(
    `INSERT INTO habits (name, type, monthly_count, remaining, month_key)
     VALUES ($1, $2, $3, $3, $4)`,
    [name, type, monthlyCount, monthKey]
  );
}

async function decrementHabit(id) {
  await db.query(`UPDATE habits SET remaining = remaining - 1 WHERE id = $1`, [id]);
}

async function resetMonth() {
  const monthKey = currentMonthKey();
  await db.query(
    `UPDATE habits SET remaining = monthly_count, month_key = $1`,
    [monthKey]
  );
}

// ---------- Rendering ----------
function typeAccent(type) {
  return type === "good" ? "#000000" : "#D6001C";
}

function renderHabits(habits) {
  emptyHint.classList.toggle("hidden", habits.length > 0);

  habitList.innerHTML = "";
  if (habits.length === 0) {
    habitList.innerHTML = `<p class="text-xs font-bold uppercase tracking-widest text-black/40 py-3">No habits yet — add one above.</p>`;
  }
  let poolTotal = 0;

  for (const h of habits) {
    poolTotal += Math.max(h.remaining, 0);

    const li = document.createElement("li");
    li.className = "flex items-center justify-between border-b border-black/15 py-3";

    const left = document.createElement("div");
    left.className = "flex items-center gap-3 min-w-0";

    const swatch = document.createElement("span");
    swatch.className = "w-2.5 h-2.5 shrink-0";
    swatch.style.background = typeAccent(h.type);

    const name = document.createElement("span");
    name.className = "text-sm font-bold uppercase tracking-wide truncate";
    name.textContent = h.name;

    left.appendChild(swatch);
    left.appendChild(name);

    const right = document.createElement("span");
    right.className = "tabular text-xs font-bold text-black/50 shrink-0 ml-3";
    right.textContent = `${h.remaining}/${h.monthly_count}`;

    li.appendChild(left);
    li.appendChild(right);
    habitList.appendChild(li);
  }

  shuffleBtn.disabled = poolTotal === 0;
  shuffleBtn.classList.toggle("opacity-30", poolTotal === 0);
  shuffleBtn.classList.toggle("cursor-not-allowed", poolTotal === 0);
}

async function refresh() {
  const habits = await getHabits();
  renderHabits(habits);
}

// ---------- Weighted shuffle ----------
function weightedPick(habits) {
  const pool = habits.filter((h) => h.remaining > 0);
  const total = pool.reduce((sum, h) => sum + h.remaining, 0);
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const h of pool) {
    r -= h.remaining;
    if (r <= 0) return h;
  }
  return pool[pool.length - 1];
}

// ---------- Split-flap (departure-board) text animation ----------
const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function splitFlap(el, finalText, { ticks = 7, tickMs = 85, stagger = 30 } = {}) {
  const chars = finalText.split("");
  el.innerHTML = "";
  const inners = chars.map((ch) => {
    const outer = document.createElement("span");
    outer.className = "flap-char";
    const inner = document.createElement("span");
    inner.className = "flap-inner";
    inner.textContent = ch === " " ? " " : ch;
    outer.appendChild(inner);
    el.appendChild(outer);
    return inner;
  });

  chars.forEach((finalCh, i) => {
    const inner = inners[i];
    const delay = i * stagger;
    for (let t = 0; t < ticks; t++) {
      setTimeout(() => {
        inner.classList.remove("flap-tick");
        void inner.offsetWidth;
        inner.classList.add("flap-tick");
        setTimeout(() => {
          const isLast = t === ticks - 1;
          const nextCh = isLast || finalCh === " "
            ? finalCh
            : FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
          inner.textContent = nextCh === " " ? " " : nextCh;
        }, tickMs / 2);
      }, delay + t * tickMs);
    }
  });

  const totalDuration = ticks * tickMs + Math.max(chars.length - 1, 0) * stagger;
  return new Promise((resolve) => setTimeout(resolve, totalDuration + tickMs / 2));
}

let isShuffling = false;

async function doShuffle() {
  if (shuffleBtn.disabled || isShuffling) return;
  isShuffling = true;

  const habits = await getHabits();
  const picked = weightedPick(habits);
  if (!picked) {
    isShuffling = false;
    await refresh();
    return;
  }

  shuffleBtn.classList.add("shuffling");
  await splitFlap(shuffleLabel, picked.name, { ticks: 6, tickMs: 80, stagger: 22 });
  shuffleBtn.classList.remove("shuffling");

  await decrementHabit(picked.id);

  shuffleBtn.style.background = picked.type === "bad" ? "#D6001C" : "";
  shuffleIcon.style.background = picked.type === "bad" ? "#ffffff" : "";

  isShuffling = false;
  await refresh();
}

shuffleBtn.addEventListener("click", doShuffle);

// ---------- Form + month reset ----------
habitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = habitNameInput.value.trim();
  const type = habitForm.querySelector('input[name="habit-type"]:checked').value;
  const count = parseInt(habitCountInput.value, 10);

  if (!name || !count || count < 1) return;

  await addHabit(name, type, count);
  habitForm.reset();
  habitCountInput.value = 10;
  await refresh();
});

newMonthBtn.addEventListener("click", async () => {
  const confirmed = confirm("Start a new month? Every habit's remaining count resets to its monthly total.");
  if (!confirmed) return;
  await resetMonth();
  await refresh();
});

// ---------- Boot ----------
(async function boot() {
  await initDb();
  await refresh();
  checkBlankTime();
})();
