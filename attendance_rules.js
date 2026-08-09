/* ========================================
   CareMate 出席判定エンジン
======================================== */


/*
 * 大学共通の講義時間
 *
 * 時間割側に startTime / endTime がある場合は、
 * そちらを優先する。
 */
export const PERIOD_TIMES = Object.freeze({

    1: {
        startTime: "09:00",
        endTime: "10:30"
    },

    2: {
        startTime: "10:40",
        endTime: "12:10"
    },

    3: {
        startTime: "13:00",
        endTime: "14:30"
    },

    4: {
        startTime: "14:40",
        endTime: "16:10"
    },

    5: {
        startTime: "16:20",
        endTime: "17:50"
    }

});


/*
 * CareMateの打刻時間設定
 */
export const ATTENDANCE_RULES = Object.freeze({

    /*
     * 開始打刻を開放する時間。
     * 講義開始10分前。
     */
    startOpenBeforeMinutes: 10,

    /*
     * 遅刻扱いの最終時間。
     * 開始30分後まで。
     */
    lateUntilMinutes: 30,

    /*
     * 終了30分前から早退扱い。
     */
    earlyLeaveStartBeforeMinutes: 30,

    /*
     * 終了5分前から正常終了扱い。
     */
    normalEndOpenBeforeMinutes: 5,

    /*
     * 終了打刻の期限。
     * 終了10分後まで。
     */
    endCloseAfterMinutes: 10

});


export const START_STAMP_KIND = Object.freeze({

    TOO_EARLY: "too_early",

    ON_TIME: "on_time",

    LATE: "late",

    ABSENT: "absent",

    EXPIRED: "expired"

});


export const END_STAMP_KIND = Object.freeze({

    TOO_EARLY: "too_early",

    ABSENT: "absent",

    EARLY_LEAVE: "early_leave",

    NORMAL: "normal",

    EXPIRED: "expired"

});


export const ATTENDANCE_STATUS = Object.freeze({

    PENDING: "pending",

    PRESENT: "present",

    LATE: "late",

    EARLY_LEAVE: "early_leave",

    LATE_AND_EARLY_LEAVE:
        "late_and_early_leave",

    ABSENT: "absent",

    UNRECORDED: "unrecorded"

});


/* ========================================
   日付・時間変換
======================================== */

/**
 * Date、文字列、数値をDateへ変換する。
 */
function toDate(value) {

    if (value instanceof Date) {

        return new Date(
            value.getTime()
        );

    }


    if (
        typeof value === "number" ||
        typeof value === "string"
    ) {

        const date =
            new Date(value);


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            return date;

        }

    }


    throw new Error(
        "有効な日時ではありません。"
    );

}


/**
 * 判定を分単位に統一する。
 *
 * 例：
 * 09:00:42 → 09:00
 */
function normalizeToMinute(value) {

    const date =
        toDate(value);


    date.setSeconds(
        0,
        0
    );


    return date;

}


/**
 * 指定日時へ分数を加算する。
 */
function addMinutes(
    value,
    minutes
) {

    const date =
        toDate(value);


    date.setMinutes(
        date.getMinutes() +
        Number(minutes || 0)
    );


    return date;

}


/**
 * YYYY-MM-DDとHH:mmから
 * ローカル日時を作成する。
 */
function createLocalDateTime(
    dateString,
    timeString
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(dateString || "")
    ) {

        throw new Error(
            "講義日が正しくありません。"
        );

    }


    if (
        !/^\d{2}:\d{2}$/
            .test(timeString || "")
    ) {

        throw new Error(
            "講義時間が正しくありません。"
        );

    }


    const date =
        new Date(
            `${dateString}T${timeString}:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        throw new Error(
            "講義日時を作成できませんでした。"
        );

    }


    return date;

}


/* ========================================
   講義時間生成
======================================== */

/**
 * 時限表記を数値へ変換する。
 *
 * 例：
 * 1
 * "1"
 * "1限"
 */
function normalizePeriod(period) {

    const value =
        Number(
            String(period ?? "")
                .replace("限", "")
                .trim()
        );


    if (
        !Number.isInteger(value) ||
        !PERIOD_TIMES[value]
    ) {

        throw new Error(
            `対応していない時限です: ${period}`
        );

    }


    return value;

}


/**
 * 講義の開始・終了日時と、
 * 通知・打刻期限を生成する。
 */
export function createLectureWindow({

    date,

    period,

    startTime = "",

    endTime = ""

}) {

    const normalizedPeriod =
        normalizePeriod(period);


    const defaultTimes =
        PERIOD_TIMES[
            normalizedPeriod
        ];


    const resolvedStartTime =
        startTime ||
        defaultTimes.startTime;


    const resolvedEndTime =
        endTime ||
        defaultTimes.endTime;


    const lectureStart =
        createLocalDateTime(
            date,
            resolvedStartTime
        );


    const lectureEnd =
        createLocalDateTime(
            date,
            resolvedEndTime
        );


    if (
        lectureEnd.getTime() <=
        lectureStart.getTime()
    ) {

        throw new Error(
            "講義終了時刻は開始時刻より後にしてください。"
        );

    }


    return {

        date,

        period:
            normalizedPeriod,

        startTime:
            resolvedStartTime,

        endTime:
            resolvedEndTime,

        lectureStart,

        lectureEnd,


        /*
         * 開始通知・開始打刻開放
         */
        startNotificationAt:
            addMinutes(
                lectureStart,
                -ATTENDANCE_RULES
                    .startOpenBeforeMinutes
            ),


        /*
         * 開始通知からの打刻期限
         */
        startStampExpiresAt:
            addMinutes(
                lectureStart,
                ATTENDANCE_RULES
                    .lateUntilMinutes
            ),


        /*
         * 遅刻扱いの最終時間
         */
        lateUntil:
            addMinutes(
                lectureStart,
                ATTENDANCE_RULES
                    .lateUntilMinutes
            ),


        /*
         * ここより前に終了したら欠席。
         * この時間から早退判定。
         */
        earlyLeaveStartsAt:
            addMinutes(
                lectureEnd,
                -ATTENDANCE_RULES
                    .earlyLeaveStartBeforeMinutes
            ),


        /*
         * この時間から正常終了判定。
         */
        normalEndStartsAt:
            addMinutes(
                lectureEnd,
                -ATTENDANCE_RULES
                    .normalEndOpenBeforeMinutes
            ),


        /*
         * 終了通知時刻。
         */
        endNotificationAt:
            addMinutes(
                lectureEnd,
                -ATTENDANCE_RULES
                    .normalEndOpenBeforeMinutes
            ),


        /*
         * 終了打刻期限。
         */
        endStampExpiresAt:
            addMinutes(
                lectureEnd,
                ATTENDANCE_RULES
                    .endCloseAfterMinutes
            )

    };

}


/* ========================================
   開始打刻判定
======================================== */

/**
 * 開始打刻時刻を判定する。
 */
export function classifyStartStamp({

    stampAt,

    lecture

}) {

    const stamp =
        normalizeToMinute(
            stampAt
        );


    const startOpen =
        normalizeToMinute(
            lecture.startNotificationAt
        );


    const lectureStart =
        normalizeToMinute(
            lecture.lectureStart
        );


    const lateUntil =
        normalizeToMinute(
            lecture.lateUntil
        );


    const lectureEnd =
        normalizeToMinute(
            lecture.lectureEnd
        );


    if (
        stamp.getTime() <
        startOpen.getTime()
    ) {

        return {

            kind:
                START_STAMP_KIND
                    .TOO_EARLY,

            recordable: false,

            label:
                "開始前",

            message:
                "開始打刻は講義開始10分前から可能です。"

        };

    }


    /*
     * 開始10分前〜開始時刻。
     */
    if (
        stamp.getTime() <=
        lectureStart.getTime()
    ) {

        return {

            kind:
                START_STAMP_KIND
                    .ON_TIME,

            recordable: true,

            label:
                "正常開始",

            message:
                "開始打刻を記録しました。"

        };

    }


    /*
     * 開始1分後〜30分後。
     */
    if (
        stamp.getTime() <=
        lateUntil.getTime()
    ) {

        return {

            kind:
                START_STAMP_KIND
                    .LATE,

            recordable: true,

            label:
                "遅刻",

            message:
                "遅刻として開始打刻を記録しました。"

        };

    }


    /*
     * 開始31分後〜講義終了。
     * 打刻自体は記録するが欠席判定。
     */
    if (
        stamp.getTime() <=
        lectureEnd.getTime()
    ) {

        return {

            kind:
                START_STAMP_KIND
                    .ABSENT,

            recordable: true,

            label:
                "欠席",

            message:
                "講義開始から30分を超えているため、欠席扱いです。"

        };

    }


    return {

        kind:
            START_STAMP_KIND
                .EXPIRED,

        recordable: false,

        label:
            "期限切れ",

        message:
            "開始打刻期限が終了しています。"

    };

}


/* ========================================
   終了打刻判定
======================================== */

/**
 * 終了打刻時刻を判定する。
 */
export function classifyEndStamp({

    stampAt,

    lecture

}) {

    const stamp =
        normalizeToMinute(
            stampAt
        );


    const lectureStart =
        normalizeToMinute(
            lecture.lectureStart
        );


    const earlyLeaveStartsAt =
        normalizeToMinute(
            lecture.earlyLeaveStartsAt
        );


    const normalEndStartsAt =
        normalizeToMinute(
            lecture.normalEndStartsAt
        );


    const endStampExpiresAt =
        normalizeToMinute(
            lecture.endStampExpiresAt
        );


    /*
     * 講義開始前の終了打刻は不可。
     */
    if (
        stamp.getTime() <
        lectureStart.getTime()
    ) {

        return {

            kind:
                END_STAMP_KIND
                    .TOO_EARLY,

            recordable: false,

            label:
                "開始前",

            message:
                "講義開始前は終了打刻できません。"

        };

    }


    /*
     * 終了30分前より前。
     *
     * 例：
     * 9:00〜10:30なら
     * 9:00〜9:59。
     *
     * 欠席扱い。
     */
    if (
        stamp.getTime() <
        earlyLeaveStartsAt.getTime()
    ) {

        return {

            kind:
                END_STAMP_KIND
                    .ABSENT,

            recordable: true,

            label:
                "欠席",

            message:
                "終了30分前より前の終了打刻のため、欠席扱いです。"

        };

    }


    /*
     * 終了30分前〜終了6分前。
     *
     * 例：
     * 9:00〜10:30なら
     * 10:00〜10:24。
     */
    if (
        stamp.getTime() <
        normalEndStartsAt.getTime()
    ) {

        return {

            kind:
                END_STAMP_KIND
                    .EARLY_LEAVE,

            recordable: true,

            label:
                "早退",

            message:
                "早退として終了打刻を記録しました。"

        };

    }


    /*
     * 終了5分前〜終了10分後。
     *
     * 例：
     * 9:00〜10:30なら
     * 10:25〜10:40。
     */
    if (
        stamp.getTime() <=
        endStampExpiresAt.getTime()
    ) {

        return {

            kind:
                END_STAMP_KIND
                    .NORMAL,

            recordable: true,

            label:
                "正常終了",

            message:
                "終了打刻を記録しました。"

        };

    }


    return {

        kind:
            END_STAMP_KIND
                .EXPIRED,

        recordable: false,

        label:
            "期限切れ",

        message:
            "終了打刻期限が終了しています。"

    };

}


/* ========================================
   最終出席判定
======================================== */

/**
 * 開始結果と終了結果から
 * 最終的な出席状態を決める。
 */
export function determineAttendanceStatus({

    startResult = null,

    endResult = null,

    absenceTapped = false

}) {

    /*
     * 欠席ボタンを押した場合は即欠席。
     */
    if (absenceTapped) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .ABSENT,

            "欠席",

            true

        );

    }


    /*
     * 開始31分後以降。
     */
    if (
        startResult?.kind ===
        START_STAMP_KIND.ABSENT
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .ABSENT,

            "欠席",

            true

        );

    }


    /*
     * 終了30分前より前。
     */
    if (
        endResult?.kind ===
        END_STAMP_KIND.ABSENT
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .ABSENT,

            "欠席",

            true

        );

    }


    /*
     * 開始または終了がまだない場合。
     */
    if (
        !startResult ||
        !endResult
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .PENDING,

            "判定待ち",

            false

        );

    }


    /*
     * 正常開始＋正常終了。
     */
    if (
        startResult.kind ===
            START_STAMP_KIND.ON_TIME &&
        endResult.kind ===
            END_STAMP_KIND.NORMAL
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .PRESENT,

            "出席",

            true

        );

    }


    /*
     * 遅刻＋正常終了。
     */
    if (
        startResult.kind ===
            START_STAMP_KIND.LATE &&
        endResult.kind ===
            END_STAMP_KIND.NORMAL
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .LATE,

            "遅刻",

            true

        );

    }


    /*
     * 正常開始＋早退。
     */
    if (
        startResult.kind ===
            START_STAMP_KIND.ON_TIME &&
        endResult.kind ===
            END_STAMP_KIND.EARLY_LEAVE
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .EARLY_LEAVE,

            "早退",

            true

        );

    }


    /*
     * 遅刻＋早退。
     */
    if (
        startResult.kind ===
            START_STAMP_KIND.LATE &&
        endResult.kind ===
            END_STAMP_KIND.EARLY_LEAVE
    ) {

        return createFinalResult(

            ATTENDANCE_STATUS
                .LATE_AND_EARLY_LEAVE,

            "遅刻・早退",

            true

        );

    }


    /*
     * 期限切れや不正な組み合わせ。
     * 自動で欠席にはせず、
     * 出席管理からの修正対象にする。
     */
    return createFinalResult(

        ATTENDANCE_STATUS
            .UNRECORDED,

        "未打刻",

        false

    );

}


/**
 * 最終結果の共通形式。
 */
function createFinalResult(
    status,
    label,
    finalized
) {

    return {

        status,

        label,

        finalized

    };

}


/* ========================================
   現在操作できるボタン
======================================== */

/**
 * 現在時刻から、
 * 出席管理画面で押せるボタンを返す。
 */
export function getAttendanceActionState({

    now = new Date(),

    lecture

}) {

    const current =
        normalizeToMinute(
            now
        );


    const startOpen =
        normalizeToMinute(
            lecture.startNotificationAt
        );


    const lectureStart =
        normalizeToMinute(
            lecture.lectureStart
        );


    const lectureEnd =
        normalizeToMinute(
            lecture.lectureEnd
        );


    const endOpen =
        normalizeToMinute(
            lecture.endNotificationAt
        );


    const endExpires =
        normalizeToMinute(
            lecture.endStampExpiresAt
        );


    return {

        /*
         * 開始10分前〜講義終了。
         *
         * 31分後以降に押すと
         * 打刻はできるが欠席判定。
         */
        canStartStamp:
            current.getTime() >=
                startOpen.getTime() &&
            current.getTime() <=
                lectureEnd.getTime(),


        /*
         * 欠席ボタン。
         */
        canMarkAbsent:
            current.getTime() >=
                startOpen.getTime() &&
            current.getTime() <=
                lectureEnd.getTime(),


        /*
         * 講義時間中は通知なしでも
         * 出席管理から早退操作可能。
         *
         * 実際の状態は打刻時刻で判定する。
         */
        canTapEarlyLeave:
            current.getTime() >=
                lecture.earlyLeaveStartsAt
                    .getTime() &&
            current.getTime() <
                lectureEnd.getTime(),


        /*
         * 通常の終了ボタン。
         */
        canEndStamp:
            current.getTime() >=
                lectureStart.getTime() &&
            current.getTime() <=
                endExpires.getTime(),


        /*
         * 開始通知の有効期限。
         */
        startNotificationExpired:
            current.getTime() >
            lectureEnd.getTime(),


        /*
         * 終了通知の有効期限。
         */
        endNotificationExpired:
            current.getTime() >
            endExpires.getTime()

    };

}


/* ========================================
   表示名
======================================== */

export function getAttendanceStatusLabel(
    status
) {

    const labels = {

        [ATTENDANCE_STATUS.PENDING]:
            "判定待ち",

        [ATTENDANCE_STATUS.PRESENT]:
            "出席",

        [ATTENDANCE_STATUS.LATE]:
            "遅刻",

        [ATTENDANCE_STATUS.EARLY_LEAVE]:
            "早退",

        [ATTENDANCE_STATUS
            .LATE_AND_EARLY_LEAVE]:
            "遅刻・早退",

        [ATTENDANCE_STATUS.ABSENT]:
            "欠席",

        [ATTENDANCE_STATUS.UNRECORDED]:
            "未打刻"

    };


    return (
        labels[status] ||
        "未判定"
    );

}
