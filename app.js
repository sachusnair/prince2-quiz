let BANK = [];
let QUIZ = [];
let idx = 0;
let locked = false;

let score = { correct: 0, incorrect: 0, total: 0 };
let weakTopics = {}; // syllabus_ref -> wrong count

const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");
const bankInfo = document.getElementById("bankInfo");
const countInput = document.getElementById("count");

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

// Convert your JSON question format into internal quiz format
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
    rationale: q.rationale || "—"
  };
}

function accuracyPct() {
  return score.total ? Math.round((score.correct / score.total) * 100) : 0;
}

function weakTopicsList() {
  const entries = Object.entries(weakTopics).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "<span class='muted'>None yet 🎯</span>";
  return entries.slice(0, 6).map(([t, cnt]) => `<span class="pill">${esc(t)}: ${cnt}</span>`).join(" ");
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
  locked = false;
  resultCard.style.display = "none";

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

  const isCorrect = choiceIndex === q.correctIndex;
  if (isCorrect) score.correct++;
  else {
    score.incorrect++;
    weakTopics[q.topic] = (weakTopics[q.topic] || 0) + 1;
  }

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="${isCorrect ? "ok" : "bad"}">
      ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
    </div>

    <p><b>Correct answer:</b> ${letter(q.correctIndex)}) ${esc(q.options[q.correctIndex])}</p>
    <p><b>Rationale:</b> ${esc(q.rationale)}</p>

    <p><b>Why the other options are wrong:</b></p>
    <p class="muted">
      This dataset provides a combined rationale (not separate explanations per option). Use the rationale above to see why the correct option best fits.
    </p>

    ${renderStats()}

    <button class="primary" onclick="next()">Next</button>
  `;
};

window.next = function() {
  idx++;
  if (idx >= QUIZ.length) {
    quizCard.innerHTML = `
      <h2>Done ✅</h2>
      ${renderStats()}
      <button class="primary" onclick="start()">Start again</button>
    `;
    resultCard.style.display = "none";
    return;
  }
  renderQuestion();
};

function start() {
  const nRaw = parseInt(countInput.value || "10", 10);
  const n = Math.max(1, Math.min(nRaw, BANK.length));

  QUIZ = shuffle([...BANK]).slice(0, n);
  idx = 0;
  score = { correct: 0, incorrect: 0, total: 0 };
  weakTopics = {};

  renderQuestion();
}

document.getElementById("startBtn").addEventListener("click", start);

(async () => {
  try {
    const res = await fetch("./questions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("questions.json not found");

    const data = await res.json();

    // IMPORTANT: your JSON uses data.questions
    const rawList = Array.isArray(data.questions) ? data.questions : [];
    BANK = rawList.map(normalize).filter(Boolean);

    bankInfo.textContent = `Question bank loaded: ${BANK.length} questions`;
  } catch (e) {
    console.error(e);
    bankInfo.textContent = "Error loading question bank. Open console for details.";
    alert("Could not load questions.json. Please check file name + JSON format.");
  }
})();
