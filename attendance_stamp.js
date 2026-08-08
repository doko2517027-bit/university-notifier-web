/* ========================================
   CareMate 出席打刻保存処理
======================================== */

import {
    db,
    studentNumber
} from "./common.js";


import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


import {

    createLectureWindow,

    classifyStartStamp,

    classifyEndStamp,

    determineAttendanceStatus,

    getAttendanceActionState,

    ATTENDANCE_STATUS

} from "./attendance_rules.js";


/* ========================================
   打刻元
======================================== */

export const ATTENDANCE_STAMP_SOURCE =
    Object.freeze({

        ATTENDANCE_PAGE:
            "attendance_page",

        START_NOTIFICATION:
            "start_notification",

        END_NOTIFICATION:
            "end_notification",

        HOME_POPUP:
            "home_popup"

    });


const ALLOWED_SOURCES =
    new Set(
        Object.values(
            ATTENDANCE_STAMP_SOURCE
        )
    );


/* ========================================
   講義情報の正規化
======================================== */

/**
 * 時限を数値に変換する。
 *
 * 例：
 * 1
 * "1"
 * "1限"
 */
function normalizePeriod(
    period
) {

    const result =
        Number(
            String(period ?? "")
                .replace("限", "")
                .trim()
        );


    if (
        !Number.isInteger(result) ||
        result < 1 ||
        result > 5
    ) {

        throw new Error(
            `時限が正しくありません: ${period}`
        );

    }


    return result;

}


/**
 * 文字列を整える。
 */
function normalizeText(
    value
) {

    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();

}


/**
 * 打刻元を正規化する。
 */
function normalizeSource(
    source
) {

    return ALLOWED_SOURCES.has(source)
        ? source
        : ATTENDANCE_STAMP_SOURCE
            .ATTENDANCE_PAGE;

}


/**
 * クラス名を整える。
 *
 * 例：
 * A
 * Aクラス
 */
function normalizeClassGroup(
    value
) {

    const text =
        normalizeText(value)
            .toUpperCase();


    if (!text) {
        return "";
    }


    const alphabet =
        text.match(/[A-Z]/);


    if (alphabet) {

        return alphabet[0];

    }


    return text
        .replace("クラス", "")
        .replace("組", "")
        .trim();

}


/**
 * 講義データを打刻用の形式に変換する。
 */
export function normalizeAttendanceLecture(
    lecture
) {

    if (
        !lecture ||
        typeof lecture !== "object"
    ) {

        throw new Error(
            "講義情報がありません。"
        );

    }


    const date =
        normalizeText(
            lecture.date
        );


    const subject =
        normalizeText(
            lecture.subject ||
            lecture.name ||
            lecture.title
        );


    const period =
        normalizePeriod(
            lecture.period
        );


    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(date)
    ) {

        throw new Error(
            "講義日が正しくありません。"
        );

    }


    if (!subject) {

        throw new Error(
            "科目名がありません。"
        );

    }


    const lectureWindow =
        createLectureWindow({

            date,

            period,

            startTime:
                normalizeText(
                    lecture.startTime
                ),

            endTime:
                normalizeText(
                    lecture.endTime
                )

        });


    return {

        date,

        subject,

        subjectId:
            normalizeText(
                lecture.subjectId
            ),

        subjectKey:
            normalizeText(
                lecture.subjectKey ||
                lecture.subjectId ||
                subject
            ),

        period,

        classGroup:
            normalizeClassGroup(
                lecture.selectedClassGroup ||
                lecture.classGroup ||
                lecture.class
            ),

        teacher:
            normalizeText(
                lecture.teacher
            ),

        building:
            normalizeText(
                lecture.building
            ),

        room:
            normalizeText(
                lecture.room
            ),

        scheduleDocumentId:
            normalizeText(
                lecture.scheduleDocumentId ||
                lecture.scheduleDocId
            ),

        attendanceNotificationTest:
            lecture.attendanceNotificationTest === true,

        startTime:
            lectureWindow.startTime,

        endTime:
            lectureWindow.endTime,

        lectureWindow

    };

}


/* ========================================
   出席記録ID
======================================== */

/**
 * 文字列から短いハッシュを作る。
 *
 * 科目名に「/」などが入っていても、
 * FirestoreのドキュメントIDとして安全に使える。
 */
function createShortHash(
    value
) {

    const text =
        String(value ?? "");


    let hash =
        2166136261;


    for (
        let index = 0;
        index < text.length;
        index++
    ) {

        hash ^=
            text.charCodeAt(index);


        hash =
            Math.imul(
                hash,
                16777619
            );

    }


    return (
        hash >>> 0
    ).toString(36);

}


/**
 * 同じ日・同じ時限・同じ科目は
 * 同一の出席記録にする。
 */
export function createAttendanceRecordId(
    lecture
) {

    const normalized =
        normalizeAttendanceLecture(
            lecture
        );


    const identity = [

        normalized.date,

        normalized.period,

        normalized.subjectKey

    ].join("|");


    const datePart =
        normalized.date
            .replaceAll("-", "");


    return [
        datePart,
        `${normalized.period}p`,
        createShortHash(identity)
    ].join("_");

}


/**
 * 出席記録のFirestore参照を作る。
 */
export function getAttendanceRecordReference(
    lecture
) {

    const resolvedStudentNumber =
        normalizeText(
            studentNumber
        );


    if (!resolvedStudentNumber) {

        throw new Error(
            "学籍番号を取得できませんでした。"
        );

    }


    const recordId =
        createAttendanceRecordId(
            lecture
        );


    return {

        recordId,

        reference:
            doc(
                db,
                "users",
                resolvedStudentNumber,
                "attendanceRecords",
                recordId
            )

    };

}


/* ========================================
   Firestore保存用共通データ
======================================== */

function createBaseRecord(
    lecture
) {

    const normalized =
        normalizeAttendanceLecture(
            lecture
        );


    const window =
        normalized.lectureWindow;


    return {

        schemaVersion: 1,

        studentNumber:
            normalizeText(
                studentNumber
            ),

        date:
            normalized.date,

        subject:
            normalized.subject,

        subjectId:
            normalized.subjectId,

        subjectKey:
            normalized.subjectKey,

        period:
            normalized.period,

        classGroup:
            normalized.classGroup,

        teacher:
            normalized.teacher,

        building:
            normalized.building,

        room:
            normalized.room,

        scheduleDocumentId:
            normalized
                .scheduleDocumentId,

        attendanceNotificationTest:
            normalized
                .attendanceNotificationTest === true,

        startTime:
            normalized.startTime,

        endTime:
            normalized.endTime,

        lectureStartAt:
            Timestamp.fromDate(
                window.lectureStart
            ),

        lectureEndAt:
            Timestamp.fromDate(
                window.lectureEnd
            ),

        startNotificationAt:
            Timestamp.fromDate(
                window.startNotificationAt
            ),

        endNotificationAt:
            Timestamp.fromDate(
                window.endNotificationAt
            ),

        startStampExpiresAt:
            Timestamp.fromDate(
                window.startStampExpiresAt
            ),

        endStampExpiresAt:
            Timestamp.fromDate(
                window.endStampExpiresAt
            )

    };

}


/* ========================================
   出席記録取得
======================================== */

/**
 * 指定した講義の出席記録を取得する。
 */
export async function loadAttendanceRecord(
    lecture
) {

    const normalized =
        normalizeAttendanceLecture(
            lecture
        );


    const {
        recordId,
        reference
    } =
        getAttendanceRecordReference(
            normalized
        );


    const snapshot =
        await getDoc(
            reference
        );


    return {

        exists:
            snapshot.exists(),

        recordId,

        lecture:
            normalized,

        data:
            snapshot.exists()
                ? snapshot.data()
                : null

    };

}


/* ========================================
   開始打刻
======================================== */

/**
 * 開始打刻を保存する。
 *
 * 判定：
 *
 * 開始10分前〜開始時刻
 * → 正常開始
 *
 * 開始1分後〜30分後
 * → 遅刻
 *
 * 開始31分後〜講義終了
 * → 欠席
 */
export async function stampAttendanceStart({

    lecture,

    now = new Date(),

    source =
        ATTENDANCE_STAMP_SOURCE
            .ATTENDANCE_PAGE

}) {

    try {

        const normalized =
            normalizeAttendanceLecture(
                lecture
            );


        const result =
            classifyStartStamp({

                stampAt:
                    now,

                lecture:
                    normalized
                        .lectureWindow

            });


        if (!result.recordable) {

            return createFailureResult({

                code:
                    result.kind,

                message:
                    result.message,

                judgement:
                    result

            });

        }


        const {
            recordId,
            reference
        } =
            getAttendanceRecordReference(
                normalized
            );


        const transactionResult =
            await runTransaction(
                db,
                async transaction => {

                    const snapshot =
                        await transaction.get(
                            reference
                        );


                    const current =
                        snapshot.exists()
                            ? snapshot.data()
                            : {};


                    /*
                     * 欠席ボタンがすでに押されている。
                     */
                    if (
                        current.absenceTapped ===
                        true
                    ) {

                        return createFailureResult({

                            code:
                                "already_absent",

                            message:
                                "この講義は欠席として記録されています。",

                            recordId

                        });

                    }


                    /*
                     * 開始打刻済み。
                     */
                    if (
                        current.startStampedAt ||
                        current.startKind
                    ) {

                        return createFailureResult({

                            code:
                                "start_already_stamped",

                            message:
                                "開始打刻はすでに完了しています。",

                            recordId,

                            record:
                                current

                        });

                    }


                    const endResult =
                        current.endKind
                            ? {
                                kind:
                                    current
                                        .endKind
                            }
                            : null;


                    const finalResult =
                        determineAttendanceStatus({

                            startResult:
                                result,

                            endResult,

                            absenceTapped:
                                current
                                    .absenceTapped ===
                                true

                        });


                    const payload = {

                        ...createBaseRecord(
                            normalized
                        ),

                        recordId,

                        startStampedAt:
                            serverTimestamp(),

                        startClientAt:
                            Timestamp.fromDate(
                                new Date(now)
                            ),

                        startKind:
                            result.kind,

                        startLabel:
                            result.label,

                        startSource:
                            normalizeSource(
                                source
                            ),

                        status:
                            finalResult.status,

                        statusLabel:
                            finalResult.label,

                        statusFinalized:
                            finalResult.finalized,

                        judgementSource:
                            "client_rule_engine",

                        serverVerificationRequired:
                            true,

                        updatedAt:
                            serverTimestamp()

                    };


                    if (!snapshot.exists()) {

                        payload.createdAt =
                            serverTimestamp();

                    }


                    transaction.set(
                        reference,
                        payload,
                        {
                            merge: true
                        }
                    );


                    return createSuccessResult({

                        code:
                            result.kind,

                        message:
                            result.message,

                        recordId,

                        judgement:
                            result,

                        finalResult

                    });

                }
            );


        return transactionResult;

    } catch (error) {

        console.error(
            "開始打刻保存エラー:",
            error
        );


        return createFailureResult({

            code:
                "start_stamp_failed",

            message:
                "開始打刻を保存できませんでした。",

            error

        });

    }

}


/* ========================================
   終了・早退打刻
======================================== */

/**
 * 終了打刻を保存する。
 *
 * action:
 *
 * "end"
 * 通常の終了ボタン
 *
 * "early_leave"
 * 出席管理画面の早退ボタン
 *
 * どちらを押しても、
 * 最終判定は実際の打刻時刻で決まる。
 */
export async function stampAttendanceEnd({

    lecture,

    now = new Date(),

    action = "end",

    source =
        ATTENDANCE_STAMP_SOURCE
            .ATTENDANCE_PAGE

}) {

    try {

        const normalized =
            normalizeAttendanceLecture(
                lecture
            );


        const result =
            classifyEndStamp({

                stampAt:
                    now,

                lecture:
                    normalized
                        .lectureWindow

            });


        if (!result.recordable) {

            return createFailureResult({

                code:
                    result.kind,

                message:
                    result.message,

                judgement:
                    result

            });

        }


        const {
            recordId,
            reference
        } =
            getAttendanceRecordReference(
                normalized
            );


        const transactionResult =
            await runTransaction(
                db,
                async transaction => {

                    const snapshot =
                        await transaction.get(
                            reference
                        );


                    const current =
                        snapshot.exists()
                            ? snapshot.data()
                            : {};


                    /*
                     * 欠席確定済み。
                     */
                    if (
                        current.absenceTapped ===
                        true
                    ) {

                        return createFailureResult({

                            code:
                                "already_absent",

                            message:
                                "この講義は欠席として記録されています。",

                            recordId

                        });

                    }


                    /*
                     * 終了打刻済み。
                     */
                    if (
                        current.endStampedAt ||
                        current.endKind
                    ) {

                        return createFailureResult({

                            code:
                                "end_already_stamped",

                            message:
                                "終了打刻はすでに完了しています。",

                            recordId,

                            record:
                                current

                        });

                    }


                    const startResult =
                        current.startKind
                            ? {
                                kind:
                                    current
                                        .startKind
                            }
                            : null;


                    const finalResult =
                        determineAttendanceStatus({

                            startResult,

                            endResult:
                                result,

                            absenceTapped:
                                current
                                    .absenceTapped ===
                                true

                        });


                    const normalizedAction =
                        action ===
                        "early_leave"
                            ? "early_leave"
                            : "end";


                    const payload = {

                        ...createBaseRecord(
                            normalized
                        ),

                        recordId,

                        endStampedAt:
                            serverTimestamp(),

                        endClientAt:
                            Timestamp.fromDate(
                                new Date(now)
                            ),

                        endKind:
                            result.kind,

                        endLabel:
                            result.label,

                        endAction:
                            normalizedAction,

                        endSource:
                            normalizeSource(
                                source
                            ),

                        status:
                            finalResult.status,

                        statusLabel:
                            finalResult.label,

                        statusFinalized:
                            finalResult.finalized,

                        judgementSource:
                            "client_rule_engine",

                        serverVerificationRequired:
                            true,

                        updatedAt:
                            serverTimestamp()

                    };


                    if (!snapshot.exists()) {

                        payload.createdAt =
                            serverTimestamp();

                    }


                    transaction.set(
                        reference,
                        payload,
                        {
                            merge: true
                        }
                    );


                    return createSuccessResult({

                        code:
                            result.kind,

                        message:
                            result.message,

                        recordId,

                        judgement:
                            result,

                        finalResult

                    });

                }
            );


        return transactionResult;

    } catch (error) {

        console.error(
            "終了打刻保存エラー:",
            error
        );


        return createFailureResult({

            code:
                "end_stamp_failed",

            message:
                "終了打刻を保存できませんでした。",

            error

        });

    }

}


/**
 * 早退ボタン専用。
 *
 * 内部では終了打刻と同じ判定を使う。
 */
export async function stampAttendanceEarlyLeave({

    lecture,

    now = new Date(),

    source =
        ATTENDANCE_STAMP_SOURCE
            .ATTENDANCE_PAGE

}) {

    return stampAttendanceEnd({

        lecture,

        now,

        action:
            "early_leave",

        source

    });

}


/* ========================================
   欠席ボタン
======================================== */

/**
 * 欠席ボタンを押した時の処理。
 *
 * 押せる時間：
 * 開始10分前〜講義終了
 */
export async function markAttendanceAbsent({

    lecture,

    now = new Date(),

    source =
        ATTENDANCE_STAMP_SOURCE
            .ATTENDANCE_PAGE

}) {

    try {

        const normalized =
            normalizeAttendanceLecture(
                lecture
            );


        const actionState =
            getAttendanceActionState({

                now,

                lecture:
                    normalized
                        .lectureWindow

            });


        if (
            !actionState.canMarkAbsent
        ) {

            const beforeStart =
                new Date(now).getTime() <
                normalized
                    .lectureWindow
                    .startNotificationAt
                    .getTime();


            return createFailureResult({

                code:
                    beforeStart
                        ? "absence_not_open"
                        : "absence_expired",

                message:
                    beforeStart
                        ? "欠席登録は講義開始10分前から可能です。"
                        : "欠席登録の期限が終了しています。"

            });

        }


        const {
            recordId,
            reference
        } =
            getAttendanceRecordReference(
                normalized
            );


        const transactionResult =
            await runTransaction(
                db,
                async transaction => {

                    const snapshot =
                        await transaction.get(
                            reference
                        );


                    const current =
                        snapshot.exists()
                            ? snapshot.data()
                            : {};


                    /*
                     * すでに欠席登録済み。
                     * 重複操作としてエラーにはしない。
                     */
                    if (
                        current.absenceTapped ===
                        true
                    ) {

                        return createSuccessResult({

                            code:
                                "already_absent",

                            message:
                                "欠席として登録済みです。",

                            recordId,

                            finalResult: {
                                status:
                                    ATTENDANCE_STATUS
                                        .ABSENT,

                                label:
                                    "欠席",

                                finalized:
                                    true
                            }

                        });

                    }


                    /*
                     * 開始打刻後は欠席ボタンを押せない。
                     * 途中退出は早退ボタンを使用する。
                     */
                    if (
                        current.startStampedAt ||
                        current.startKind
                    ) {

                        return createFailureResult({

                            code:
                                "start_already_stamped",

                            message:
                                "開始打刻済みです。途中で退出する場合は早退を押してください。",

                            recordId

                        });

                    }


                    /*
                     * 終了・早退打刻後も欠席へ変更しない。
                     */
                    if (
                        current.endStampedAt ||
                        current.endKind
                    ) {

                        return createFailureResult({

                            code:
                                "end_already_stamped",

                            message:
                                "終了打刻済みのため、欠席へ変更できません。",

                            recordId

                        });

                    }


                    const payload = {

                        ...createBaseRecord(
                            normalized
                        ),

                        recordId,

                        absenceTapped:
                            true,

                        absenceTappedAt:
                            serverTimestamp(),

                        absenceClientAt:
                            Timestamp.fromDate(
                                new Date(now)
                            ),

                        absenceSource:
                            normalizeSource(
                                source
                            ),

                        absenceReason:
                            "student_selected_absence",

                        status:
                            ATTENDANCE_STATUS
                                .ABSENT,

                        statusLabel:
                            "欠席",

                        statusFinalized:
                            true,

                        judgementSource:
                            "student_absence_action",

                        serverVerificationRequired:
                            true,

                        updatedAt:
                            serverTimestamp()

                    };


                    if (!snapshot.exists()) {

                        payload.createdAt =
                            serverTimestamp();

                    }


                    transaction.set(
                        reference,
                        payload,
                        {
                            merge: true
                        }
                    );


                    return createSuccessResult({

                        code:
                            "absent",

                        message:
                            "欠席として記録しました。",

                        recordId,

                        finalResult: {
                            status:
                                ATTENDANCE_STATUS
                                    .ABSENT,

                            label:
                                "欠席",

                            finalized:
                                true
                        }

                    });

                }
            );


        return transactionResult;

    } catch (error) {

        console.error(
            "欠席保存エラー:",
            error
        );


        return createFailureResult({

            code:
                "absence_failed",

            message:
                "欠席を保存できませんでした。",

            error

        });

    }

}


/* ========================================
   保存済み時刻から再判定
======================================== */

/**
 * FirestoreのserverTimestampを使って、
 * 保存済み記録を再判定する。
 *
 * 管理画面・一覧画面でも
 * 同じ判定を使える。
 */
export function recalculateAttendanceStatus(
    record
) {

    if (
        !record ||
        typeof record !== "object"
    ) {

        return {

            status:
                ATTENDANCE_STATUS
                    .UNRECORDED,

            label:
                "未打刻",

            finalized:
                false

        };

    }


    const lecture =
        normalizeAttendanceLecture({

            date:
                record.date,

            subject:
                record.subject,

            subjectId:
                record.subjectId,

            subjectKey:
                record.subjectKey,

            period:
                record.period,

            classGroup:
                record.classGroup,

            startTime:
                record.startTime,

            endTime:
                record.endTime

        });


    let startResult =
        record.startKind
            ? {
                kind:
                    record.startKind
            }
            : null;


    let endResult =
        record.endKind
            ? {
                kind:
                    record.endKind
            }
            : null;


    /*
    通常講義：
    Firestoreのサーバー時刻を使って
    改ざんされにくい判定をする。

    通知テスト：
    attendanceTestClockで渡した
    クライアント側テスト時刻を使う。
    */

    const isNotificationTest =
        record.attendanceNotificationTest ===
        true;


    const serverStartAt =
        firestoreTimestampToDate(
            record.startStampedAt
        );


    const serverEndAt =
        firestoreTimestampToDate(
            record.endStampedAt
        );


    const clientStartAt =
        firestoreTimestampToDate(
            record.startClientAt
        );


    const clientEndAt =
        firestoreTimestampToDate(
            record.endClientAt
        );


    const resolvedStartAt =

        isNotificationTest

            ? (
                clientStartAt ||
                serverStartAt
            )

            : serverStartAt;


    const resolvedEndAt =

        isNotificationTest

            ? (
                clientEndAt ||
                serverEndAt
            )

            : serverEndAt;


    if (resolvedStartAt) {

        startResult =
            classifyStartStamp({

                stampAt:
                    resolvedStartAt,

                lecture:
                    lecture
                        .lectureWindow

            });

    }


    if (resolvedEndAt) {

        endResult =
            classifyEndStamp({

                stampAt:
                    resolvedEndAt,

                lecture:
                    lecture
                        .lectureWindow

            });

    }


    return determineAttendanceStatus({

        startResult,

        endResult,

        absenceTapped:
            record.absenceTapped ===
            true

    });

}


/**
 * Firestore TimestampをDateへ変換する。
 */
function firestoreTimestampToDate(
    value
) {

    if (
        value &&
        typeof value.toDate ===
        "function"
    ) {

        const date =
            value.toDate();


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date;

        }

    }


    return null;

}


/* ========================================
   共通返却形式
======================================== */

function createSuccessResult({

    code,

    message,

    recordId = "",

    judgement = null,

    finalResult = null,

    record = null

}) {

    return {

        ok: true,

        code,

        message,

        recordId,

        judgement,

        finalResult,

        record

    };

}


function createFailureResult({

    code,

    message,

    recordId = "",

    judgement = null,

    record = null,

    error = null

}) {

    return {

        ok: false,

        code,

        message,

        recordId,

        judgement,

        record,

        error

    };

}