import { db, studentNumber } from "./common.js";

import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export const CLASS_SELECTION_NONE = "__NONE__";

let classSelectionSchedule = [];

/* ========================================
   初期化
======================================== */

export function setupClassSelection() {
  injectClassSelectionStyles();
}

/* ========================================
   app.jsから時間割を受け取る
======================================== */

export function setClassSelectionSchedule(schedule) {
  classSelectionSchedule = Array.isArray(schedule) ? schedule : [];
}

/* ========================================
   クラス選択確認
======================================== */

export async function checkClassSelectionRequired(currentUserData = null) {
  if (!studentNumber) {
    return;
  }

  try {
    injectClassSelectionStyles();

    let userData = currentUserData;

    /*
        app.jsから最新userが渡されていれば
        Firestoreを再取得しない。

        他ページなどから単独で呼ばれた場合だけ
        従来どおり取得する。
        */
    if (!userData) {
      const userSnapshot = await getDoc(doc(db, "users", studentNumber));

      if (!userSnapshot.exists()) {
        return;
      }

      userData = userSnapshot.data() || {};
    }

    const selections = userData.classSelections || {};

    /*
        通常起動なら今日だけ。

        クラス選択Pushなどから
        ?date=YYYY-MM-DD
        が付いている場合はその日。
        */
    const targetDate = resolveTargetDate();

    /*
        重要：
        classSelectionScheduleには
        app.jsから複数日分が来る可能性がある。

        ここで対象日のみに限定する。
        */
    const targetSchedule = classSelectionSchedule.filter(
      (item) => normalizeDate(item.date) === targetDate,
    );

    if (!targetSchedule.length) {
      closeClassSelectionPopup();

      return;
    }

    const targets = buildClassSelectionTargets(targetSchedule);

    /*
        すでに選択済みの科目は
        ポップアップに出さない。

        過去の保存済み選択も出ない。
        */
    const unresolved = targets.filter(
      (target) => !Object.prototype.hasOwnProperty.call(selections, target.key),
    );

    if (!unresolved.length) {
      closeClassSelectionPopup();

      return;
    }

    showClassSelectionPopup(unresolved, selections);
  } catch (error) {
    console.error("クラス確認エラー:", error);
  }
}

/* ========================================
   選択対象作成
======================================== */

export function buildClassSelectionTargets(schedule) {
  const groups = new Map();

  for (const item of schedule || []) {
    const subject = normalizeText(item.subject || item.name || item.title);

    const date = normalizeDate(item.date);

    const period = normalizePeriod(item.period);

    if (!subject || !date || !period) {
      continue;
    }

    /*
        classGroup表記なし
        → クラス選択不要
        */
    const classGroups = extractClassGroups(item.classGroup);

    if (!classGroups.length) {
      continue;
    }

    const key = createClassSelectionKey({
      subject,
      date,
      period,
    });

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        subject,
        date,
        period,
        options: new Set(),
      });
    }

    const group = groups.get(key);

    for (const classGroup of classGroups) {
      group.options.add(classGroup);
    }
  }

  return [...groups.values()]
    .map((item) => ({
      ...item,

      options: [...item.options].sort((left, right) =>
        left.localeCompare(right, "ja"),
      ),
    }))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        Number(left.period) - Number(right.period) ||
        left.subject.localeCompare(right.subject, "ja"),
    );
}

/* ========================================
   ポップアップ
======================================== */

function showClassSelectionPopup(targets, existingSelections) {
  const overlay = document.getElementById("classSelectionOverlay");

  const list = document.getElementById("classSelectionList");

  const saveButton = document.getElementById("saveClassSelection");

  if (!overlay || !list || !saveButton) {
    return;
  }

  const classSelectionHtml = targets
    .map((target) => {
      const buttons = [
        ...target.options.map((value) => ({
          value,

          label: formatClassLabel(value),
        })),

        {
          value: CLASS_SELECTION_NONE,

          label: "クラスなし",
        },
      ];

      return `

                        <div class="class-select-box">

                            <div class="class-select-heading">

                                <strong>
                                    ${escapeHtml(target.subject)}
                                </strong>

                                <span>
                                    ${escapeHtml(`${target.period}限`)}
                                </span>

                            </div>


                            <p class="class-select-message">

                                ${escapeHtml(
                                  target.subject,
                                )}でクラス分けがあります。<br>

                                クラスを選択してください。

                            </p>


                            <div class="class-buttons">

                                ${buttons
                                  .map(
                                    (option) => `

                                                <button
                                                    type="button"
                                                    class="main-button class-choice"
                                                    data-key="${escapeAttribute(
                                                      target.key,
                                                    )}"
                                                    data-value="${escapeAttribute(
                                                      option.value,
                                                    )}">

                                                    ${escapeHtml(option.label)}

                                                </button>

                                            `,
                                  )
                                  .join("")}

                            </div>

                        </div>

                    `;
    })
    .join("");

  /*
    DOM更新は1回だけ。
    */
  list.innerHTML = classSelectionHtml;

  /*
    ボタン1個ずつではなく
    リスト全体にイベントを1個だけ付ける。
    */
  list.onclick = (event) => {
    const button = event.target.closest(".class-choice");

    if (!button || !list.contains(button)) {
      return;
    }

    const box = button.closest(".class-select-box");

    if (!box) {
      return;
    }

    const previous = box.querySelector(".class-choice.selected");

    if (previous) {
      previous.classList.remove("selected");
    }

    button.classList.add("selected");
  };

  saveButton.onclick = async () => {
    const selectedButtons = list.querySelectorAll(".class-choice.selected");

    /*
            全科目を選ばないと保存不可。
            */
    if (selectedButtons.length !== targets.length) {
      alert("すべての科目でクラスを選択してください。");

      return;
    }

    const newSelections = {};

    selectedButtons.forEach((button) => {
      newSelections[button.dataset.key] = button.dataset.value;
    });

    /*
            既存データを残す。

            過去日・他時限の選択を
            消してはいけない。
            */
    const mergedSelections = {
      ...existingSelections,

      ...newSelections,
    };

    saveButton.disabled = true;

    try {
      await updateDoc(doc(db, "users", studentNumber), {
        classSelections: mergedSelections,

        classSelectionUpdatedAt: new Date().toISOString(),
      });

      localStorage.setItem("classSelections", JSON.stringify(mergedSelections));

      closeClassSelectionPopup();

      /*
                ページ全体reloadはしない。

                app.jsへ保存結果だけ通知して
                時間割部分だけ更新する。
                */
      window.dispatchEvent(
        new CustomEvent("caremate:classSelectionsUpdated", {
          detail: {
            selections: mergedSelections,
          },
        }),
      );
    } catch (error) {
      console.error("クラス選択保存エラー:", error);

      alert("クラス選択を保存できませんでした。");

      saveButton.disabled = false;
    }
  };

  overlay.hidden = false;

  overlay.classList.add("show");

  /*
    開いた瞬間はリスト先頭。
    */
  list.scrollTop = 0;
}

/* ========================================
   閉じる
======================================== */

function closeClassSelectionPopup() {
  const overlay = document.getElementById("classSelectionOverlay");

  if (!overlay) {
    return;
  }

  overlay.classList.remove("show");

  overlay.hidden = true;
}

/* ========================================
   選択反映
======================================== */

export function applyClassSelections(schedule, selections = {}) {
  return (schedule || []).filter((item) => {
    const groups = extractClassGroups(item.classGroup);

    /*
            クラス表記なし
            → 必ず対象。
            */
    if (!groups.length) {
      return true;
    }

    const key = createClassSelectionKey(item);

    /*
            クラス未選択
            → 表示・出席対象にしない。
            */
    if (!Object.prototype.hasOwnProperty.call(selections, key)) {
      return false;
    }

    const selected = normalizeSelection(selections[key]);

    /*
            クラスなし
            → この時間枠の
              クラス講義には参加しない。
            */
    if (selected === CLASS_SELECTION_NONE) {
      return false;
    }

    return groups.includes(selected);
  });
}

/* ========================================
   選択取得
======================================== */

export function getSelectedClassForLecture(selections, item) {
  const key = createClassSelectionKey(item);

  if (!Object.prototype.hasOwnProperty.call(selections || {}, key)) {
    return "";
  }

  return normalizeSelection(selections[key]);
}

/* ========================================
   キー
======================================== */

export function createClassSelectionKey(item) {
  const subject = normalizeText(item.subject || item.name || item.title);

  const date = normalizeDate(item.date);

  const period = normalizePeriod(item.period);

  return `${subject}_${date}_${period}`;
}

/* ========================================
   クラス抽出
======================================== */

export function extractClassGroups(value) {
  if (!value) {
    return [];
  }

  let text = normalizeText(value).toUpperCase();

  text = toHalfWidthAlphabet(text);

  /*
    Aクラス / Bクラス
    A・B
    A/B
    A〜D
    などを処理
    */
  const rangeMatch = text.match(/([A-Z])\s*[〜～\-ー]\s*([A-Z])/);

  const results = new Set();

  if (rangeMatch) {
    const start = rangeMatch[1].charCodeAt(0);

    const end = rangeMatch[2].charCodeAt(0);

    for (
      let code = Math.min(start, end);
      code <= Math.max(start, end);
      code++
    ) {
      results.add(String.fromCharCode(code));
    }
  }

  const matches = text.match(/([A-Z])(?:\s*クラス|\s*組)?/g) || [];

  for (const match of matches) {
    const letter = match.match(/[A-Z]/)?.[0];

    if (letter) {
      results.add(letter);
    }
  }

  return [...results];
}

/* ========================================
   UI CSS
======================================== */

function injectClassSelectionStyles() {
  if (document.getElementById("classSelectionDynamicStyle")) {
    return;
  }

  const style = document.createElement("style");

  style.id = "classSelectionDynamicStyle";

  style.textContent = `

        /*
        ポップアップ全体を
        画面内に収める
        */
        #classSelectionOverlay
        .exam-popup-card {

            display:flex;
            flex-direction:column;

            width:
                min(
                    calc(100vw - 32px),
                    520px
                );

            max-height:
                calc(100dvh - 40px);

            overflow:hidden;

        }


        /*
        クラス一覧だけスクロール
        */
        #classSelectionList {

            min-height:0;

            max-height:
                60dvh;

            overflow-y:auto;
            overflow-x:hidden;

            overscroll-behavior:
                contain;

            -webkit-overflow-scrolling:
                touch;

            padding:
                4px 4px 12px;

        }


        #classSelectionList
        .class-select-box {

            padding:
                14px 0;

            border-bottom:
                1px solid
                var(
                    --border,
                    rgba(
                        148,
                        163,
                        184,
                        .3
                    )
                );

        }


        #classSelectionList
        .class-select-box:last-child {

            border-bottom:none;

        }


        .class-select-heading {

            display:flex;
            align-items:center;
            justify-content:
                space-between;

            gap:12px;

        }


        .class-select-heading span {

            white-space:nowrap;

            color:
                var(--subtext);

            font-size:13px;

        }


        .class-select-message {

            margin:
                8px 0 12px;

            line-height:1.6;

            font-size:14px;

        }


        #classSelectionList
        .class-buttons {

            display:grid;

            grid-template-columns:
                repeat(
                    2,
                    minmax(0,1fr)
                );

            gap:8px;

        }


        #classSelectionList
        .class-choice {

            width:100%;

            min-width:0;

        }


        #classSelectionList
        .class-choice.selected {

            outline:
                3px solid
                var(
                    --primary,
                    #2563eb
                );

            outline-offset:
                -3px;

        }


        #saveClassSelection {

            flex:
                0 0 auto;

            width:100%;

            margin-top:
                14px;

        }

    `;

  document.head.appendChild(style);
}

/* ========================================
   日付
======================================== */

function resolveTargetDate() {
  const params = new URLSearchParams(location.search);

  const requested = normalizeDate(params.get("date"));

  if (requested) {
    return requested;
  }

  const now = new Date();

  return [
    now.getFullYear(),

    String(now.getMonth() + 1).padStart(2, "0"),

    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value)
    .trim()
    .replace(/年|\/|\./g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, "");

  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (!match) {
    return "";
  }

  return [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join(
    "-",
  );
}

function normalizePeriod(value) {
  const match = String(value ?? "").match(/\d+/);

  return match ? Number(match[0]) : "";
}

/* ========================================
   その他
======================================== */

function normalizeSelection(value) {
  if (value && typeof value === "object") {
    return normalizeSelection(value.classGroup || value.class || value.value);
  }

  const raw = normalizeText(value);

  if (raw === CLASS_SELECTION_NONE) {
    return CLASS_SELECTION_NONE;
  }

  return extractClassGroups(raw)[0] || "";
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function toHalfWidthAlphabet(value) {
  return String(value).replace(/[Ａ-Ｚａ-ｚ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
}

function formatClassLabel(value) {
  const normalized = normalizeText(value);

  return normalized ? `${normalized}クラス` : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
