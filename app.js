let BANK = [];
let QUIZ = [];
let idx = 0;
let locked = false;

let score = { correct: 0, incorrect: 0, total: 0 };
let weakTopics = {}; // topic -> wrong count

const LS = {
  seen: "p2_seen_ids_v1",
  lastDay: "p2_last_day_v1",
  mode: "p2_mode_v1" // "daily" (default) or "mixed"
};

const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");
const bankInfo = document.getElementById("bankInfo");
const countInput = document.getElementById("count");

function todayKey() {
  // Local day key (YYYY-MM-DD)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getSeenSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS.seen) || "[]"));
  } catch { return new Set(); }
}
function setSeenSet(seenSet) {
  localStorage.setItem(LS.seen, JSON.stringify([...seenSet]));
}

function getMode() {
  return localStorage.getItem(LS.mode) || "daily";
}
function setMode(m) {
  localStorage.setItem(LS.mode, m);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function letter(i) { return String.fromCharCode(65 + i); }

function accuracyPct() {
  return score.total ? Math.round((score.correct / score.total) * 100) : 0;
}

function weakTopicsList() {
  const entries = Object.entries(weakTopics)
    .sort((a, b) => b[1] - a[1])
    .filter(([, cnt]) => cnt > 0);

  if (entries.length === 0) return "<span class='muted'>None yet 🎯</span>";

  return entries.slice(0, 5).map(([t, cnt]) =>
    `<span class="pill">${esc(t)}: ${cnt}</span>`
  ).join(" ");
}

function renderStats() {
  return `
    <p class="muted">
      <b>Total attempted:</b> ${score.total} &nbsp;|&nbsp;
      <b>Correct:</b> ${score.correct} &nbsp;|&nbsp;
      <b>Incorrect:</b> ${score.incorrect} &nbsp;|&nbsp;
      <b>Accuracy:</b> ${accuracyPct()}%
    </p>
    <p class="muted"><b>Weak topics:</b> ${weakTopicsList()}</p>
  `;
}

function renderQuestion() {
  const q = QUIZ[idx];
  resultCard.style.display = "none";
  locked = false;

  quizCard.style.display = "block";
  quizCard.innerHTML = `
    <div class="muted">Question ${idx + 1} of ${QUIZ.length}</div>
    ${q.topic ? `<div class="pill">${esc(q.topic)}</div>` : ""}
    <h3>${esc(q.question)}</h3>
    ${q.options.map((opt, i) => `
      <button class="opt" onclick="answer(${i})">
        <b>${letter(i)})</b> ${esc(opt)}
      </button>
    `).join("")}
    ${renderStats()}
  `;
}

window.answer = function(choiceIndex) {
  if (locked) return;
  locked = true;

  const q = QUIZ[idx];
  score.total++;

  const correctIndex = q.correctIndex;
  const isCorrect = choiceIndex === correctIndex;

  if (isCorrect) {
    score.correct++;
  } else {
    score.incorrect++;
    const topic = q.topic || "Uncategorized";
    weakTopics[topic] = (weakTopics[topic] || 0) + 1;
  }

  // Build “why others are wrong” section if provided
  const hasOptionRats = Array.isArray(q.optionRationales) && q.optionRationales.length === q.options.length;

  const optionExplain = q.options.map((opt, i) => {
    const tag = i === correctIndex ? "✅ Correct" : "❌";
    const why = hasOptionRats ? (q.optionRationales[i] || "—") : "Not provided in the rationale source.";
    return `<li><b>${letter(i)})</b> ${esc(opt)} — <b>${tag}</b><br><span class="muted">${esc(why)}</span></li>`;
  }).join("");

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="${isCorrect ? "ok" : "bad"}">
      ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
    </div>

    <p><b>Correct answer:</b> ${letter(correctIndex)}) ${esc(q.options[correctIndex])}</p>

    <p><b>Short explanation (rationale):</b> ${esc(q.rationale || "—")}</p>

    <p><b>Why the other options are wrong:</b></p>
    <ol class="muted">${optionExplain}</ol>

    ${renderStats()}

    <div class="row">
      <button class="primary" onclick="next()">Next</button>
      <button onclick="endNow()">End session</button>
    </div>
  `;
};

window.next = function() {
  idx++;
  if (idx >= QUIZ.length) {
    quizCard.innerHTML = `
      <h2>Done ✅</h2>
      ${renderStats()}
      <button class="primary" onclick="start()">Start again</button>
      <p class="muted">
        In <b>Daily mode</b>, you’ll get new unseen questions first (until you finish the full bank).
      </p>
    `;
    resultCard.style.display = "none";
    return;
  }
  renderQuestion();
};

window.endNow = function() {
  quizCard.innerHTML = `
    <h2>Session ended</h2>
    ${renderStats()}
    <button class="primary" onclick="start()">Start again</button>
  `;
  resultCard.style.display = "none";
};

async function loadBank() {
  const res = await fetch("./questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load questions.json");
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) throw new Error("questions.json must be a non-empty array");

  // Validate + enforce IDs
  const ids = new Set();
  data.forEach((q, i) => {
    if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctIndex !== "number") {
      throw new Error(`Invalid question at index ${i}. Required: id, question, options[4], correctIndex`);
    }
    if (ids.has(q.id)) throw new Error(`Duplicate id found: ${q.id}`);
    ids.add(q.id);
  });

  BANK = data;
  bankInfo.textContent = `Question bank loaded: ${BANK.length} questions`;
}

function maybeDailyReset() {
  const today = todayKey();
  const last = localStorage.getItem(LS.lastDay);

  // If first time today, just record it. (We do NOT wipe "seen" daily —
  // we prevent repeats until full bank is done.)
  if (last !== today) {
    localStorage.setItem(LS.lastDay, today);
  }
}

function buildQuiz(n) {
  const mode = getMode(); // daily or mixed
  let seen = getSeenSet();

  const unseen = BANK.filter(q => !seen.has(q.id));
  const pool = (mode === "mixed") ? [...BANK] : [...unseen];

  // If daily mode + unseen exhausted, reset seen to start fresh cycle
  if (mode === "daily" && pool.length === 0) {
    seen = new Set();
    setSeenSet(seen);
  }

  const pool2 = (mode === "mixed") ? [...BANK] : BANK.filter(q => !seen.has(q.id));
  const chosen = shuffle(pool2).slice(0, Math.min(n, pool2.length));

  // Mark chosen as seen (daily mode only)
  if (mode === "daily") {
    chosen.forEach(q => seen.add(q.id));
    setSeenSet(seen);
  }

  return chosen;
}

function start() {
  maybeDailyReset();

  const nRaw = parseInt(countInput.value || "10", 10);
  const n = Math.max(1, Math.min(nRaw, BANK.length));

  QUIZ = buildQuiz(n);
  idx = 0;
  locked = false;
  score = { correct: 0, incorrect: 0, total: 0 };
  weakTopics = {};

  if (QUIZ.length === 0) {
    quizCard.style.display = "block";
    quizCard.innerHTML = `
      <h3>No questions available</h3>
      <p class="muted">Check your questions.json file.</p>
    `;
    return;
  }

  renderQuestion();
}

function resetProgress() {
  localStorage.removeItem(LS.seen);
  localStorage.removeItem(LS.lastDay);
  quizCard.style.display = "none";
  resultCard.style.display = "none";
  score = { correct: 0, incorrect: 0, total: 0 };
  weakTopics = {};
  alert("Progress reset. You will start from the full bank again.");
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("resetBtn").addEventListener("click", resetProgress);

// Optional: quick mode toggle via keyboard (M)
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m") {
    const m = getMode() === "daily" ? "mixed" : "daily";
    setMode(m);
    alert(`Mode switched to: ${m.toUpperCase()}\nDaily = no repeats until bank finished\nMixed = repeats allowed`);
  }
});

(async () => {
  try {
    await loadBank();
    // default mode daily
    if (!localStorage.getItem(LS.mode)) setMode("daily");
  } catch (e) {
    bankInfo.textContent = "Error loading question bank. See console.";
    console.error(e);
    alert("Could not load questions.json. Make sure it exists in the repo root and is valid JSON.");
  }
})();
