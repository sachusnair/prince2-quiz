let RAW = null;
let BANK = [];
let QUIZ = [];
let idx = 0;
let locked = false;

let score = { correct: 0, incorrect: 0, total: 0 };
let weakTopics = {}; // topic -> wrong count

const LS = {
  seen: "p2_seen_ids_v2",
  mode: "p2_mode_v2" // "daily" (default) or "mixed"
};

const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");
const bankInfo = document.getElementById("bankInfo");
const countInput = document.getElementById("count");

function getMode() {
  return localStorage.getItem(LS.mode) || "daily";
}
function setMode(m) {
  localStorage.setItem(LS.mode, m);
}

function getSeenSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS.seen) || "[]")); }
  catch { return new Set(); }
}
function setSeenSet(seenSet) {
  localStorage.setItem(LS.seen, JSON.stringify([...seenSet]));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function esc(s) {
  return String(s ?? "")
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

  return entries.slice(0, 6).map(([t, cnt]) =>
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

// ---- Convert your JSON format -> internal format ----
function correctLetterToIndex(ch) {
  const map = { A: 0, B: 1, C: 2, D: 3 };
  return map[(ch || "").trim().toUpperCase()];
}

function normalizeOne(rawQ) {
  // rawQ shape (from your file):
  // { source, question_number, question, options: {A,B,C,D}, correct_option: "A", rationale, syllabus_ref ... }

  if (!rawQ || !rawQ.question || !rawQ.options) return null;

  const opt = rawQ.options;

  // options must contain A-D strings
  const A = opt.A, B = opt.B, C = opt.C, D = opt.D;
  if (![A, B, C, D].every(x => typeof x === "string" && x.trim().length > 0)) return null;

  const correctIndex = correctLetterToIndex(rawQ.correct_option);
  if (typeof correctIndex !== "number") return null;

  const topic =
    (typeof rawQ.syllabus_ref === "string" && rawQ.syllabus_ref.trim()) ? rawQ.syllabus_ref.trim()
    : (typeof rawQ.source === "string" && rawQ.source.trim()) ? rawQ.source.trim()
    : "General";

  // Build a stable id
  const id = `${rawQ.source || "SRC"}-${rawQ.question_number || "X"}`;

  // We don't have per-option rationales in a structured way, so we show the main rationale
  // and a simple fallback per option.
  const mainRat = typeof rawQ.rationale === "string" ? rawQ.rationale : "—";

  const optionRationales = [
    "See rationale below.",
    "See rationale below.",
    "See rationale below.",
    "See rationale below."
  ];

  return {
    id,
    topic,
    question: rawQ.question,
    options: [A, B, C, D],
    correctIndex,
    rationale: mainRat,
    optionRationales
  };
}

function buildBankFromRaw(rawJson) {
  const rawList = Array.isArray(rawJson.questions) ? rawJson.questions : [];
  const normalized = [];
  for (const q of rawList) {
    const n = normalizeOne(q);
    if (n) normalized.push(n);
  }
  return normalized;
}

// ---- Quiz selection logic ----
function buildQuiz(n) {
  const mode = getMode(); // daily or mixed
  let seen = getSeenSet();

  // Daily mode: serve unseen first; when exhausted, reset cycle.
  let pool = (mode === "mixed") ? [...BANK] : BANK.filter(q => !seen.has(q.id));
  if (mode === "daily" && pool.length === 0) {
    seen = new Set();
    setSeenSet(seen);
    pool = [...BANK];
  }

  const chosen = shuffle(pool).slice(0, Math.min(n, pool.length));

  if (mode === "daily") {
    chosen.forEach(q => seen.add(q.id));
    setSeenSet(seen);
  }

  return chosen;
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
    <p class="muted" style="margin-top:10px;">
      Mode: <b>${esc(getMode().toUpperCase())}</b> (press <b>M</b> to toggle Daily/Mixed)
    </p>
  `;
}

window.answer = function(choiceIndex) {
  if (locked) return;
  locked = true;

  const q = QUIZ[idx];
  score.total++;

  const isCorrect = choiceIndex === q.correctIndex;
  if (isCorrect) score.correct++;
  else {
    score.incorrect++;
    const topic = q.topic || "General";
    weakTopics[topic] = (weakTopics[topic] || 0) + 1;
  }

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="${isCorrect ? "ok" : "bad"}">
      ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
    </div>

    <p><b>Correct answer:</b> ${letter(q.correctIndex)}) ${esc(q.options[q.correctIndex])}</p>

    <p><b>Short explanation (rationale):</b><br>${esc(q.rationale || "—")}</p>

    <p><b>Why the other options are wrong:</b></p>
    <p class="muted">
      This source provides a combined rationale (not per-option breakdown). Use the rationale above to understand why the correct option fits best.
    </p>

    ${renderStats()}

    <div class="row">
      <button class="primary" onclick="next()">Next</button>
      <button onclick="endNow()">End session</button>
      <button onclick="resetProgress()">Reset progress (no-repeat)</button>
    </div>
  `;
};

window.next = function() {
  idx++;
  if (idx >= QUIZ.length) {
    quizCard.innerHTML = `
      <h2>Done ✅</h2>
      ${renderStats()}
      <button class="primary" onclick="start()">Start again (new shuffle)</button>
      <p class="muted">Daily mode prevents repeats until you finish the full bank on this device.</p>
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

function start() {
  const nRaw = parseInt(countInput.value || "10", 10);
  const n = Math.max(1, Math.min(nRaw, BANK.length));

  QUIZ = buildQuiz(n);
  idx = 0;
  locked = false;
  score = { correct: 0, incorrect: 0, total: 0 };
  weakTopics = {};

  if (QUIZ.length === 0) {
    quizCard.style.display = "block";
    quizCard.innerHTML = `<h3>No questions available</h3><p class="muted">Check the JSON file.</p>`;
    return;
  }
  renderQuestion();
}

function resetProgress() {
  localStorage.removeItem(LS.seen);
  alert("Progress reset. Daily no-repeat will start from the full bank again.");
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("resetBtn").addEventListener("click", resetProgress);

// Toggle mode with M
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "m") {
    const m = getMode() === "daily" ? "mixed" : "daily";
    setMode(m);
    alert(`Mode: ${m.toUpperCase()}\nDaily = no repeats until bank finished (on this device)\nMixed = repeats allowed`);
  }
});

(async () => {
  try {
    // IMPORTANT: use your exact file name here
    const res = await fetch("./prince2_v7_all_questions_answers_rationales.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load JSON file");
    RAW = await res.json();

    BANK = buildBankFromRaw(RAW);

    bankInfo.textContent = `Question bank loaded: ${BANK.length} usable questions (filtered from ${RAW?.counts?.total ?? "?"})`;
    if (!localStorage.getItem(LS.mode)) setMode("daily");

  } catch (e) {
    console.error(e);
    bankInfo.textContent = "Error loading question bank. See console.";
    alert("Could not load the JSON file. Make sure it is uploaded to the repo root with the exact filename.");
  }
})();
