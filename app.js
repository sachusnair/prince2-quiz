let BANK = [];
let QUIZ = [];
let idx = 0;
let locked = false;

let mode = "home"; // "daily" | "mock" | "home"
let answers = [];  // user answers per question (index 0-3 or null)

let timerSec = 0;
let timerHandle = null;

const LS = {
  seenDaily: "p2_seen_daily_ids_v1"
};

const bankInfo = document.getElementById("bankInfo");
const modeInfo = document.getElementById("modeInfo");
const timerInfo = document.getElementById("timerInfo");
const timerText = document.getElementById("timerText");

const homeCard = document.getElementById("homeCard");
const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");

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
function correctLetterToIndex(ch) {
  const map = { A: 0, B: 1, C: 2, D: 3 };
  return map[String(ch || "").trim().toUpperCase()];
}

function getSeenDaily() {
  try { return new Set(JSON.parse(localStorage.getItem(LS.seenDaily) || "[]")); }
  catch { return new Set(); }
}
function setSeenDaily(seen) {
  localStorage.setItem(LS.seenDaily, JSON.stringify([...seen]));
}

function normalize(q, i) {
  if (!q || !q.question || !q.options || !q.correct_option) return null;

  const A = q.options.A, B = q.options.B, C = q.options.C, D = q.options.D;
  if (![A, B, C, D].every(v => typeof v === "string" && v.trim().length > 0)) return null;

  const correctIndex = correctLetterToIndex(q.correct_option);
  if (typeof correctIndex !== "number") return null;

  const topic = (q.syllabus_ref && String(q.syllabus_ref).trim())
    ? String(q.syllabus_ref).trim()
    : (q.source ? String(q.source).trim() : "General");

  return {
    id: `${q.source || "SRC"}-${q.question_number || i + 1}`,
    topic,
    question: q.question,
    options: [A, B, C, D],
    correctIndex,
    rationale: q.rationale || "—",
    // optional: if your JSON includes correct_answer_text, keep it (not required)
    correct_answer_text: q.correct_answer_text || null
  };
}

function setMode(newMode) {
  mode = newMode;
  modeInfo.textContent = `Mode: ${newMode === "home" ? "Home" : (newMode === "daily" ? "Daily Practice" : "Mock Test")}`;
  homeCard.style.display = (mode === "home") ? "block" : "none";
  quizCard.style.display = (mode === "home") ? "none" : "block";
  resultCard.style.display = "none";
}

function showTimer(show) {
  timerInfo.style.display = show ? "inline-block" : "none";
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function startTimer(seconds) {
  stopTimer();
  timerSec = seconds;
  timerText.textContent = formatTime(timerSec);
  showTimer(true);

  timerHandle = setInterval(() => {
    timerSec--;
    timerText.textContent = formatTime(Math.max(timerSec, 0));
    if (timerSec <= 0) {
      stopTimer();
      finishTest(true); // time up
    }
  }, 1000);
}

function buildDailyQuiz(n=20) {
  // Daily mode: unseen first, reset after bank exhausted (per device)
  let seen = getSeenDaily();
  let pool = BANK.filter(q => !seen.has(q.id));
  if (pool.length === 0) {
    seen = new Set();
    setSeenDaily(seen);
    pool = [...BANK];
  }
  const chosen = shuffle(pool).slice(0, Math.min(n, pool.length));
  chosen.forEach(q => seen.add(q.id));
  setSeenDaily(seen);
  return chosen;
}

function buildMockQuiz(n=60) {
  // Mock: random from full bank (repeats possible)
  return shuffle([...BANK]).slice(0, Math.min(n, BANK.length));
}

function renderQuestion() {
  const q = QUIZ[idx];
  locked = false;
  resultCard.style.display = "none";

  const chosen = answers[idx]; // 0-3 or null
  const chosenText = (chosen === 0 || chosen === 1 || chosen === 2 || chosen === 3)
    ? `${letter(chosen)}) ${q.options[chosen]}`
    : "Not answered";

  quizCard.innerHTML = `
    <div class="row" style="justify-content:space-between;">
      <div class="muted">Question ${idx + 1} of ${QUIZ.length}</div>
      <div class="pill">${esc(q.topic)}</div>
    </div>

    <h3>${esc(q.question)}</h3>

    ${q.options.map((opt, i) => `
      <button class="opt" onclick="answer(${i})">
        <b>${letter(i)})</b> ${esc(opt)}
      </button>
    `).join("")}

    <p class="small"><b>Your current selection:</b> ${esc(chosenText)}</p>

    <div class="row" style="margin-top:10px;">
      <button onclick="prev()" ${idx === 0 ? "disabled" : ""}>Previous</button>
      <button class="primary" onclick="skip()">Skip</button>
      <button class="primary" onclick="nextQ()">Next</button>
      <button onclick="finishTest(false)">Finish</button>
    </div>

    <p class="small muted">
      Note: You can navigate. Your selected answers are saved for this session only.
    </p>
  `;
}

window.answer = function(choiceIndex) {
  if (locked) return;
  // store answer
  answers[idx] = choiceIndex;

  // show instant feedback (as you requested)
  const q = QUIZ[idx];
  const isCorrect = choiceIndex === q.correctIndex;

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="${isCorrect ? "ok" : "bad"}">
      ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
    </div>

    <p><b>Correct answer:</b> ${letter(q.correctIndex)}) ${esc(q.options[q.correctIndex])}</p>
    <p><b>Rationale:</b> ${esc(q.rationale)}</p>

    <p class="muted"><b>Why the other options are wrong:</b><br>
      This dataset provides a combined rationale (not separate explanations per option). Use the rationale above to understand why the correct option fits best.
    </p>
  `;
};

window.nextQ = function() {
  if (idx < QUIZ.length - 1) {
    idx++;
    renderQuestion();
  }
};

window.prev = function() {
  if (idx > 0) {
    idx--;
    renderQuestion();
  }
};

window.skip = function() {
  // leave answer as null and move on
  if (idx < QUIZ.length - 1) {
    idx++;
    renderQuestion();
  }
};

function scoreTest() {
  let correct = 0;
  let attempted = 0;
  QUIZ.forEach((q, i) => {
    const a = answers[i];
    if (a === 0 || a === 1 || a === 2 || a === 3) {
      attempted++;
      if (a === q.correctIndex) correct++;
    }
  });
  const incorrect = attempted - correct;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  return { attempted, correct, incorrect, accuracy };
}

function buildReviewHtml() {
  return QUIZ.map((q, i) => {
    const a = answers[i];
    const userAnswered = (a === 0 || a === 1 || a === 2 || a === 3);
    const userText = userAnswered ? `${letter(a)}) ${q.options[a]}` : "Not answered";
    const correctText = `${letter(q.correctIndex)}) ${q.options[q.correctIndex]}`;
    const ok = userAnswered && a === q.correctIndex;

    return `
      <div class="reviewQ">
        <div class="row" style="justify-content:space-between;">
          <div><b>Q${i + 1}.</b> <span class="muted">${esc(q.topic)}</span></div>
          <div class="${ok ? "ok" : "bad"}">${ok ? "Correct" : "Incorrect"}</div>
        </div>
        <div style="margin-top:8px;"><b>Question:</b> ${esc(q.question)}</div>
        <div style="margin-top:8px;"><b>Your answer:</b> ${esc(userText)}</div>
        <div style="margin-top:4px;"><b>Correct answer:</b> ${esc(correctText)}</div>
        <div style="margin-top:8px;"><b>Rationale:</b> ${esc(q.rationale)}</div>
      </div>
    `;
  }).join("");
}

window.finishTest = function(timeUp) {
  stopTimer();
  showTimer(false);

  const { attempted, correct, incorrect, accuracy } = scoreTest();

  const passMark = 60; // percent
  const passed = accuracy >= passMark;

  quizCard.innerHTML = `
    <h2>Test completed ${timeUp ? "(Time up)" : ""}</h2>
    <p><b>Total questions:</b> ${QUIZ.length}</p>
    <p><b>Attempted:</b> ${attempted} &nbsp;|&nbsp; <b>Correct:</b> ${correct} &nbsp;|&nbsp; <b>Incorrect:</b> ${incorrect}</p>
    <p><b>Score:</b> ${accuracy}% &nbsp;|&nbsp; <b>Pass mark:</b> ${passMark}%</p>
    <p class="${passed ? "ok" : "bad"}">${passed ? "✅ Passed the test" : "❌ Failed the test"}</p>

    <div class="row" style="margin-top:10px;">
      <button class="primary" onclick="goHome()">Back to Home</button>
      <button onclick="restartSameMode()">Restart this mode</button>
    </div>

    <details open>
      <summary>Review all questions (with answers & rationales)</summary>
      ${buildReviewHtml()}
    </details>
  `;

  resultCard.style.display = "none";
};

window.goHome = function() {
  stopTimer();
  showTimer(false);
  setMode("home");
};

window.restartSameMode = function() {
  if (mode === "daily") startDaily();
  else if (mode === "mock") startMock();
  else setMode("home");
};

function startDaily() {
  setMode("daily");
  showTimer(false);
  stopTimer();

  QUIZ = buildDailyQuiz(20);
  idx = 0;
  answers = Array(QUIZ.length).fill(null);

  renderQuestion();
}

function startMock() {
  setMode("mock");
  QUIZ = buildMockQuiz(60);
  idx = 0;
  answers = Array(QUIZ.length).fill(null);

  // 60 minutes = 3600 seconds
  startTimer(60 * 60);
  renderQuestion();
}

function resetProgress() {
  localStorage.removeItem(LS.seenDaily);
  alert("Daily progress reset. Daily Practice will start from the full bank again.");
}

document.getElementById("dailyBtn").addEventListener("click", startDaily);
document.getElementById("mockBtn").addEventListener("click", startMock);
document.getElementById("resetBtn").addEventListener("click", resetProgress);

async function loadBank() {
  const res = await fetch("./questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("questions.json not found");

  const data = await res.json();
  const rawList = Array.isArray(data.questions) ? data.questions : [];

  BANK = rawList.map(normalize).filter(Boolean);
  bankInfo.textContent = `Question bank loaded: ${BANK.length} questions`;
}

(async () => {
  try {
    await loadBank();
    setMode("home");
  } catch (e) {
    console.error(e);
    bankInfo.textContent = "Error loading question bank. Check console.";
    alert("Could not load questions.json. Make sure it is in the repo root and valid JSON.");
  }
})();
