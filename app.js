let BANK = [];
let QUIZ = [];
let idx = 0;
let locked = false;
let score = { correct: 0, total: 0 };

const bankInfo = document.getElementById("bankInfo");
const quizCard = document.getElementById("quizCard");
const resultCard = document.getElementById("resultCard");
const countInput = document.getElementById("count");

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

function renderQuestion() {
  const q = QUIZ[idx];
  resultCard.style.display = "none";
  locked = false;

  quizCard.style.display = "block";
  quizCard.innerHTML = `
    <div class="muted">Question ${idx + 1} of ${QUIZ.length}</div>
    <h3>${esc(q.question)}</h3>
    ${q.options.map((opt, i) => `
      <button class="opt" onclick="answer(${i})">
        <b>${letter(i)})</b> ${esc(opt)}
      </button>
    `).join("")}
    <p class="muted"><b>Score:</b> ${score.correct}/${score.total} ${score.total ? `(${Math.round((score.correct/score.total)*100)}%)` : ""}</p>
  `;
}

window.answer = function(choiceIndex) {
  if (locked) return;
  locked = true;

  const q = QUIZ[idx];
  score.total++;

  const correctIndex = q.correctIndex;
  const isCorrect = choiceIndex === correctIndex;
  if (isCorrect) score.correct++;

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="${isCorrect ? "ok" : "bad"}">
      ${isCorrect ? "✅ Correct" : "❌ Incorrect"}
    </div>
    <p><b>Correct answer:</b> ${letter(correctIndex)}) ${esc(q.options[correctIndex])}</p>
    <p><b>Rationale:</b> ${esc(q.rationale || "—")}</p>
    ${q.topic ? `<p class="muted"><b>Topic:</b> ${esc(q.topic)}</p>` : ""}
    <div class="row">
      <button class="primary" onclick="next()">Next</button>
      <button onclick="showAnswerKey()">Show answer key for this question</button>
    </div>
    <p class="muted"><b>Score:</b> ${score.correct}/${score.total} (${Math.round((score.correct/score.total)*100)}%)</p>
  `;
};

window.showAnswerKey = function() {
  const q = QUIZ[idx];
  alert(`Answer: ${letter(q.correctIndex)}\n\nRationale: ${q.rationale || "—"}`);
};

window.next = function() {
  idx++;
  if (idx >= QUIZ.length) {
    quizCard.innerHTML = `
      <h2>Done ✅</h2>
      <p><b>Final score:</b> ${score.correct}/${score.total} (${Math.round((score.correct/score.total)*100)}%)</p>
      <button class="primary" onclick="start()">Start again (new shuffle)</button>
    `;
    resultCard.style.display = "none";
    return;
  }
  renderQuestion();
};

async function loadBank() {
  const res = await fetch("./questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load questions.json");
  const data = await res.json();

  // Basic validation
  if (!Array.isArray(data) || data.length === 0) throw new Error("questions.json must be a non-empty array");
  data.forEach((q, i) => {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correctIndex !== "number") {
      throw new Error(`Invalid question at index ${i}`);
    }
  });
  BANK = data;
  bankInfo.textContent = `Question bank loaded: ${BANK.length} questions`;
}

function start() {
  const nRaw = parseInt(countInput.value || "10", 10);
  const n = Math.max(1, Math.min(nRaw, BANK.length));

  QUIZ = shuffle([...BANK]).slice(0, n);
  idx = 0;
  score = { correct: 0, total: 0 };
  renderQuestion();
}

function reset() {
  quizCard.style.display = "none";
  resultCard.style.display = "none";
  idx = 0;
  locked = false;
  score = { correct: 0, total: 0 };
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("resetBtn").addEventListener("click", reset);

(async () => {
  try {
    await loadBank();
  } catch (e) {
    bankInfo.textContent = "Error loading question bank. See console.";
    console.error(e);
    alert("Could not load questions.json. Make sure it exists in the repo root and is valid JSON.");
  }
})();
