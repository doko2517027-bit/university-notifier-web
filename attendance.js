import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    initializePage,
    setupAdminTab,
    setupOfflineAlert,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge,
    setupAttendanceWebPush
} from "./common.js";

import {
    loadPersonalTimetableData,
    isEnrolledScheduleItem
} from "./personal_timetable_data.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    classifyStartStamp,
    classifyEndStamp,
    getAttendanceActionState,
    ATTENDANCE_STATUS
} from "./attendance_rules.js";

import {
    ATTENDANCE_STAMP_SOURCE,
    normalizeAttendanceLecture,
    createAttendanceRecordId,
    recalculateAttendanceStatus,
    stampAttendanceStart,
    stampAttendanceEnd,
    stampAttendanceEarlyLeave,
    markAttendanceAbsent
} from "./attendance_stamp.js";

import {
    VERSION
} from "./version.js";


/* ========================================
   DOM
======================================== */

const el = {

    back:
        document.getElementById(
            "backButton"
        ),

    theme:
        document.getElementById(
            "themeButton"
        ),

    profile:
        document.getElementById(
            "profileButton"
        ),

    image:
        document.getElementById(
            "topProfileImage"
        ),

    version:
        document.getElementById(
            "version"
        ),

    date:
        document.getElementById(
            "attendanceCurrentDate"
        ),

    time:
        document.getElementById(
            "attendanceCurrentTime"
        ),

    currentStatus:
        document.getElementById(
            "attendanceCurrentStatus"
        ),

    notificationState:
        document.getElementById(
            "attendanceNotificationState"
        ),

    enableNotifications:
        document.getElementById(
            "enableAttendanceNotifications"
        ),

    refresh:
        document.getElementById(
            "attendanceRefreshButton"
        ),

    todayList:
        document.getElementById(
            "attendanceTodayList"
        ),

    empty:
        document.getElementById(
            "attendanceEmptyState"
        ),

    recordList:
        document.getElementById(
            "attendanceRecordList"
        ),

    present:
        document.getElementById(
            "attendanceSummaryPresent"
        ),

    late:
        document.getElementById(
            "attendanceSummaryLate"
        ),

    early:
        document.getElementById(
            "attendanceSummaryEarlyLeave"
        ),

    absent:
        document.getElementById(
            "attendanceSummaryAbsent"
        ),

    pending:
        document.getElementById(
            "attendanceSummaryPending"
        ),

    confirmOverlay:
        document.getElementById(
            "attendanceConfirmOverlay"
        ),

    confirmIcon:
        document.getElementById(
            "attendanceConfirmIcon"
        ),

    confirmTitle:
        document.getElementById(
            "attendanceConfirmTitle"
        ),

    confirmSubject:
        document.getElementById(
            "attendanceConfirmSubject"
        ),

    confirmDetail:
        document.getElementById(
            "attendanceConfirmDetail"
        ),

    confirmButton:
        document.getElementById(
            "attendanceConfirmButton"
        ),

    cancelButton:
        document.getElementById(
            "attendanceCancelButton"
        ),

    resultOverlay:
        document.getElementById(
            "attendanceResultOverlay"
        ),

    resultIcon:
        document.getElementById(
            "attendanceResultIcon"
        ),

    resultLabel:
        document.getElementById(
            "attendanceResultLabel"
        ),

    resultTitle:
        document.getElementById(
            "attendanceResultTitle"
        ),

    resultStatus:
        document.getElementById(
            "attendanceResultStatus"
        ),

    resultMessage:
        document.getElementById(
            "attendanceResultMessage"
        ),

    resultClose:
        document.getElementById(
            "attendanceResultClose"
        ),

    resultHome:
        document.getElementById(
            "attendanceResultHome"
        ),

    toast:
        document.getElementById(
            "attendanceToast"
        )

};


/* ========================================
   状態
======================================== */

let effectiveDate =
    localDateKey();

let userData = {};

let lectures = [];

let records =
    new Map();

let missingClasses = [];

let pendingAction =
    null;

let loading =
    false;

let toastTimer =
    null;


/* ========================================
   初期化
======================================== */

if (
    localStorage.getItem("loggedIn") !== "true" ||
    !studentNumber
) {

    location.href =
        "login.html";

} else {

    setupTheme(
        el.theme
    );

    setupOfflineAlert();

    setupEvents();

    startClock();

    await initializePage([

        setupAdminTab(),

        loadProfileImage(
            el.image
        ),

        updateAssignmentNavBadge(),

        updateShareNavBadge(),

        updateNewsNavBadge(),

        initializeAttendance()

    ]);

}


/* ========================================
   イベント
======================================== */

function setupEvents() {

    el.back.onclick = () => {

        if (
            history.length > 1
        ) {

            history.back();

        } else {

            location.href =
                "index.html";

        }

    };


    el.profile.onclick = () => {

        location.href =
            "profile.html";

    };


    el.version.textContent =
        `Version ${VERSION}`;


    el.refresh.onclick = () => {

        refreshAttendance();

    };


    el.enableNotifications.onclick =
        enableNotifications;


    el.cancelButton.onclick =
        closeConfirmation;


    el.confirmButton.onclick =
        executeAction;


    el.resultClose.onclick = () => {

        closeOverlay(
            el.resultOverlay
        );

    };


    el.resultHome.onclick = () => {

        location.href =
            "index.html";

    };


    el.todayList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-attendance-action]"
                );

            if (!button) {
                return;
            }


            const action =
                button.dataset
                    .attendanceAction || "";


            if (
                action === "open_home"
            ) {

                location.href =
                    "index.html";

                return;

            }


            const lecture =
                lectures[
                    Number(
                        button.dataset
                            .lectureIndex
                    )
                ];


            if (!lecture) {
                return;
            }


            openConfirmation(
                action,
                lecture
            );

        }
    );


    document.addEventListener(
        "visibilitychange",
        () => {

            if (!document.hidden) {

                refreshAttendance(
                    true
                );

            }

        }
    );

}


/* ========================================
   ページ読み込み
======================================== */

async function initializeAttendance() {

    updateNotificationState();

    await loadAttendanceData();

    renderAll();


    setInterval(
        () => {

            renderLectureCards();

            updateCurrentLectureStatus();

        },
        30 * 1000
    );

}


async function refreshAttendance(
    silent = false
) {

    if (loading) {
        return;
    }


    try {

        setRefreshState(
            true
        );


        await loadAttendanceData();

        renderAll();


        if (!silent) {

            showToast(
                "出席情報を更新しました。"
            );

        }

    } catch (error) {

        console.error(
            "出席情報更新エラー:",
            error
        );


        showToast(
            "出席情報を更新できませんでした。"
        );

    } finally {

        setRefreshState(
            false
        );

    }

}


/* ========================================
   データ取得
======================================== */

async function loadAttendanceData() {

    loading = true;


    try {

        const [
            userSnap,
            personalTimetable
        ] = await Promise.all([

            getDoc(
                doc(
                    db,
                    "users",
                    studentNumber
                )
            ),

            loadPersonalTimetableData()

        ]);


        userData =
            userSnap.exists()
                ? userSnap.data()
                : {};


        effectiveDate =
            resolveEffectiveDate(
                userData
            );


        const scheduleId =
            resolveScheduleId(
                userData
            );


        if (!scheduleId) {

            throw new Error(
                "対応する時間割がありません。"
            );

        }


        const scheduleSnap =
            await getDoc(
                doc(
                    db,
                    "schedule",
                    scheduleId
                )
            );


        const aliases =
            personalTimetable
                ?.aliasToCourse ||
            new Map();


        const rawLectures =
            scheduleSnap.exists()
                ? extractLectures(
                    scheduleSnap.data(),
                    effectiveDate,
                    scheduleId
                )
                : [];


        const enrolled =
            rawLectures.filter(
                item =>
                    isEnrolledScheduleItem(
                        item,
                        aliases
                    )
            );


        const classResult =
            buildStudentLectures(

                enrolled,

                userData
                    .classSelections || {},

                effectiveDate,

                scheduleId

            );


        lectures =
            classResult.lectures;


        missingClasses =
            classResult.missing;


        await loadRecords();

    } finally {

        loading = false;

    }

}


/* ========================================
   時間割取得
======================================== */

function resolveScheduleId(
    data
) {

    const department =
        normalizeText(
            data.department ||
            localStorage.getItem(
                "department"
            )
        );


    const major =
        normalizeText(
            data.major ||
            localStorage.getItem(
                "major"
            )
        );


    if (
        department ===
        "看護学科"
    ) {

        return "ns_yamate";

    }


    if (
        major ===
        "理学療法学専攻"
    ) {

        return "pt";

    }


    if (
        major ===
        "作業療法学専攻"
    ) {

        return "ot";

    }


    return "";

}


function extractLectures(
    data,
    date,
    scheduleId
) {

    const days =
        Array.isArray(data.allDays) &&
        data.allDays.length
            ? data.allDays
            : data.days;


    if (
        Array.isArray(days) &&
        days.length
    ) {

        return days

            .filter(
                day =>
                    normalizeDate(
                        day.date
                    ) === date
            )

            .flatMap(
                day =>
                    Array.isArray(
                        day.schedules
                    )
                        ? day.schedules.map(
                            item => ({

                                ...item,

                                date,

                                scheduleDocumentId:
                                    scheduleId

                            })
                        )
                        : []
            );

    }


    return (
        Array.isArray(data.today)
            ? data.today
            : []
    ).map(
        item => ({

            ...item,

            date,

            scheduleDocumentId:
                scheduleId

        })
    );

}


/* ========================================
   クラス選択反映
======================================== */

function buildStudentLectures(
    source,
    selections,
    date,
    scheduleId
) {

    const groups =
        new Map();


    for (
        const item of source
    ) {

        const subject =
            normalizeText(
                item.subject ||
                item.name ||
                item.title
            );


        const period =
            normalizePeriod(
                item.period
            );


        if (
            !subject ||
            !period
        ) {

            continue;

        }


        const key =
            `${date}|${subject}|${period}`;


        if (
            !groups.has(key)
        ) {

            groups.set(
                key,
                {

                    date,

                    subject,

                    period,

                    rows: [],

                    options:
                        new Set()

                }
            );

        }


        const group =
            groups.get(key);


        const row = {

            ...item,

            date,

            subject,

            period,

            scheduleDocumentId:
                scheduleId

        };


        group.rows.push(
            row
        );


        extractClassGroups(
            row.classGroup
        ).forEach(
            value =>
                group.options.add(
                    value
                )
        );

    }


    const result = [];

    const missing = [];


    for (
        const group of
        groups.values()
    ) {

        const options =
            [...group.options]
                .sort();


        const selected =
            resolveSelectedClass(

                selections,

                group.date,

                group.subject,

                group.period

            );


        if (
            options.length > 1 &&
            !selected
        ) {

            missing.push({

                date:
                    group.date,

                subject:
                    group.subject,

                period:
                    group.period,

                options

            });


            continue;

        }


        const matchingRows =
            group.rows.filter(
                row => {

                    const rowGroups =
                        extractClassGroups(
                            row.classGroup
                        );


                    if (
                        options.length <= 1 ||
                        rowGroups.length === 0
                    ) {

                        return true;

                    }


                    return rowGroups.includes(
                        selected
                    );

                }
            );


        if (
            !matchingRows.length
        ) {

            continue;

        }


        const preferred =
            matchingRows.find(
                row =>
                    extractClassGroups(
                        row.classGroup
                    ).includes(
                        selected
                    )
            ) ||
            matchingRows[0];


        result.push({

            ...mergeRows(
                matchingRows,
                preferred
            ),

            date:
                group.date,

            subject:
                group.subject,

            period:
                group.period,

            selectedClassGroup:
                selected ||
                options[0] ||
                "",

            classOptions:
                options,

            scheduleDocumentId:
                scheduleId

        });

    }


    result.sort(
        (left, right) =>

            Number(left.period) -
            Number(right.period) ||

            String(
                left.startTime || ""
            ).localeCompare(
                String(
                    right.startTime || ""
                )
            )
    );


    return {

        lectures:
            result,

        missing

    };

}


function mergeRows(
    rows,
    preferred
) {

    const merged = {

        ...rows[0],

        ...preferred

    };


    const fields = [

        "subjectId",

        "subjectKey",

        "startTime",

        "endTime",

        "teacher",

        "building",

        "room"

    ];


    for (
        const field of fields
    ) {

        if (
            normalizeText(
                merged[field]
            )
        ) {

            continue;

        }


        const row =
            rows.find(
                item =>
                    normalizeText(
                        item[field]
                    )
            );


        if (row) {

            merged[field] =
                row[field];

        }

    }


    return merged;

}


function resolveSelectedClass(
    selections,
    date,
    subject,
    period
) {

    const slashDate =
        date.replaceAll(
            "-",
            "/"
        );


    const keys = [

        `${subject}_${date}_${period}`,

        `${subject}_${slashDate}_${period}`,

        `${subject}_${date}_${period}限`,

        `${subject}__${period}`,

        `${date}_${subject}_${period}`,

        [
            encodeURIComponent(date),
            encodeURIComponent(subject),
            encodeURIComponent(
                String(period)
            )
        ].join("__")

    ];


    for (
        const key of keys
    ) {

        const value =
            selections[key];


        const selected =
            normalizeSelection(
                value
            );


        if (selected) {

            return selected;

        }

    }


    return "";

}


function normalizeSelection(
    value
) {

    if (
        value &&
        typeof value === "object"
    ) {

        return normalizeSelection(

            value.classGroup ||

            value.class ||

            value.value

        );

    }


    return (
        extractClassGroups(
            value
        )[0] ||
        ""
    );

}


function extractClassGroups(
    value
) {

    if (!value) {
        return [];
    }


    const original =
        toHalfWidth(
            String(value)
                .toUpperCase()
                .trim()
        );


    if (
        /^(全員|共通|合同|指定なし|なし|ALL)$/i
            .test(original)
    ) {

        return [];

    }


    const groups =
        new Set();


    const rangePattern =
        /([A-Z])\s*[-–—〜～]\s*([A-Z])/g;


    for (
        const match of
        original.matchAll(
            rangePattern
        )
    ) {

        const start =
            match[1]
                .charCodeAt(0);


        const end =
            match[2]
                .charCodeAt(0);


        for (
            let code = start;
            code <= end;
            code++
        ) {

            groups.add(
                String.fromCharCode(
                    code
                )
            );

        }

    }


    const cleaned =
        original

            .replace(
                rangePattern,
                ""
            )

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
            );


    (
        cleaned.match(
            /[A-Z]/g
        ) || []
    ).forEach(
        group =>
            groups.add(
                group
            )
    );


    return [...groups]
        .sort();

}


/* ========================================
   出席記録取得
======================================== */

async function loadRecords() {

    const snap =
        await getDocs(
            query(

                collection(
                    db,
                    "users",
                    studentNumber,
                    "attendanceRecords"
                ),

                where(
                    "date",
                    "==",
                    effectiveDate
                )

            )
        );


    records =
        new Map(
            snap.docs.map(
                item => [

                    item.id,

                    {

                        id:
                            item.id,

                        ...item.data()

                    }

                ]
            )
        );

}


/* ========================================
   描画
======================================== */

function renderAll() {

    renderDate();

    renderLectureCards();

    renderSummary();

    renderRecordList();

    updateCurrentLectureStatus();

}


function renderDate() {

    const date =
        createDate(
            effectiveDate
        );


    const formatted =
        new Intl.DateTimeFormat(
            "ja-JP",
            {

                year:
                    "numeric",

                month:
                    "long",

                day:
                    "numeric",

                weekday:
                    "short"

            }
        ).format(
            date
        );


    const test =
        userData
            .attendanceTestClock ||
        {};


    const testActive =
        test.enabled === true &&

        normalizeDate(
            test.date
        ) === effectiveDate &&

        Date.parse(
            test.expiresAt || ""
        ) > Date.now();


    el.date.textContent =
        testActive
            ? `${formatted}（表示テスト）`
            : formatted;

}


function renderLectureCards() {

    if (
        !lectures.length
    ) {

        el.todayList.innerHTML =
            missingClasses.length
                ? renderMissingClassCard()
                : "";


        el.empty.hidden =
            missingClasses.length > 0;


        return;

    }


    el.empty.hidden =
        true;


    const cards =
        lectures.map(
            (lecture, index) =>
                renderLectureCard(
                    lecture,
                    index
                )
        );


    if (
        missingClasses.length
    ) {

        cards.unshift(
            renderMissingClassCard()
        );

    }


    el.todayList.innerHTML =
        cards.join("");

}


function renderLectureCard(
    lecture,
    index
) {

    let normalized;


    try {

        normalized =
            normalizeAttendanceLecture(
                lecture
            );

    } catch (error) {

        console.error(
            "講義情報変換エラー:",
            lecture,
            error
        );


        return `
            <div class="card setting-card">

                <h3>
                    ${escapeHtml(
                        lecture.subject ||
                        "科目名なし"
                    )}
                </h3>

                <p>
                    講義時間を確認できないため打刻できません。
                </p>

            </div>
        `;

    }


    const recordId =
        createAttendanceRecordId(
            normalized
        );


    const record =
        records.get(
            recordId
        ) ||
        null;


    const finalResult =
        resolveResult(
            record
        );


    const state =
        getAttendanceActionState({

            now:
                new Date(),

            lecture:
                normalized
                    .lectureWindow

        });


    const hasStart =
        Boolean(

            record?.startStampedAt ||

            record?.startKind

        );


    const hasEnd =
        Boolean(

            record?.endStampedAt ||

            record?.endKind

        );


    const absent =
        record?.absenceTapped === true ||

        finalResult.status ===
            ATTENDANCE_STATUS
                .ABSENT;


    const canStart =
        state.canStartStamp &&

        !hasStart &&

        !hasEnd &&

        !absent;


    const canAbsent =
        state.canMarkAbsent &&

        !hasStart &&

        !hasEnd &&

        !absent;


    const canEarly =
        state.canTapEarlyLeave &&

        hasStart &&

        !hasEnd &&

        !absent;


    const canEnd =
        state.canEndStamp &&

        hasStart &&

        !hasEnd &&

        !absent;


    const classText =
        normalized.classGroup
            ? `${normalized.classGroup}クラス`
            : "クラス指定なし";


    const roomText = [

        normalized.building,

        normalized.room

    ]
        .filter(Boolean)
        .join(" ");


    return `
        <article
            class="card setting-card attendance-lecture-card">

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                    align-items:flex-start;
                ">

                <div>

                    <p
                        style="
                            margin:0 0 5px;
                            color:var(--subtext);
                            font-size:13px;
                        ">

                        ${normalized.period}限・
                        ${escapeHtml(normalized.startTime)}
                        〜
                        ${escapeHtml(normalized.endTime)}

                    </p>

                    <h3 style="margin:0;">

                        ${escapeHtml(
                            normalized.subject
                        )}

                    </h3>

                </div>

                ${statusBadge(
                    finalResult
                )}

            </div>


            <p style="margin:12px 0 5px;">

                <b>クラス：</b>

                ${escapeHtml(
                    classText
                )}

            </p>


            ${
                roomText
                    ? `
                        <p style="margin:5px 0;">

                            <b>教室：</b>

                            ${escapeHtml(
                                roomText
                            )}

                        </p>
                    `
                    : ""
            }


            ${
                normalized.teacher
                    ? `
                        <p style="margin:5px 0;">

                            <b>担当：</b>

                            ${escapeHtml(
                                normalized.teacher
                            )}

                        </p>
                    `
                    : ""
            }


            ${stampDetails(
                record
            )}


            <p
                style="
                    margin:13px 0;
                    color:var(--subtext);
                    font-size:13px;
                    line-height:1.6;
                ">

                ${escapeHtml(
                    guidance(
                        normalized,
                        record,
                        finalResult,
                        state
                    )
                )}

            </p>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            2,
                            minmax(0,1fr)
                        );
                    gap:10px;
                ">

                <button
                    type="button"
                    class="btn btn-primary"
                    data-attendance-action="start"
                    data-lecture-index="${index}"
                    ${canStart ? "" : "disabled"}>

                    ▶ 開始打刻

                </button>


                <button
                    type="button"
                    class="btn btn-secondary"
                    data-attendance-action="absent"
                    data-lecture-index="${index}"
                    ${canAbsent ? "" : "disabled"}>

                    ✕ 欠席

                </button>


                <button
                    type="button"
                    class="btn btn-danger"
                    data-attendance-action="early_leave"
                    data-lecture-index="${index}"
                    ${canEarly ? "" : "disabled"}>

                    ↪ 早退

                </button>


                <button
                    type="button"
                    class="btn btn-primary"
                    data-attendance-action="end"
                    data-lecture-index="${index}"
                    ${canEnd ? "" : "disabled"}>

                    ■ 終了打刻

                </button>

            </div>

        </article>
    `;

}


function renderMissingClassCard() {

    const list =
        missingClasses.map(
            item => `

                <li>

                    ${item.period}限

                    ${escapeHtml(
                        item.subject
                    )}

                    （${escapeHtml(
                        item.options.join("・")
                    )}）

                </li>

            `
        ).join("");


    return `
        <div class="card setting-card">

            <h3>
                🏫 クラス選択が必要です
            </h3>

            <p>
                自分のクラスが未選択の講義は、
                打刻対象にできません。
            </p>

            <ul
                style="
                    padding-left:20px;
                    line-height:1.8;
                ">

                ${list}

            </ul>

            <button
                type="button"
                class="btn btn-primary"
                data-attendance-action="open_home">

                ホームでクラスを選択

            </button>

        </div>
    `;

}


/* ========================================
   集計
======================================== */

function renderSummary() {

    const count = {

        present: 0,

        late: 0,

        early: 0,

        absent: 0,

        pending: 0

    };


    for (
        const lecture of lectures
    ) {

        let record;


        try {

            record =
                records.get(
                    createAttendanceRecordId(
                        lecture
                    )
                ) ||
                null;

        } catch {

            count.pending++;

            continue;

        }


        const result =
            resolveResult(
                record
            );


        switch (
            result.status
        ) {

            case ATTENDANCE_STATUS
                .PRESENT:

                count.present++;

                break;


            case ATTENDANCE_STATUS
                .LATE:

                count.late++;

                break;


            case ATTENDANCE_STATUS
                .EARLY_LEAVE:

                count.early++;

                break;


            case ATTENDANCE_STATUS
                .LATE_AND_EARLY_LEAVE:

                count.late++;

                count.early++;

                break;


            case ATTENDANCE_STATUS
                .ABSENT:

                count.absent++;

                break;


            default:

                count.pending++;

        }

    }


    el.present.textContent =
        count.present;


    el.late.textContent =
        count.late;


    el.early.textContent =
        count.early;


    el.absent.textContent =
        count.absent;


    el.pending.textContent =
        count.pending;

}


/* ========================================
   記録一覧
======================================== */

function renderRecordList() {

    const rows =
        [...records.values()]
            .sort(
                (left, right) =>

                    Number(
                        left.period || 0
                    ) -

                    Number(
                        right.period || 0
                    )
            );


    if (
        !rows.length
    ) {

        el.recordList.innerHTML = `
            <div class="card setting-card">

                今日の打刻記録はまだありません。

            </div>
        `;

        return;

    }


    el.recordList.innerHTML =
        rows.map(
            record => {

                const result =
                    resolveResult(
                        record
                    );


                return `
                    <div class="card setting-card">

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                gap:12px;
                                align-items:flex-start;
                            ">

                            <div>

                                <b>

                                    ${escapeHtml(
                                        record.period ||
                                        "-"
                                    )}限

                                    ${escapeHtml(
                                        record.subject ||
                                        "科目名なし"
                                    )}

                                </b>

                                <p
                                    style="
                                        margin:7px 0 0;
                                        color:var(--subtext);
                                        font-size:13px;
                                    ">

                                    開始：
                                    ${escapeHtml(
                                        formatTimestamp(
                                            record.startStampedAt
                                        )
                                    )}

                                    <br>

                                    終了：
                                    ${escapeHtml(
                                        formatTimestamp(
                                            record.endStampedAt
                                        )
                                    )}

                                </p>

                            </div>

                            ${statusBadge(
                                result
                            )}

                        </div>

                    </div>
                `;

            }
        ).join("");

}


/* ========================================
   判定表示
======================================== */

function resolveResult(
    record
) {

    if (!record) {

        return {

            status:
                ATTENDANCE_STATUS
                    .PENDING,

            label:
                "未打刻",

            finalized:
                false

        };

    }


    try {

        return recalculateAttendanceStatus(
            record
        );

    } catch (error) {

        console.error(
            "出席再判定エラー:",
            error
        );


        return {

            status:
                record.status ||
                ATTENDANCE_STATUS
                    .PENDING,

            label:
                record.statusLabel ||
                "判定待ち",

            finalized:
                record
                    .statusFinalized === true

        };

    }

}


function statusBadge(
    result
) {

    const style =
        statusStyle(
            result.status
        );


    return `
        <span
            style="
                display:inline-flex;
                min-width:72px;
                justify-content:center;
                padding:6px 10px;
                border-radius:999px;
                font-size:12px;
                font-weight:900;
                background:${style.background};
                color:${style.color};
            ">

            ${escapeHtml(
                result.label
            )}

        </span>
    `;

}


function statusStyle(
    status
) {

    if (
        status ===
        ATTENDANCE_STATUS.PRESENT
    ) {

        return {

            background:
                "#dcfce7",

            color:
                "#166534"

        };

    }


    if (
        status ===
        ATTENDANCE_STATUS.LATE
    ) {

        return {

            background:
                "#fef3c7",

            color:
                "#92400e"

        };

    }


    if (
        status ===
        ATTENDANCE_STATUS
            .EARLY_LEAVE
    ) {

        return {

            background:
                "#ffedd5",

            color:
                "#9a3412"

        };

    }


    if (
        status ===
        ATTENDANCE_STATUS
            .LATE_AND_EARLY_LEAVE
    ) {

        return {

            background:
                "#fce7f3",

            color:
                "#9d174d"

        };

    }


    if (
        status ===
        ATTENDANCE_STATUS.ABSENT
    ) {

        return {

            background:
                "#fee2e2",

            color:
                "#991b1b"

        };

    }


    return {

        background:
            "#e2e8f0",

        color:
            "#334155"

    };

}


function stampDetails(
    record
) {

    return `
        <div
            style="
                margin-top:12px;
                padding:10px 12px;
                border-radius:10px;
                background:
                    var(
                        --card-bg,
                        #f4f6fa
                    );
                font-size:13px;
                line-height:1.7;
            ">

            開始：
            ${escapeHtml(
                formatTimestamp(
                    record?.startStampedAt
                )
            )}

            ${
                record?.startLabel
                    ? `（${escapeHtml(
                        record.startLabel
                    )}）`
                    : ""
            }

            <br>

            終了：
            ${escapeHtml(
                formatTimestamp(
                    record?.endStampedAt
                )
            )}

            ${
                record?.endLabel
                    ? `（${escapeHtml(
                        record.endLabel
                    )}）`
                    : ""
            }

        </div>
    `;

}


function guidance(
    normalized,
    record,
    result,
    state
) {

    if (
        result.status ===
        ATTENDANCE_STATUS.ABSENT
    ) {

        return (
            "欠席として記録されています。" +
            "変更が必要な場合は管理者へ確認してください。"
        );

    }


    if (
        record?.endStampedAt ||
        record?.endKind
    ) {

        return (
            "開始・終了打刻が完了しています。"
        );

    }


    if (
        record?.startStampedAt ||
        record?.startKind
    ) {

        if (
            state.canEndStamp
        ) {

            return (
                "終了打刻が可能です。" +
                "講義終了後10分までに押してください。"
            );

        }


        if (
            state.canTapEarlyLeave
        ) {

            return (
                "途中で退出する場合は早退を押してください。"
            );

        }


        return (
            "開始打刻済みです。" +
            "終了打刻の開始時刻までお待ちください。"
        );

    }


    if (
        state.canStartStamp
    ) {

        return classifyStartStamp({

            stampAt:
                new Date(),

            lecture:
                normalized
                    .lectureWindow

        }).message;

    }


    if (
        Date.now() <
        normalized
            .lectureWindow
            .startNotificationAt
            .getTime()
    ) {

        return (
            `開始打刻は` +
            `${formatTime(
                normalized
                    .lectureWindow
                    .startNotificationAt
            )}から可能です。`
        );

    }


    return (
        "打刻期限が終了しています。"
    );

}


/* ========================================
   現在の講義
======================================== */

function updateCurrentLectureStatus() {

    if (
        !lectures.length
    ) {

        el.currentStatus.textContent =
            missingClasses.length
                ? (
                    "クラス選択が完了すると" +
                    "打刻対象の講義が表示されます。"
                )
                : (
                    "今日の履修済み講義はありません。"
                );


        return;

    }


    const now =
        new Date();


    const active =
        lectures.find(
            lecture => {

                try {

                    const item =
                        normalizeAttendanceLecture(
                            lecture
                        );


                    return (

                        now >=
                        item
                            .lectureWindow
                            .startNotificationAt &&

                        now <=
                        item
                            .lectureWindow
                            .endStampExpiresAt

                    );

                } catch {

                    return false;

                }

            }
        );


    if (active) {

        el.currentStatus.textContent =
            `現在の打刻対象：` +
            `${active.period}限 ` +
            `${active.subject}`;


        return;

    }


    const next =
        lectures.find(
            lecture => {

                try {

                    return (
                        normalizeAttendanceLecture(
                            lecture
                        )
                            .lectureWindow
                            .startNotificationAt >
                        now
                    );

                } catch {

                    return false;

                }

            }
        );


    el.currentStatus.textContent =
        next
            ? (
                `次の講義：` +
                `${next.period}限 ` +
                `${next.subject}`
            )
            : (
                "今日の打刻可能な講義は終了しました。"
            );

}


/* ========================================
   確認ポップアップ
======================================== */

function openConfirmation(
    action,
    lecture
) {

    let normalized;


    try {

        normalized =
            normalizeAttendanceLecture(
                lecture
            );

    } catch {

        showToast(
            "講義情報を確認できませんでした。"
        );

        return;

    }


    const content =
        confirmationContent(
            action,
            normalized
        );


    if (!content) {
        return;
    }


    pendingAction = {

        action,

        lecture

    };


    el.confirmIcon.textContent =
        content.icon;


    el.confirmTitle.textContent =
        content.title;


    el.confirmSubject.textContent =
        `${normalized.period}限 ` +
        `${normalized.subject}`;


    el.confirmDetail.textContent =
        content.detail;


    el.confirmButton.textContent =
        content.button;


    openOverlay(
        el.confirmOverlay
    );

}


function confirmationContent(
    action,
    normalized
) {

    if (
        action === "start"
    ) {

        const result =
            classifyStartStamp({

                stampAt:
                    new Date(),

                lecture:
                    normalized
                        .lectureWindow

            });


        return {

            icon:
                "▶",

            title:
                "開始打刻しますか？",

            detail:
                `現在の時刻では「${result.label}」として記録されます。`,

            button:
                "開始打刻する"

        };

    }


    if (
        action === "end" ||
        action === "early_leave"
    ) {

        const result =
            classifyEndStamp({

                stampAt:
                    new Date(),

                lecture:
                    normalized
                        .lectureWindow

            });


        return {

            icon:
                action === "early_leave"
                    ? "↪"
                    : "■",

            title:
                action === "early_leave"
                    ? "退出を打刻しますか？"
                    : "終了打刻しますか？",

            detail:
                `実際の打刻時刻により「${result.label}」として記録されます。`,

            button:
                action === "early_leave"
                    ? "退出を打刻する"
                    : "終了打刻する"

        };

    }


    if (
        action === "absent"
    ) {

        return {

            icon:
                "✕",

            title:
                "欠席として登録しますか？",

            detail:
                "欠席を押すと、この講義は欠席として確定します。",

            button:
                "欠席を確定する"

        };

    }


    return null;

}


/* ========================================
   打刻実行
======================================== */

async function executeAction() {

    if (!pendingAction) {
        return;
    }


    const {
        action,
        lecture
    } = pendingAction;


    const original =
        el.confirmButton
            .textContent;


    el.confirmButton.disabled =
        true;


    el.confirmButton.textContent =
        "保存中...";


    try {

        const source =
            ATTENDANCE_STAMP_SOURCE
                .ATTENDANCE_PAGE;


        let result;


        if (
            action === "start"
        ) {

            result =
                await stampAttendanceStart({

                    lecture,

                    source

                });

        }


        if (
            action === "end"
        ) {

            result =
                await stampAttendanceEnd({

                    lecture,

                    source

                });

        }


        if (
            action === "early_leave"
        ) {

            result =
                await stampAttendanceEarlyLeave({

                    lecture,

                    source

                });

        }


        if (
            action === "absent"
        ) {

            result =
                await markAttendanceAbsent({

                    lecture,

                    source

                });

        }


        closeConfirmation();


        if (
            result?.ok
        ) {

            await loadRecords();

            renderAll();

        }


        showResult(

            result?.ok === true,

            result || {

                message:
                    "処理を完了できませんでした。"

            }

        );

    } catch (error) {

        console.error(
            "出席操作エラー:",
            error
        );


        closeConfirmation();


        showResult(
            false,
            {

                message:
                    "打刻を保存できませんでした。"

            }
        );

    } finally {

        el.confirmButton.disabled =
            false;


        el.confirmButton.textContent =
            original ||
            "打刻する";

    }

}


function closeConfirmation() {

    closeOverlay(
        el.confirmOverlay
    );


    pendingAction =
        null;

}


function showResult(
    success,
    result
) {

    const label =

        result
            ?.finalResult
            ?.label ||

        result
            ?.judgement
            ?.label ||

        "";


    el.resultIcon.textContent =
        success
            ? "✅"
            : "⚠️";


    el.resultLabel.textContent =
        success
            ? "打刻結果"
            : "打刻できませんでした";


    el.resultTitle.textContent =
        success
            ? "記録しました"
            : "操作を確認してください";


    el.resultStatus.textContent =
        label;


    el.resultMessage.textContent =
        result?.message ||
        "処理を完了できませんでした。";


    openOverlay(
        el.resultOverlay
    );

}


/* ========================================
   通知
======================================== */

function updateNotificationState() {

    if (
        !(
            "Notification" in
            window
        )
    ) {

        el.notificationState.textContent =
            "このブラウザは通知に対応していません。";


        el.enableNotifications.hidden =
            true;


        return;

    }


    if (
        Notification.permission ===
        "granted"
    ) {

        el.notificationState.textContent =
            "出席通知は有効です。";


        el.enableNotifications.hidden =
            true;


        return;

    }


    if (
        Notification.permission ===
        "denied"
    ) {

        el.notificationState.textContent =
            "通知が拒否されています。端末の設定から許可してください。";


        el.enableNotifications.hidden =
            true;


        return;

    }


    el.notificationState.textContent =
        "出席通知はまだ有効になっていません。";


    el.enableNotifications.hidden =
        false;

}


async function enableNotifications() {

    const original =
        el.enableNotifications
            .textContent;


    el.enableNotifications.disabled =
        true;


    el.enableNotifications.textContent =
        "設定中...";


    try {

        await setupAttendanceWebPush();

        updateNotificationState();


        showToast(

            Notification.permission ===
            "granted"

                ? "出席通知を有効にしました。"

                : "通知の許可を完了できませんでした。"

        );

    } catch (error) {

        console.error(
            "出席通知設定エラー:",
            error
        );


        showToast(
            "出席通知を設定できませんでした。"
        );

    } finally {

        el.enableNotifications.disabled =
            false;


        el.enableNotifications.textContent =
            original ||
            "🔔 出席通知を有効にする";

    }

}


/* ========================================
   時計
======================================== */

function startClock() {

    const update = () => {

        el.time.textContent =
            new Intl.DateTimeFormat(
                "ja-JP",
                {

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit",

                    hour12:
                        false

                }
            ).format(
                new Date()
            );

    };


    update();


    setInterval(
        update,
        1000
    );

}


/* ========================================
   日付
======================================== */

function resolveEffectiveDate(
    data
) {

    const test =
        data
            ?.attendanceTestClock ||
        {};


    const testDate =
        normalizeDate(
            test.date
        );


    if (
        test.enabled === true &&

        testDate &&

        Date.parse(
            test.expiresAt || ""
        ) > Date.now()
    ) {

        return testDate;

    }


    return localDateKey();

}


function localDateKey(
    value = new Date()
) {

    const date =
        value instanceof Date
            ? value
            : new Date(value);


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        ),

        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )

    ].join("-");

}


function normalizeDate(
    value
) {

    if (!value) {
        return "";
    }


    if (
        value instanceof Date
    ) {

        return localDateKey(
            value
        );

    }


    const cleaned =
        String(value)

            .trim()

            .replace(
                /年|\.|\//g,
                "-"
            )

            .replace(
                /月/g,
                "-"
            )

            .replace(
                /日/g,
                ""
            )

            .replace(
                /-+/g,
                "-"
            );


    const full =
        cleaned.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (full) {

        return (
            `${full[1]}-` +
            `${full[2].padStart(2, "0")}-` +
            `${full[3].padStart(2, "0")}`
        );

    }


    const short =
        cleaned.match(
            /^(\d{1,2})-(\d{1,2})$/
        );


    if (short) {

        return (
            `${new Date().getFullYear()}-` +
            `${short[1].padStart(2, "0")}-` +
            `${short[2].padStart(2, "0")}`
        );

    }


    return "";

}


function createDate(
    key
) {

    const [
        year,
        month,
        day
    ] = key

        .split("-")

        .map(Number);


    return new Date(

        year,

        month - 1,

        day,

        12,

        0,

        0,

        0

    );

}


function normalizePeriod(
    value
) {

    const period =
        Number(
            String(value ?? "")

                .replace(
                    "限",
                    ""
                )

                .trim()
        );


    return Number.isInteger(
        period
    )
        ? period
        : 0;

}


/* ========================================
   時刻表示
======================================== */

function formatTimestamp(
    value
) {

    return (
        value &&
        typeof value.toDate ===
        "function"
    )
        ? formatTime(
            value.toDate()
        )
        : "未打刻";

}


function formatTime(
    value
) {

    const date =
        value instanceof Date
            ? value
            : new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--:--";

    }


    return (

        `${String(
            date.getHours()
        ).padStart(2, "0")}:` +

        `${String(
            date.getMinutes()
        ).padStart(2, "0")}`

    );

}


/* ========================================
   UI共通
======================================== */

function openOverlay(
    overlay
) {

    overlay.hidden =
        false;


    overlay.classList.add(
        "show"
    );


    overlay.style.zIndex =
        "100000";

}


function closeOverlay(
    overlay
) {

    overlay.classList.remove(
        "show"
    );


    overlay.hidden =
        true;

}


function setRefreshState(
    refreshing
) {

    el.refresh.disabled =
        refreshing;


    el.refresh.textContent =
        refreshing
            ? "更新中..."
            : "更新";

}


function showToast(
    message
) {

    el.toast.textContent =
        message;


    el.toast.hidden =
        false;


    el.toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                el.toast
                    .classList
                    .remove(
                        "show"
                    );


                el.toast.hidden =
                    true;

            },
            2600
        );

}


function normalizeText(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


function toHalfWidth(
    value
) {

    return String(value)
        .replace(
            /[Ａ-Ｚ]/g,
            character =>
                String.fromCharCode(

                    character
                        .charCodeAt(0) -

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
            "\"",
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}