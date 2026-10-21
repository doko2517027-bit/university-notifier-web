export function escapeStudentText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function questionExplanation(question) {
  return String(
    question?.explanation
      ?? question?.commentary
      ?? question?.rationale
      ?? "",
  ).trim();
}

export function answerLinesForChoices(question, answerIndexes) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  return [...new Set((answerIndexes || []).map(Number))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < choices.length)
    .map((index) => `${index + 1}. ${String(choices[index] ?? "")}`);
}

export function renderAnswerExplanation({ answerLines = [], explanation = "" } = {}) {
  const answers = answerLines
    .map((answer) => String(answer ?? "").trim())
    .filter(Boolean);
  const explanationText = String(explanation || "").trim();
  return `
    <div class="test-learning-review" aria-label="答えと解説">
      <section class="test-learning-block is-answer">
        <span class="test-content-label">答え</span>
        <div class="test-answer-lines">
          ${answers.length
            ? answers.map((answer) => `<p>${escapeStudentText(answer)}</p>`).join("")
            : '<p class="is-empty">答えが登録されていません。</p>'}
        </div>
      </section>
      <section class="test-learning-block is-explanation">
        <span class="test-content-label">解説</span>
        <p class="${explanationText ? "" : "is-empty"}">${escapeStudentText(
          explanationText || "この問題には解説が登録されていません。",
        )}</p>
      </section>
    </div>
  `;
}
