import {
  db,
  studentNumber,
  setupTheme,
  initializePage,
  loadProfileImage,
  setupAdminTab,
  updateAssignmentNavBadge,
  updateNewsNavBadge,
} from "./common.js";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  startStudyTimer,
  pauseStudyTimer,
  resumeStudyTimer,
  stopStudyTimer,
  getStudyTimerState,
  updateManualStudySession,
  deleteManualStudySession,
} from "./study_tracking.js?v=20261009-2";
import {
  formatDuration,
  localDateKey,
  studyWindowStart,
  summarizeStudyData,
  aggregateBySubject,
  aggregateAttempts,
  problemStats,
  weakAreaRanking,
  nextReviewAt,
  buildStudyReport,
  sessionsToCsv,
  toMillis,
} from "./study_analytics_model.mjs?v=20261009-1";

const byId = (id) => document.getElementById(id);
const els = Object.fromEntries([
  "heroTodayTime", "heroTodayQuestions", "summaryToday", "summaryWeek", "summaryMonth", "summaryTotal",
  "summaryQuestions", "summaryAccuracy", "summaryStreak", "summaryGoal", "studySubjectSelect", "studyContentInput",
  "studyTimerClock", "timerStateBadge", "studyTimerMessage", "startStudyTimer", "pauseStudyTimer", "resumeStudyTimer",
  "finishStudyTimer", "todayReviewCount", "todayReviewMessage", "startTodayReview", "homeGoalBar", "homeGoalText",
  "homeSubjectBalance", "studyRange", "studyTimeChart", "studyDayDetail", "studyHeatmap", "studyCalendarDetail",
  "subjectTimeList", "exportStudyCsv", "studyHistoryList", "questionMetricGrid", "accuracyPeriod", "accuracyTrendChart",
  "subjectScoreSort", "subjectScoreList", "weakAreaList", "startWeakReview", "unitScoreList", "problemFilter",
  "problemHistoryList", "weeklyReport", "monthlyReport", "studyGoalsForm", "goalDailyMinutes", "goalWeeklyMinutes",
  "goalDailyQuestions", "goalWeeklyQuestions", "goalAccuracy", "studyGoalsMessage", "studyInsights", "answerTypeAnalysis",
  "subjectRadarChart", "unstudiedUnitList", "allGoalProgress",
].map((id) => [id, byId(id)]));

let sessions = [];
let attempts = [];
let goals = {};
let subjects = [];
let catalogQuestionCount = 0;
let catalogUnits = [];
let timerTicker = null;

setupTheme(byId("themeButton"));
byId("backButton").onclick = () => location.href = "index.html";
byId("profileButton").onclick = () => location.href = "profile.html";

setupEvents();
await initializePage([
  loadProfileImage(byId("topProfileImage")),
  setupAdminTab(byId("settingsTab"), byId("adminTab")),
  updateAssignmentNavBadge(),
  updateNewsNavBadge(),
  loadStudyData(),
]);

async function loadStudyData() {
  if (!studentNumber) return;
  const [sessionSnapshot, attemptSnapshot, goalSnapshot, enrolledSnapshot, subjectSnapshot] = await Promise.all([
    getDocs(collection(db, "users", studentNumber, "studySessions")),
    getDocs(collection(db, "users", studentNumber, "questionAttempts")),
    getDoc(doc(db, "users", studentNumber, "studyGoals", "current")),
    getDocs(collection(db, "users", studentNumber, "enrolledSubjects")),
    getDocs(collection(db, "examSubjects")),
  ]);
  sessions = sessionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  attempts = attemptSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  goals = goalSnapshot.data() || {};
  const names = new Map(subjectSnapshot.docs.map((item) => [item.id, item.data()?.name || item.data()?.subjectName || item.id]));
  subjects = enrolledSnapshot.docs.map((item) => ({ id: item.id, name: item.data()?.subjectName || item.data()?.name || names.get(item.id) || item.id }));
  if (!subjects.length) subjects = subjectSnapshot.docs.map((item) => ({ id: item.id, name: names.get(item.id) }));
  try {
    const published = await getDocs(collectionGroup(db, "publishedQuestions"));
    catalogUnits = published.docs.map((item) => {
      const unitRef = item.ref.parent.parent;
      const subjectRef = unitRef?.parent?.parent;
      return {
        unitId: unitRef?.id || "",
        subjectId: subjectRef?.id || "",
        subjectName: names.get(subjectRef?.id) || subjectRef?.id || "科目",
      };
    }).filter((item) => item.unitId);
    catalogQuestionCount = published.docs.reduce((sum, item) => {
      const data = item.data() || {};
      return sum + (data.quiz?.length || 0) + (data.fill_blank?.length || 0) + (data.qa?.length || 0);
    }, 0);
  } catch (error) {
    console.warn("全問題数は取得できませんでした:", error);
  }
  fillSubjectOptions();
  fillGoalInputs();
  renderAll();
}

function setupEvents() {
  document.querySelector(".study-subtabs")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-study-tab]");
    if (!button) return;
    document.querySelectorAll("[data-study-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-study-panel]").forEach((panel) => {
      const active = panel.dataset.studyPanel === button.dataset.studyTab;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
  });
  els.startStudyTimer?.addEventListener("click", startManualTimer);
  els.pauseStudyTimer?.addEventListener("click", async () => { await pauseStudyTimer("manual-pause"); renderTimer(); });
  els.resumeStudyTimer?.addEventListener("click", async () => { await resumeStudyTimer(); renderTimer(); });
  els.finishStudyTimer?.addEventListener("click", async () => { await stopStudyTimer("manual-finish"); await loadStudyData(); renderTimer(); });
  els.studyRange?.addEventListener("change", renderTimeAnalysis);
  els.accuracyPeriod?.addEventListener("change", renderAccuracyTrend);
  els.subjectScoreSort?.addEventListener("change", renderQuestionAnalysis);
  els.problemFilter?.addEventListener("change", renderProblemHistory);
  els.exportStudyCsv?.addEventListener("click", exportCsv);
  els.studyGoalsForm?.addEventListener("submit", saveGoals);
  els.startTodayReview?.addEventListener("click", () => openReview(todayReviewProblems()));
  els.startWeakReview?.addEventListener("click", () => openReview(filteredProblems("wrong")));
  els.studyHistoryList?.addEventListener("click", handleHistoryAction);
  window.addEventListener("caremate:study-timer-changed", renderTimer);
  timerTicker = setInterval(renderTimer, 1000);
}

async function startManualTimer() {
  const subjectId = els.studySubjectSelect.value;
  const subject = subjects.find((item) => item.id === subjectId);
  els.studyTimerMessage.textContent = "";
  try {
    const result = await startStudyTimer({
      source: "manual",
      subjectId,
      subjectName: subject?.name || "その他",
      content: els.studyContentInput.value,
    });
    if (!result.started && result.reason === "another-device") {
      els.studyTimerMessage.textContent = "別の端末で学習時間を計測中です。そちらを終了してから開始してください。";
    }
    renderTimer();
  } catch (error) {
    els.studyTimerMessage.textContent = "タイマーを開始できませんでした。通信状態を確認してください。";
  }
}

function renderTimer() {
  const state = getStudyTimerState();
  const total = Math.floor(state?.currentElapsedSeconds || 0);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  els.studyTimerClock.textContent = `${h}:${m}:${s}`;
  const running = state?.status === "running";
  const paused = state?.status === "paused";
  els.timerStateBadge.textContent = running ? "計測中" : paused ? "一時停止中" : "停止中";
  els.timerStateBadge.dataset.state = running ? "running" : paused ? "paused" : "stopped";
  els.startStudyTimer.disabled = Boolean(state);
  els.pauseStudyTimer.disabled = !running;
  els.resumeStudyTimer.disabled = !paused;
  els.finishStudyTimer.disabled = !state;
  els.studySubjectSelect.disabled = Boolean(state);
  els.studyContentInput.disabled = Boolean(state);
}

function fillSubjectOptions() {
  els.studySubjectSelect.innerHTML = '<option value="">その他</option>' + subjects
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
}

function fillGoalInputs() {
  els.goalDailyMinutes.value = goals.dailyMinutes || "";
  els.goalWeeklyMinutes.value = goals.weeklyMinutes || "";
  els.goalDailyQuestions.value = goals.dailyQuestions || "";
  els.goalWeeklyQuestions.value = goals.weeklyQuestions || "";
  els.goalAccuracy.value = goals.targetAccuracy || "";
}

function renderAll() {
  const summary = summarizeStudyData(sessions, attempts);
  els.heroTodayTime.textContent = formatDuration(summary.todaySeconds);
  els.heroTodayQuestions.textContent = `${summary.todayQuestions}問`;
  els.summaryToday.textContent = formatDuration(summary.todaySeconds);
  els.summaryWeek.textContent = formatDuration(summary.weekSeconds);
  els.summaryMonth.textContent = formatDuration(summary.monthSeconds);
  els.summaryTotal.textContent = formatDuration(summary.totalSeconds);
  els.summaryQuestions.textContent = `${summary.totalAttempts.toLocaleString()}問`;
  els.summaryAccuracy.textContent = summary.accuracy == null ? "データなし" : `${summary.accuracy.toFixed(1)}%`;
  els.summaryStreak.textContent = `${summary.currentStreak}日`;
  const weeklyGoalSeconds = Number(goals.weeklyMinutes || 0) * 60;
  const goalRate = weeklyGoalSeconds ? Math.min(100, summary.weekSeconds / weeklyGoalSeconds * 100) : null;
  els.summaryGoal.textContent = goalRate == null ? "未設定" : `${Math.round(goalRate)}%`;
  els.summaryGoal.closest("article")?.classList.toggle("study-goal-achieved", goalRate >= 100);
  els.homeGoalText.textContent = goalRate == null ? "目標未設定" : `${formatDuration(summary.weekSeconds)} / ${formatDuration(weeklyGoalSeconds)}`;
  els.homeGoalBar.style.width = `${goalRate || 0}%`;
  renderSubjectBars(els.homeSubjectBalance, aggregateBySubject(sessions, attempts));
  renderReview();
  renderTimeAnalysis();
  renderQuestionAnalysis();
  renderReports();
  renderTimer();
}

function renderSubjectBars(container, rows) {
  if (!rows.length || !rows.some((item) => item.seconds)) {
    container.innerHTML = '<p class="study-empty">学習記録がまだありません。</p>';
    return;
  }
  const max = Math.max(...rows.map((item) => item.seconds));
  const total = rows.reduce((sum, item) => sum + item.seconds, 0);
  container.innerHTML = rows.filter((item) => item.seconds).slice(0, 12).map((item) => `
    <div class="study-subject-bar"><div><b>${escapeHtml(item.name)}</b><span>${formatDuration(item.seconds)}・${Math.round(item.seconds / total * 100)}%</span></div><div><i style="width:${item.seconds / max * 100}%"></i></div></div>
  `).join("");
}

function groupSessionsByDay(range = "7d") {
  const start = studyWindowStart(range);
  const map = new Map();
  sessions.forEach((item) => {
    const time = toMillis(item.endedAt || item.startedAt);
    if (time < start) return;
    const key = localDateKey(time);
    if (!map.has(key)) map.set(key, { key, seconds: 0, sessions: [] });
    const row = map.get(key);
    row.seconds += Math.max(0, Number(item.durationSeconds) || 0);
    row.sessions.push(item);
  });
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 0;
  if (days) {
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(Date.now() - index * 86_400_000);
      const key = localDateKey(date);
      if (!map.has(key)) map.set(key, { key, seconds: 0, sessions: [] });
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function renderTimeAnalysis() {
  const rows = groupSessionsByDay(els.studyRange.value);
  const max = Math.max(60, ...rows.map((item) => item.seconds));
  els.studyTimeChart.innerHTML = rows.length ? rows.slice(-90).map((item) => `
    <button type="button" data-study-day="${item.key}" title="${item.key} ${formatDuration(item.seconds)}"><i style="height:${Math.max(3, item.seconds / max * 100)}%"></i><span>${item.key.slice(5).replace("-", "/")}</span></button>
  `).join("") : '<p class="study-empty">この期間の記録はありません。</p>';
  els.studyTimeChart.querySelectorAll("[data-study-day]").forEach((button) => button.onclick = () => {
    const row = rows.find((item) => item.key === button.dataset.studyDay);
    const names = [...new Set(row.sessions.map((item) => item.subjectName || "その他"))];
    els.studyDayDetail.textContent = `${row.key}：${formatDuration(row.seconds)}／${names.join("、") || "記録なし"}`;
  });
  renderHeatmap();
  renderSubjectBars(els.subjectTimeList, aggregateBySubject(sessions, attempts));
  renderHistory();
}

function renderHeatmap() {
  const summary = summarizeStudyData(sessions, attempts);
  const max = Math.max(60, ...summary.days.values());
  const cells = [];
  for (let index = 111; index >= 0; index -= 1) {
    const key = localDateKey(Date.now() - index * 86_400_000);
    const seconds = summary.days.get(key) || 0;
    const level = seconds ? Math.max(1, Math.ceil(seconds / max * 4)) : 0;
    cells.push(`<button type="button" data-heat-day="${key}" data-level="${level}" title="${key} ${formatDuration(seconds)}"></button>`);
  }
  els.studyHeatmap.innerHTML = cells.join("");
  els.studyHeatmap.querySelectorAll("[data-heat-day]").forEach((button) => button.onclick = () => {
    const key = button.dataset.heatDay;
    const dayAttempts = attempts.filter((item) => localDateKey(toMillis(item.answeredAt)) === key);
    const answered = dayAttempts.filter((item) => typeof item.correct === "boolean");
    const accuracy = answered.length ? `${Math.round(answered.filter((item) => item.correct).length / answered.length * 100)}%` : "データなし";
    els.studyCalendarDetail.textContent = `${key}：${formatDuration(summary.days.get(key) || 0)}／${dayAttempts.length}問／正答率 ${accuracy}`;
  });
}

function renderHistory() {
  const sorted = [...sessions].sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt));
  els.studyHistoryList.innerHTML = sorted.length ? sorted.slice(0, 100).map((item) => `
    <article><div><b>${escapeHtml(item.subjectName || "その他")}</b><span>${new Date(toMillis(item.startedAt)).toLocaleString("ja-JP")}・${formatDuration(item.durationSeconds)}</span><p>${escapeHtml(item.content || (item.source === "exam" ? "テスト対策問題" : "自主学習"))}</p></div>${item.source === "manual" ? `<div class="study-history-actions"><button class="btn" data-edit-session="${item.id}">編集</button><button class="btn study-danger-button" data-delete-session="${item.id}">削除</button></div>` : '<small>自動記録</small>'}</article>
  `).join("") : '<p class="study-empty">学習記録がまだありません。</p>';
}

async function handleHistoryAction(event) {
  const edit = event.target.closest("[data-edit-session]");
  const remove = event.target.closest("[data-delete-session]");
  const id = edit?.dataset.editSession || remove?.dataset.deleteSession;
  const item = sessions.find((row) => row.id === id);
  if (!item || item.source !== "manual") return;
  if (remove) {
    if (!confirm("この自主学習記録を削除しますか？")) return;
    await deleteManualStudySession(id);
  } else {
    const subjectName = prompt("科目名", item.subjectName || "その他");
    if (subjectName == null) return;
    const content = prompt("学習内容", item.content || "");
    if (content == null) return;
    const minutes = Number(prompt("学習時間（分）", String(Math.max(1, Math.round(Number(item.durationSeconds || 0) / 60)))));
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 720) return alert("1〜720分で入力してください。");
    await updateManualStudySession(id, { subjectName, content, durationSeconds: minutes * 60 });
  }
  await loadStudyData();
}

function renderQuestionAnalysis() {
  const summary = summarizeStudyData(sessions, attempts);
  const problems = problemStats(attempts);
  const firstAttempts = problems.map((item) => item.attempts[0]).filter(Boolean);
  const retries = problems.flatMap((item) => item.attempts.slice(1));
  const accuracyOf = (rows) => rows.length ? `${(rows.filter((item) => item.correct === true).length / rows.length * 100).toFixed(1)}%` : "データなし";
  const responseRows = attempts.filter((item) => Number(item.responseSeconds) > 0);
  const avg = responseRows.length ? responseRows.reduce((sum, item) => sum + Number(item.responseSeconds), 0) / responseRows.length : null;
  const metrics = [
    ["総解答数", `${summary.totalAttempts}問`], ["正解数", `${summary.correctCount}問`], ["不正解数", `${summary.incorrectCount}問`],
    ["全体正答率", summary.accuracy == null ? "データなし" : `${summary.accuracy.toFixed(1)}%`], ["初回正答率", accuracyOf(firstAttempts)], ["再挑戦正答率", accuracyOf(retries)],
    ["平均解答時間", avg == null ? "データなし" : `${avg.toFixed(1)}秒`], ["演習回数", `${sessions.filter((item) => item.source === "exam").length}回`],
    ["解答済み問題", `${summary.uniqueAnswered}問`], ["未解答問題", catalogQuestionCount ? `${Math.max(0, catalogQuestionCount - summary.uniqueAnswered)}問` : "集計開始後に表示"],
  ];
  els.questionMetricGrid.innerHTML = metrics.map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  let subjectRows = aggregateBySubject([], attempts).filter((item) => item.attempts);
  subjectRows.sort((a, b) => els.subjectScoreSort.value === "high" ? (b.accuracy || 0) - (a.accuracy || 0) : (a.accuracy || 0) - (b.accuracy || 0));
  els.subjectScoreList.innerHTML = subjectScoreTable(subjectRows);
  const unitRows = aggregateAttempts(attempts, "unitId").sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0));
  els.unitScoreList.innerHTML = analysisTable(unitRows);
  renderAnswerTypes(problems);
  renderSubjectRadar(subjectRows);
  const studiedUnits = new Set(attempts.map((item) => String(item.unitId || "")).filter(Boolean));
  const unstudied = catalogUnits.filter((item, index, all) =>
    !studiedUnits.has(item.unitId) &&
    all.findIndex((other) => other.subjectId === item.subjectId && other.unitId === item.unitId) === index,
  );
  els.unstudiedUnitList.innerHTML = unstudied.length
    ? unstudied.slice(0, 40).map((item) => `<span>${escapeHtml(item.subjectName)}・${escapeHtml(item.unitId)}</span>`).join("")
    : '<p class="study-empty">公開中の単元はすべて学習済みです。</p>';
  const weak = weakAreaRanking(unitRows);
  els.weakAreaList.innerHTML = weak.length ? weak.slice(0, 8).map((item, index) => `<div><b>${index + 1}</b><span>${escapeHtml(item.name)}</span><strong>${item.dataSufficient ? `${Math.round(item.accuracy)}%` : "データ不足"}</strong><small>${item.attempts}問・不正解${item.incorrect}回</small></div>`).join("") : '<p class="study-empty">解答履歴がまだありません。</p>';
  els.startWeakReview.disabled = !filteredProblems("wrong").length;
  renderAccuracyTrend();
  renderProblemHistory();
}

function subjectScoreTable(rows) {
  if (!rows.length) return '<p class="study-empty">解答履歴がまだありません。</p>';
  return `<div class="study-table-row study-subject-score-row is-heading"><span>科目</span><span>解答</span><span>正答率</span><span>初回</span><span>変化</span></div>` + rows.map((item) => {
    const history = attempts.filter((attempt) => String(attempt.subjectId || attempt.subjectName) === String(item.id));
    const grouped = problemStats(history);
    const first = grouped.map((problem) => problem.attempts[0]).filter(Boolean);
    const firstAccuracy = first.length ? first.filter((attempt) => attempt.correct === true).length / first.length * 100 : null;
    const half = Math.max(1, Math.floor(history.length / 2));
    const accuracy = (values) => values.length ? values.filter((attempt) => attempt.correct === true).length / values.length * 100 : null;
    const previous = accuracy(history.slice(0, half));
    const recent = accuracy(history.slice(half));
    const change = previous != null && recent != null ? recent - previous : null;
    return `<div class="study-table-row study-subject-score-row"><b>${escapeHtml(item.name)}</b><span>${item.attempts}問</span><strong data-score="${item.accuracy < 60 ? "low" : item.accuracy < 80 ? "middle" : "high"}">${Math.round(item.accuracy)}%</strong><span>${firstAccuracy == null ? "—" : `${Math.round(firstAccuracy)}%`}</span><span data-change="${change == null ? "none" : change >= 0 ? "up" : "down"}">${change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}pt`}</span></div>`;
  }).join("");
}

function renderAnswerTypes(problems) {
  const sufficient = problems.filter((item) => item.attempts.length >= 5 && Number(item.averageResponseSeconds) > 0);
  if (!sufficient.length) {
    els.answerTypeAnalysis.innerHTML = '<p class="study-empty">同じ問題を5回以上解くと、速さと正答率を組み合わせて分類します。</p>';
    return;
  }
  const times = sufficient.map((item) => item.averageResponseSeconds).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const groups = { strong: [], careful: [], warning: [], weak: [] };
  sufficient.forEach((item) => {
    const accurate = item.accuracy >= 75;
    const fast = item.averageResponseSeconds <= median;
    groups[accurate ? (fast ? "strong" : "careful") : (fast ? "warning" : "weak")].push(item);
  });
  const labels = {
    strong: ["得意", "正解率が高く、解答も速い"],
    careful: ["慎重", "正解率は高いが、時間をかけている"],
    warning: ["要注意", "解答は速いが、不正解が多い"],
    weak: ["苦手", "不正解が多く、時間もかかる"],
  };
  els.answerTypeAnalysis.innerHTML = Object.entries(groups).map(([key, rows]) => `<div data-answer-type="${key}"><b>${labels[key][0]}</b><strong>${rows.length}問</strong><small>${labels[key][1]}</small>${rows.slice(0, 3).map((item) => `<span>${escapeHtml(item.question)}</span>`).join("")}</div>`).join("");
}

function renderSubjectRadar(rows) {
  const values = rows.filter((item) => item.attempts >= 3).sort((a, b) => b.attempts - a.attempts).slice(0, 8);
  if (values.length < 3) {
    els.subjectRadarChart.innerHTML = '<p class="study-empty">3科目以上で各3問以上解答すると表示します。</p>';
    return;
  }
  const cx = 150, cy = 145, radius = 105;
  const point = (index, scale = 1) => {
    const angle = -Math.PI / 2 + index / values.length * Math.PI * 2;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  const rings = [0.25, .5, .75, 1].map((scale) => `<polygon points="${values.map((_, index) => point(index, scale).join(",")).join(" ")}"></polygon>`).join("");
  const axes = values.map((_, index) => { const [x, y] = point(index); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line>`; }).join("");
  const score = values.map((item, index) => point(index, Math.max(.04, (item.accuracy || 0) / 100)).join(",")).join(" ");
  const labels = values.map((item, index) => { const [x, y] = point(index, 1.18); return `<text x="${x}" y="${y}">${escapeHtml(item.name.slice(0, 8))}</text>`; }).join("");
  els.subjectRadarChart.innerHTML = `<svg viewBox="0 0 300 290" role="img" aria-label="科目ごとの正答率レーダー">${rings}${axes}<polygon class="study-radar-score" points="${score}"></polygon>${labels}</svg>`;
}

function analysisTable(rows) {
  if (!rows.length) return '<p class="study-empty">解答履歴がまだありません。</p>';
  return `<div class="study-table-row is-heading"><span>科目・単元</span><span>解答</span><span>正答率</span><span>平均</span></div>` + rows.map((item) => `<div class="study-table-row"><b>${escapeHtml(item.name)}</b><span>${item.attempts}問</span><strong data-score="${item.accuracy == null ? "none" : item.accuracy < 60 ? "low" : item.accuracy < 80 ? "middle" : "high"}">${item.accuracy == null ? "—" : `${Math.round(item.accuracy)}%`}</strong><span>${item.averageResponseSeconds == null ? "—" : `${item.averageResponseSeconds.toFixed(1)}秒`}</span></div>`).join("");
}

function renderAccuracyTrend() {
  const mode = els.accuracyPeriod.value;
  const grouped = new Map();
  attempts.filter((item) => typeof item.correct === "boolean").forEach((item) => {
    const date = new Date(toMillis(item.answeredAt));
    let key = localDateKey(date);
    if (mode === "month") key = key.slice(0, 7);
    if (mode === "week") {
      const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7)); key = localDateKey(monday);
    }
    if (!grouped.has(key)) grouped.set(key, { total: 0, correct: 0 });
    const row = grouped.get(key); row.total += 1; if (item.correct) row.correct += 1;
  });
  const rows = [...grouped].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([key, row]) => ({ key, accuracy: row.correct / row.total * 100 }));
  if (!rows.length) { els.accuracyTrendChart.innerHTML = '<p class="study-empty">正答率の履歴がまだありません。</p>'; return; }
  const width = 760; const height = 210;
  const points = rows.map((row, index) => `${rows.length === 1 ? width / 2 : index / (rows.length - 1) * (width - 50) + 25},${height - 25 - row.accuracy / 100 * (height - 50)}`).join(" ");
  els.accuracyTrendChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="正答率推移"><line x1="25" y1="${height - 25}" x2="${width - 25}" y2="${height - 25}"></line><line x1="25" y1="25" x2="25" y2="${height - 25}"></line><polyline points="${points}"></polyline>${rows.map((row, index) => `<circle cx="${rows.length === 1 ? width / 2 : index / (rows.length - 1) * (width - 50) + 25}" cy="${height - 25 - row.accuracy / 100 * (height - 50)}" r="5"><title>${row.key} ${row.accuracy.toFixed(1)}%</title></circle>`).join("")}</svg>`;
}

function filteredProblems(filter = els.problemFilter.value) {
  const rows = problemStats(attempts);
  const average = rows.length ? rows.reduce((sum, item) => sum + Number(item.averageResponseSeconds || 0), 0) / rows.length : 0;
  if (filter === "wrong") return rows.filter((item) => item.incorrect > 0);
  if (filter === "twice") return rows.filter((item) => item.incorrect >= 2);
  if (filter === "never") return rows.filter((item) => item.correct === 0);
  if (filter === "lastWrong") return rows.filter((item) => item.last?.correct === false);
  if (filter === "improved") return rows.filter((item) => item.improved);
  if (filter === "slow") return rows.filter((item) => Number(item.averageResponseSeconds) > Math.max(30, average * 1.5));
  return rows;
}

function renderProblemHistory() {
  const rows = filteredProblems();
  els.problemHistoryList.innerHTML = rows.length ? rows.slice(0, 100).map((item) => `
    <details><summary><span>${escapeHtml(item.question)}</span><b data-result="${item.last?.correct ? "correct" : "wrong"}">${item.last?.correct ? "前回正解" : "前回不正解"}</b></summary><div><p><strong>${escapeHtml(item.subjectName || "科目")}／${escapeHtml(item.unitName || item.unitId || "単元")}</strong></p>${item.last?.choices?.length ? `<ol>${item.last.choices.map((choice) => `<li>${escapeHtml(choice)}</li>`).join("")}</ol>` : ""}<p>解答 ${item.attempts.length}回・正解 ${item.correct}回・不正解 ${item.incorrect}回・連続正解 ${item.consecutiveCorrect}回</p><p>平均解答時間 ${item.averageResponseSeconds?.toFixed(1) || "—"}秒・正答率 ${item.accuracy?.toFixed(1) || "0"}%</p><p>自分の回答：${escapeHtml(formatAnswer(item.last?.selectedAnswer))}</p><p>正解：${escapeHtml(formatAnswer(item.last?.correctAnswer))}</p><p>最終解答：${new Date(toMillis(item.last?.answeredAt)).toLocaleString("ja-JP")}</p></div></details>
  `).join("") : '<p class="study-empty">該当する問題はありません。</p>';
}

function renderReview() {
  const due = todayReviewProblems();
  els.todayReviewCount.textContent = `${due.length}問`;
  els.todayReviewMessage.textContent = due.length ? "間違えた問題を、前回の結果に応じた間隔で提案しています。" : "今日が復習日の問題はありません。";
  els.startTodayReview.disabled = !due.length;
}

function todayReviewProblems() {
  const now = Date.now();
  return problemStats(attempts).filter((item) => item.incorrect > 0 && nextReviewAt(item.attempts) <= now).slice(0, 15);
}

function openReview(rows) {
  if (!rows.length) return;
  const group = rows.find((item) => item.type === "quiz") || rows[0];
  const ids = rows.filter((item) => item.type === group.type && item.subjectId === group.subjectId && item.unitId === group.unitId).map((item) => item.last?.questionId || item.questionId).filter(Boolean);
  const page = group.type === "fillBlank" ? "fill_blank.html" : group.type === "daily" ? "daily_question.html" : "quiz.html";
  const query = new URLSearchParams({ subjectId: group.subjectId, unitId: group.unitId, reviewIds: ids.join(",") });
  location.href = `${page}?${query}`;
}

function renderReports() {
  const report = buildStudyReport(sessions, attempts);
  const lastWeekStart = studyWindowStart("7d") - 7 * 86_400_000;
  const thisWeekStart = studyWindowStart("7d");
  const previousWeekSeconds = sessions.filter((item) => { const time = toMillis(item.endedAt || item.startedAt); return time >= lastWeekStart && time < thisWeekStart; }).reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  const difference = report.summary.weekSeconds - previousWeekSeconds;
  els.weeklyReport.innerHTML = reportHtml(report, `先週との差：${difference >= 0 ? "+" : "−"}${formatDuration(Math.abs(difference))}`);
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const previousMonthSeconds = sessions.filter((item) => {
    const time = toMillis(item.endedAt || item.startedAt);
    return time >= previousMonthStart && time < currentMonthStart;
  }).reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  const monthDifference = report.summary.monthSeconds - previousMonthSeconds;
  els.monthlyReport.innerHTML = reportHtml(report, `前月との差：${monthDifference >= 0 ? "+" : "−"}${formatDuration(Math.abs(monthDifference))}`);
  const subjectRows = aggregateBySubject(sessions, attempts);
  const weekday = Array.from({ length: 7 }, () => 0);
  const hours = Array.from({ length: 24 }, () => 0);
  sessions.forEach((item) => { const date = new Date(toMillis(item.startedAt)); weekday[date.getDay()] += Number(item.durationSeconds || 0); hours[date.getHours()] += Number(item.durationSeconds || 0); });
  const topWeekday = weekday.some(Boolean) ? ["日", "月", "火", "水", "木", "金", "土"][weekday.indexOf(Math.max(...weekday))] + "曜日" : "データなし";
  const topHour = hours.some(Boolean) ? `${hours.indexOf(Math.max(...hours))}時台` : "データなし";
  const activeDays = Math.max(1, report.summary.days.size);
  const highStudyLowAccuracy = subjectRows.filter((item) => item.seconds > 0 && item.attempts >= 5).sort((a, b) => b.seconds - a.seconds).find((item) => item.accuracy < 70);
  els.studyInsights.innerHTML = [
    ["最も勉強する曜日", topWeekday], ["最も勉強する時間帯", topHour], ["1日平均", formatDuration(report.summary.totalSeconds / activeDays)],
    ["現在の連続学習", `${report.summary.currentStreak}日`], ["最長連続学習", `${report.summary.longestStreak}日`], ["学習科目数", `${subjectRows.filter((item) => item.seconds).length}科目`],
    ["学習バランス", highStudyLowAccuracy ? `${highStudyLowAccuracy.name}は時間を確保できていますが復習候補です` : subjectRows.length ? "大きな偏りはまだ検出されていません" : "データなし"],
    ["時間と正答率", report.summary.accuracy == null ? "データ不足" : "比較表示であり、学習効果を断定しません"],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  renderGoalProgress(report.summary);
}

function renderGoalProgress(summary) {
  const values = [
    ["今日の学習時間", summary.todaySeconds, Number(goals.dailyMinutes || 0) * 60, formatDuration],
    ["今週の学習時間", summary.weekSeconds, Number(goals.weeklyMinutes || 0) * 60, formatDuration],
    ["今日の解答数", summary.todayQuestions, Number(goals.dailyQuestions || 0), (value) => `${Math.round(value)}問`],
    ["今週の解答数", attempts.filter((item) => toMillis(item.answeredAt) >= studyWindowStart("7d")).length, Number(goals.weeklyQuestions || 0), (value) => `${Math.round(value)}問`],
    ["正答率", summary.accuracy || 0, Number(goals.targetAccuracy || 0), (value) => `${Number(value).toFixed(1)}%`],
  ];
  els.allGoalProgress.innerHTML = values.map(([label, current, target, formatter]) => {
    const rate = target > 0 ? Math.min(100, current / target * 100) : 0;
    return `<div class="study-goal-progress ${rate >= 100 ? "is-achieved" : ""}"><div><b>${label}</b><span>${target > 0 ? `${formatter(current)} / ${formatter(target)}` : "未設定"}</span></div><div><i style="width:${rate}%"></i></div><small>${target > 0 ? `${Math.round(rate)}%` : "目標を設定してください"}</small></div>`;
  }).join("");
}

function reportHtml(report, comparison) {
  return `<div class="study-report-metrics"><p>学習時間 <strong>${formatDuration(report.summary.weekSeconds)}</strong></p><p>${comparison}</p><p>解答問題数 <strong>${report.summary.totalAttempts}問</strong></p><p>全体正答率 <strong>${report.summary.accuracy == null ? "データなし" : `${report.summary.accuracy.toFixed(1)}%`}</strong></p><p>最も勉強した科目 <strong>${escapeHtml(report.topStudy?.name || "データなし")}</strong></p><p>復習優先単元 <strong>${escapeHtml(report.weak?.name || "データ不足")}</strong></p></div><blockquote>${escapeHtml(report.comment)}</blockquote>`;
}

async function saveGoals(event) {
  event.preventDefault();
  const number = (element, max) => Math.max(0, Math.min(max, Number(element.value) || 0));
  goals = {
    dailyMinutes: number(els.goalDailyMinutes, 1440), weeklyMinutes: number(els.goalWeeklyMinutes, 10080),
    dailyQuestions: number(els.goalDailyQuestions, 1000), weeklyQuestions: number(els.goalWeeklyQuestions, 7000),
    targetAccuracy: number(els.goalAccuracy, 100), updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", studentNumber, "studyGoals", "current"), goals, { merge: true });
  els.studyGoalsMessage.textContent = "学習目標を保存しました。";
  renderAll();
}

function exportCsv() {
  const blob = new Blob(["\ufeff", sessionsToCsv(sessions)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `CareMate_学習記録_${localDateKey(Date.now())}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

function formatAnswer(value) {
  if (Array.isArray(value)) return value.join("、");
  if (value == null || value === "") return "記録なし";
  return String(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
