import {
    db,
    studentNumber
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   定数
======================================== */

export const CLASS_SELECTION_NONE =
    "__NONE__";


let todayScheduleData = [];


/* ========================================
   app.js から時間割を受け取る
======================================== */

export function setClassSelectionSchedule(
    schedule
) {

    todayScheduleData =
        Array.isArray(schedule)
            ? schedule
            : [];

}


/* ========================================
   クラス選択確認
======================================== */

export async function checkClassSelectionRequired() {

    if (!studentNumber) {
        return;
    }


    try {

        const userSnap =
            await getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            );


        if (!userSnap.exists()) {
            return;
        }


        const user =
            userSnap.data() || {};


        const selected =
            user.classSelections &&
            typeof user.classSelections === "object"
                ? user.classSelections
                : {};


        const targets =
            buildClassSelectionTargets(
                todayScheduleData
            );


        /*
         すでに選択済みの
         日付 × 科目 × 時限は除外
        */

        const unresolved =
            targets.filter(
                target =>
                    !Object.prototype
                        .hasOwnProperty.call(
                            selected,
                            target.key
                        )
            );


        if (!unresolved.length) {
            return;
        }


        showClassSelectionPopup(
            unresolved,
            selected
        );

    } catch (error) {

        console.error(
            "クラス確認エラー:",
            error
        );

    }

}


/* ========================================
   選択対象生成
======================================== */

export function buildClassSelectionTargets(
    schedule
) {

    const map =
        new Map();


    for (
        const rawItem of
        Array.isArray(schedule)
            ? schedule
            : []
    ) {

        const item = {
            ...rawItem,

            subject:
                normalizeText(
                    rawItem.subject ||
                    rawItem.name ||
                    rawItem.title
                ),

            date:
                normalizeDate(
                    rawItem.date
                ),

            period:
                normalizePeriod(
                    rawItem.period
                )
        };


        /*
         科目名・日付・時限がないものは対象外
        */

        if (
            !item.subject ||
            !item.date ||
            !item.period
        ) {
            continue;
        }


        /*
         classGroup自体がない講義は
         クラス選択不要
        */

        const classGroups =
            extractClassGroups(
                item.classGroup
            );


        if (!classGroups.length) {
            continue;
        }


        const key =
            createClassSelectionKey(
                item
            );


        if (!map.has(key)) {

            map.set(
                key,
                {
                    key,

                    subject:
                        item.subject,

                    date:
                        item.date,

                    period:
                        item.period,

                    options:
                        new Set(),

                    rows:
                        []
                }
            );

        }


        const target =
            map.get(key);


        target.rows.push(
            item
        );


        classGroups.forEach(
            classGroup => {

                target.options.add(
                    classGroup
                );

            }
        );

    }


    return [
        ...map.values()
    ].map(
        target => ({
            ...target,

            options:
                [...target.options]
                    .sort(
                        (a, b) =>
                            a.localeCompare(
                                b,
                                "ja"
                            )
                    )
        })
    );

}


/* ========================================
   選択結果を時間割へ反映
======================================== */

export function applyClassSelections(
    schedule,
    selections = {}
) {

    return (
        Array.isArray(schedule)
            ? schedule
            : []
    ).filter(
        item => {

            /*
             クラス表記なし
             → 普通の講義なので表示
            */

            const itemGroups =
                extractClassGroups(
                    item.classGroup
                );


            if (!itemGroups.length) {

                return true;

            }


            const key =
                createClassSelectionKey(
                    item
                );


            /*
             まだ選択していない
             → クラス確定前なので表示しない
            */

            if (
                !Object.prototype
                    .hasOwnProperty.call(
                        selections,
                        key
                    )
            ) {

                return false;

            }


            const selected =
                normalizeSelectedValue(
                    selections[key]
                );


            /*
             「クラスなし」
             → この講義は本人の講義ではない
            */

            if (
                selected ===
                CLASS_SELECTION_NONE
            ) {

                return false;

            }


            /*
             選択したクラスと一致した講義だけ表示
            */

            return itemGroups.includes(
                selected
            );

        }
    );

}


/* ========================================
   選択済みか確認
======================================== */

export function getSelectedClassForLecture(
    selections,
    item
) {

    const key =
        createClassSelectionKey(
            item
        );


    if (
        !Object.prototype
            .hasOwnProperty.call(
                selections || {},
                key
            )
    ) {

        return "";

    }


    return normalizeSelectedValue(
        selections[key]
    );

}


/* ========================================
   キー
======================================== */

export function createClassSelectionKey(
    item
) {

    const subject =
        normalizeText(
            item.subject ||
            item.name ||
            item.title
        );


    const date =
        normalizeDate(
            item.date
        );


    const period =
        normalizePeriod(
            item.period
        );


    return (
        `${subject}_${date}_${period}`
    );

}


/* ========================================
   ポップアップ
======================================== */

function showClassSelectionPopup(
    targets,
    existingSelections
) {

    const overlay =
        document.getElementById(
            "classSelectionOverlay"
        );


    const list =
        document.getElementById(
            "classSelectionList"
        );


    const save =
        document.getElementById(
            "saveClassSelection"
        );


    if (
        !overlay ||
        !list ||
        !save
    ) {

        return;

    }


    list.innerHTML = "";


    targets.forEach(
        target => {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "class-select-box";


            const optionButtons =

                target.options
                    .map(
                        classGroup => `

                            <button
                                type="button"
                                class="main-button class-choice"
                                data-key="${escapeHtml(target.key)}"
                                data-value="${escapeHtml(classGroup)}">

                                ${escapeHtml(classGroup)}クラス

                            </button>

                        `
                    )
                    .join("");


            box.innerHTML = `

                <h3>
                    ${escapeHtml(target.subject)}
                </h3>

                <p>
                    ${escapeHtml(target.subject)}でクラス分けがあります。<br>
                    クラスを選択してください。
                </p>

                <small>
                    ${escapeHtml(target.date)}
                    ・
                    ${escapeHtml(formatPeriod(target.period))}
                </small>

                <div class="class-buttons">

                    ${optionButtons}

                    <button
                        type="button"
                        class="main-button class-choice"
                        data-key="${escapeHtml(target.key)}"
                        data-value="${CLASS_SELECTION_NONE}">

                        クラスなし

                    </button>

                </div>

            `;


            list.appendChild(
                box
            );

        }
    );


    list
        .querySelectorAll(
            ".class-choice"
        )
        .forEach(
            button => {

                button.onclick =
                    () => {

                        const parent =
                            button.closest(
                                ".class-buttons"
                            );


                        if (!parent) {
                            return;
                        }


                        parent
                            .querySelectorAll(
                                ".class-choice"
                            )
                            .forEach(
                                otherButton => {

                                    otherButton
                                        .classList
                                        .remove(
                                            "selected"
                                        );

                                }
                            );


                        button
                            .classList
                            .add(
                                "selected"
                            );

                    };

            }
        );


    overlay.hidden =
        false;


    overlay.classList.add(
        "show"
    );


    save.onclick =
        async () => {

            const newSelections =
                {};


            const boxes =
                list.querySelectorAll(
                    ".class-select-box"
                );


            for (
                const box of boxes
            ) {

                const selectedButton =
                    box.querySelector(
                        ".class-choice.selected"
                    );


                /*
                 全科目について選択必須
                */

                if (!selectedButton) {

                    alert(
                        "すべての科目についてクラスを選択してください。"
                    );

                    return;

                }


                const key =
                    selectedButton
                        .dataset
                        .key;


                const value =
                    selectedButton
                        .dataset
                        .value;


                if (
                    !key ||
                    !value
                ) {

                    continue;

                }


                newSelections[key] =
                    value;

            }


            /*
             ここ重要。

             既存選択を消さず、
             今回新しく選択したものだけ追加する。
            */

            const mergedSelections = {
                ...existingSelections,
                ...newSelections
            };


            try {

                save.disabled =
                    true;


                save.textContent =
                    "保存中...";


                await updateDoc(
                    doc(
                        db,
                        "users",
                        studentNumber
                    ),
                    {
                        classSelections:
                            mergedSelections,

                        classSelectionUpdatedAt:
                            new Date()
                                .toISOString()
                    }
                );


                /*
                 app.jsとの互換用。
                 Firestoreを正として、
                 localStorageにも同じ内容を保存。
                */

                localStorage.setItem(
                    "classSelections",
                    JSON.stringify(
                        mergedSelections
                    )
                );


                overlay.classList.remove(
                    "show"
                );


                overlay.hidden =
                    true;


                location.reload();

            } catch (error) {

                console.error(
                    "クラス選択保存エラー:",
                    error
                );


                alert(
                    "クラス選択を保存できませんでした。"
                );

            } finally {

                save.disabled =
                    false;


                save.textContent =
                    "保存";

            }

        };

}


/* ========================================
   クラス抽出
======================================== */

export function extractClassGroups(
    value
) {

    if (!value) {
        return [];
    }


    const original =
        toHalfWidthAlphabet(
            String(value)
        )
        .toUpperCase();


    const text =
        original
            .replaceAll(
                "クラス",
                ""
            )
            .replaceAll(
                "組",
                ""
            )
            .replaceAll(
                "班",
                ""
            )
            .trim();


    if (!text) {
        return [];
    }


    const groups =
        [];


    /*
     A〜D
     A-D
     A～D
    */

    for (
        const match of
        text.matchAll(
            /([A-Z])\s*[-〜～]\s*([A-Z])/g
        )
    ) {

        const start =
            match[1]
                .charCodeAt(0);


        const end =
            match[2]
                .charCodeAt(0);


        if (start <= end) {

            for (
                let code = start;
                code <= end;
                code++
            ) {

                groups.push(
                    String.fromCharCode(
                        code
                    )
                );

            }

        }

    }


    /*
     A/B/C
     A・B
     A,B
     Aクラス単独
    */

    groups.push(
        ...(
            text.match(
                /[A-Z]/g
            ) || []
        )
    );


    return [
        ...new Set(groups)
    ];

}


/* ========================================
   値正規化
======================================== */

function normalizeSelectedValue(
    value
) {

    if (
        value ===
        CLASS_SELECTION_NONE
    ) {

        return CLASS_SELECTION_NONE;

    }


    const raw =

        typeof value === "string"

            ? value

            : value?.classGroup ||
              value?.class ||
              value?.value ||
              "";


    if (
        raw ===
        CLASS_SELECTION_NONE
    ) {

        return CLASS_SELECTION_NONE;

    }


    const groups =
        extractClassGroups(
            raw
        );


    return groups[0] || "";

}


/* ========================================
   補助
======================================== */

function normalizeText(
    value
) {

    return String(
        value || ""
    ).trim();

}


function normalizeDate(
    value
) {

    const text =
        normalizeText(
            value
        );


    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            text
        )
    ) {

        return text;

    }


    return text;

}


function normalizePeriod(
    value
) {

    const text =
        normalizeText(
            value
        );


    const match =
        text.match(
            /\d+/
        );


    return match
        ? match[0]
        : text;

}


function formatPeriod(
    value
) {

    const period =
        normalizePeriod(
            value
        );


    return period
        ? `${period}限`
        : "";

}


function toHalfWidthAlphabet(
    value
) {

    return String(
        value || ""
    ).replace(
        /[Ａ-Ｚａ-ｚ]/g,
        character =>
            String.fromCharCode(
                character.charCodeAt(0) -
                0xFEE0
            )
    );

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ========================================
   初期化
======================================== */

export function setupClassSelection() {

    /*
     現状はHTMLイベントを
     checkClassSelectionRequired()
     呼び出し時に設定するため、
     初期化処理は不要。
    */

}