const {
    onRequest
} = require("firebase-functions/v2/https");

const {
    onCall,
    HttpsError
} = require("firebase-functions/v2/https");

const {
    onDocumentCreated
} = require("firebase-functions/v2/firestore");

const {
    onDocumentUpdated
} = require("firebase-functions/v2/firestore");

const { onSchedule } = require("firebase-functions/v2/scheduler");

const {
    defineSecret
} = require("firebase-functions/params");

const {
    initializeApp
} = require("firebase-admin/app");

const {
    getAuth
} = require("firebase-admin/auth");

const {
    getFirestore
} = require("firebase-admin/firestore");

const webpush =
    require("web-push");

const crypto =
    require("node:crypto");

const chromium =
    require("@sparticuz/chromium");

const {
    chromium: playwrightChromium
} = require("playwright-core");

const {
    PERIOD_TIMES,
    normalizeCourseName,
    slotId
} = require("./attendance_policy");


initializeApp();

const db =
    getFirestore();

const adminAuth =
    getAuth();

const SITE_URL = "https://doko2517027-bit.github.io/university-notifier-web";

const WEB_PUSH_PUBLIC_KEY = defineSecret("WEB_PUSH_PUBLIC_KEY");
const WEB_PUSH_PRIVATE_KEY = defineSecret("WEB_PUSH_PRIVATE_KEY");

/*
 * 登録テスト専用の照合値。
 * 値そのものはコード・Firestore・ブラウザへ保存しない。
 */
const REGISTRATION_TEST_STUDENT_PAGE_ID =
    defineSecret("REGISTRATION_TEST_STUDENT_PAGE_ID");

const REGISTRATION_TEST_STUDENT_PAGE_PASSWORD =
    defineSecret("REGISTRATION_TEST_STUDENT_PAGE_PASSWORD");

const SITE_ORIGIN = "https://doko2517027-bit.github.io";

// =====================
// CareMate ログイン
// =====================
// ブラウザが管理者権限を自己申告できないよう、アプリ用パスワードの
// 照合とFirebaseのカスタムトークン発行は必ずサーバー側で行う。
exports.authenticateCareMate = onCall(
    { region: "asia-northeast1", cors: [SITE_ORIGIN] },
    async (request) => {
        const studentNumber = String(request.data?.studentNumber || "").trim();
        const password = String(request.data?.password || "");

        if (!/^\d{7}$/.test(studentNumber) || !password) {
            throw new HttpsError("invalid-argument", "ログイン情報が不足しています。");
        }

        const userSnap = await db.collection("users").doc(studentNumber).get();
        const storedHash = String(userSnap.data()?.appPasswordHash || "");
        const suppliedHash = crypto
            .createHash("sha256")
            .update(password, "utf8")
            .digest("hex");

        if (
            !userSnap.exists ||
            storedHash.length !== suppliedHash.length ||
            !crypto.timingSafeEqual(
                Buffer.from(storedHash, "utf8"),
                Buffer.from(suppliedHash, "utf8")
            )
        ) {
            throw new HttpsError("unauthenticated", "学籍番号またはパスワードが違います。");
        }

        const adminSnap = await db.collection("admins").doc(studentNumber).get();
        const admin = adminSnap.exists && adminSnap.data().enabled === true;

        const token = await adminAuth.createCustomToken(`caremate-${studentNumber}`, {
            admin,
            studentNumber
        });

        return { token, admin };
    }
);


// ======================
// 学生ページ認証
// ======================

exports.verifyStudentPageCredentials =
onRequest(
    {
        region: "asia-northeast1",
        timeoutSeconds: 60,
        memory: "1GiB",
        cors: [SITE_ORIGIN],
        secrets: [
            REGISTRATION_TEST_STUDENT_PAGE_ID,
            REGISTRATION_TEST_STUDENT_PAGE_PASSWORD
        ]
    },

    async (request, response) => {

        if (request.method !== "POST") {

            response.status(405).json({
                verified: false,
                message: "POSTで送信してください。"
            });

            return;

        }

        const studentPageId =
            String(
                request.body?.studentPageId || ""
            ).trim();

        const studentPagePassword =
            String(
                request.body?.studentPagePassword || ""
            );

        if (!studentPageId || !studentPagePassword) {

            response.status(400).json({
                verified: false,
                message: "学生ページIDとパスワードを入力してください。"
            });

            return;

        }

        /*
         * テスト用の値が秘密管理に設定されている場合は、
         * その値と一致したときだけ登録を許可する。
         * 秘密値はレスポンスやログへ一切出さない。
         */
        const testId =
            REGISTRATION_TEST_STUDENT_PAGE_ID.value();

        const testPassword =
            REGISTRATION_TEST_STUDENT_PAGE_PASSWORD.value();

        if (testId && testPassword) {

            response.json({
                verified:
                    studentPageId === testId &&
                    studentPagePassword === testPassword,
                mode: "test"
            });

            return;

        }

        let browser;

        try {

            browser =
                await playwrightChromium.launch({
                    args: chromium.args,
                    executablePath:
                        await chromium.executablePath(),
                    headless: true
                });

            const context =
                await browser.newContext();

            const page =
                await context.newPage();

            await page.goto(
                "https://sums.ac.jp/",
                {
                    waitUntil: "domcontentloaded",
                    timeout: 45_000
                }
            );

            const popupPromise =
                context.waitForEvent("page");

            await page.locator("#cn_01")
                .getByRole(
                    "link",
                    { name: "在学生の皆様へ" }
                )
                .click();

            const studentPage =
                await popupPromise;

            await studentPage.waitForLoadState(
                "domcontentloaded"
            );

            await studentPage.getByRole(
                "textbox",
                { name: "ログインＩＤを入力" }
            ).fill(studentPageId);

            await studentPage.getByRole(
                "textbox",
                { name: "パスワードを入力" }
            ).fill(studentPagePassword);

            await studentPage.getByRole(
                "button",
                { name: "Submit" }
            ).click();

            await studentPage.waitForLoadState(
                "networkidle",
                { timeout: 30_000 }
            );

            const verified =
                await studentPage.getByRole(
                    "link",
                    { name: "授業について。" }
                ).count() > 0;

            response.json({ verified });

        } catch (error) {

            console.warn(
                "学生ページ認証失敗:",
                error?.message || "unknown"
            );

            response.json({ verified: false });

        } finally {

            if (browser) {
                await browser.close();
            }

        }
    }
);

function scheduleDocumentId(user) {
    if (String(user.department || "").trim() === "看護学科") return "ns_yamate";
    if (String(user.major || "").includes("理学療法")) return "pt";
    if (String(user.major || "").includes("作業療法")) return "ot";
    return "";
}

async function sendToUserDevices(userId, payload) {
    const devices = await db.collection("users").doc(userId)
        .collection("pushSubscriptions").get();
    const results = [];
    for (const device of devices.docs) {
        try {
            await webpush.sendNotification(device.data(), JSON.stringify(payload));
            results.push({ deviceId: device.id, result: "sent" });
        } catch (error) {
            if (error?.statusCode === 404 || error?.statusCode === 410) {
                await device.ref.delete();
            }
            results.push({ deviceId: device.id, result: "failed", statusCode: error?.statusCode || null });
        }
    }
    return results;
}

function attendanceDeadline(date, time, extraMinutes) {
    const base = new Date(`${date}T${time}:00+09:00`);
    if (Number.isNaN(base.getTime())) return null;
    return new Date(base.getTime() + extraMinutes * 60 * 1000);
}

/*
 * 開始・終了いずれかの打刻期限を過ぎた未打刻記録を、
 * サーバー側でも欠席として確定する。画面を開かなくても
 * 今日の集計と管理画面が同じ状態になるようにする。
 */
async function finalizeExpiredAttendanceRecords(userDoc, date, now = new Date()) {
    const snapshot = await userDoc.ref.collection("attendanceRecords")
        .where("date", "==", date)
        .get();
    const updates = [];

    for (const recordDoc of snapshot.docs) {
        const record = recordDoc.data() || {};
        if (record.absenceTapped || record.manualEdited || record.endStampedAt || record.endKind) continue;

        const startDeadline = attendanceDeadline(record.date, record.startTime, 30);
        const endDeadline = attendanceDeadline(record.date, record.endTime, 10);
        const hasStart = Boolean(record.startStampedAt || record.startClientAt || record.startKind);
        const expired = !hasStart
            ? startDeadline && now > startDeadline
            : endDeadline && now > endDeadline;

        if (!expired) continue;

        updates.push(recordDoc.ref.update({
            status: "absent",
            finalLabel: "欠席",
            finalized: true,
            autoFinalizedReason: hasStart ? "end_stamp_expired" : "start_stamp_expired",
            autoFinalizedAt: now,
            updatedAt: now
        }));
    }

    await Promise.all(updates);
}

function tokyoParts(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(now).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function timeMinutes(value) {
    const [hour, minute] = String(value || "").split(":").map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1;
}

const CLASS_SELECTION_NONE =
    "__NONE__";


function normalizePeriodNumber(value) {

    const match =
        String(value || "")
            .match(/\d+/);

    return match
        ? Number(match[0])
        : 0;

}


function toHalfWidthAlphabet(value) {

    return String(value || "")
        .replace(
            /[Ａ-Ｚａ-ｚ]/g,
            character =>
                String.fromCharCode(
                    character.charCodeAt(0) -
                    0xFEE0
                )
        );

}


function extractClassGroups(value) {

    if (!value) {
        return [];
    }


    const original =
        toHalfWidthAlphabet(
            String(value)
        )
        .toUpperCase()
        .trim();


    if (
        /^(全員|共通|合同|指定なし|なし|ALL)$/i
            .test(original)
    ) {

        return [];

    }


    const text =
        original
            .replaceAll("クラス", "")
            .replaceAll("組", "")
            .replaceAll("班", "")
            .trim();


    if (!text) {
        return [];
    }


    const groups =
        [];


    /*
    A-D
    A〜D
    A～D
    */

    for (
        const match of
        text.matchAll(
            /([A-Z])\s*[-–—〜～]\s*([A-Z])/g
        )
    ) {

        const start =
            match[1].charCodeAt(0);

        const end =
            match[2].charCodeAt(0);


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
    Aクラス
    A/B
    A・B
    A,B
    */

    groups.push(
        ...(
            text.match(/[A-Z]/g) ||
            []
        )
    );


    return [
        ...new Set(groups)
    ].sort();

}


function createClassSelectionKey(
    subject,
    date,
    period
) {

    return (
        `${String(subject || "").trim()}_` +
        `${date}_` +
        `${normalizePeriodNumber(period)}`
    );

}


function normalizeClassSelection(value) {

    if (
        value &&
        typeof value === "object"
    ) {

        return normalizeClassSelection(

            value.classGroup ||
            value.class ||
            value.value

        );

    }


    const raw =
        String(value || "")
            .trim();


    if (
        raw ===
        CLASS_SELECTION_NONE
    ) {

        return CLASS_SELECTION_NONE;

    }


    return (
        extractClassGroups(raw)[0] ||
        ""
    );

}


function resolveClassSelection(
    selections,
    subject,
    date,
    period
) {

    const periodNumber =
        normalizePeriodNumber(
            period
        );


    /*
    新形式を最優先。
    下は過去データ互換。
    */

    const keys = [

        createClassSelectionKey(
            subject,
            date,
            periodNumber
        ),

        `${subject}_${date}_${periodNumber}限`,

        `${date}_${subject}_${periodNumber}`

    ];


    for (const key of keys) {

        if (
            !Object.prototype
                .hasOwnProperty.call(
                    selections || {},
                    key
                )
        ) {

            continue;

        }


        const selected =
            normalizeClassSelection(
                selections[key]
            );


        if (selected) {

            return selected;

        }

    }


    return "";

}


function mergeScheduleRows(
    rows,
    preferred
) {

    if (!rows.length) {
        return null;
    }


    const merged = {

        ...rows[0],

        ...(preferred || {})

    };


    const fields = [

        "subjectId",
        "subjectKey",
        "startTime",
        "endTime",
        "teacher",
        "building",
        "room",
        "testId"

    ];


    for (const field of fields) {

        if (
            String(
                merged[field] || ""
            ).trim()
        ) {

            continue;

        }


        const row =
            rows.find(
                item =>
                    String(
                        item[field] || ""
                    ).trim()
            );


        if (row) {

            merged[field] =
                row[field];

        }

    }


    return merged;

}

async function sendClassSelectionNotification(
    userDoc,
    {
        date,
        subject,
        period,
        options
    }
) {

    const normalizedSubject =
        normalizeCourseName(
            subject
        );


    const dispatchId =

        `${userDoc.id}_` +

        `${date}_` +

        `${period}_` +

        `${encodeURIComponent(
            normalizedSubject ||
            subject
        )}_class_selection`;


    const dispatchRef =
        db.collection(
            "classSelectionNotificationDispatches"
        )
        .doc(
            dispatchId
        );


    let claimed =
        false;


    await db.runTransaction(
        async transaction => {

            const existing =
                await transaction.get(
                    dispatchRef
                );


            /*
            同じ日・科目・時限について
            1回だけ通知
            */

            if (existing.exists) {
                return;
            }


            transaction.create(
                dispatchRef,
                {
                    userId:
                        userDoc.id,

                    date,

                    subject,

                    period,

                    options,

                    createdAt:
                        new Date()
                }
            );


            claimed =
                true;

        }
    );


    if (!claimed) {
        return;
    }


    const optionText =
        options
            .map(
                value =>
                    `${value}クラス`
            )
            .join("・");


    const query =
        new URLSearchParams({
            classSelection: "1",
            date,
            subject,
            period:
                String(period)
        }).toString();


    const payload = {

        title:
            "🏫 クラス選択が必要です",

        body:
            `${subject}（${period}限）でクラス分けがあります。` +
            `${optionText}・クラスなし から選択してください。`,

        url:
            `${SITE_URL}/index.html?${query}`,

        tag:
            `class-selection-${date}-${period}-${encodeURIComponent(subject)}`

    };


    const results =
        await sendToUserDevices(
            userDoc.id,
            payload
        );


    await dispatchRef.update({
        results,
        sentAt:
            new Date()
    });

}

// 個人時間割（公式PDF×履修科目）からだけ出席・退席通知を生成する。
async function processAttendanceNotifications() {
    webpush.setVapidDetails("mailto:kidokohei.shonaniryo2517027@gmail.com",
        WEB_PUSH_PUBLIC_KEY.value(), WEB_PUSH_PRIVATE_KEY.value());
    const realClock = tokyoParts();
    const scheduleCache = new Map();
    const appSettings = (await db.collection("system").doc("app").get()).data() || {};
    const attendanceOverrides = appSettings.attendanceOverrides || {};
    const users = await db.collection("users").get();

    for (const userDoc of users.docs) {
        const user = userDoc.data() || {};
        await finalizeExpiredAttendanceRecords(userDoc, realClock.date);
        const testClock = user.attendanceTestClock || {};
        const testClockActive = userDoc.id === "2510044" && testClock.enabled === true &&
            /^\d{4}-\d{2}-\d{2}$/.test(testClock.date || "") &&
            /^\d{2}:\d{2}$/.test(testClock.time || "") &&
            Date.parse(testClock.expiresAt || "") > Date.now();
        const clock = testClockActive
            ? { date: testClock.date, minutes: timeMinutes(testClock.time), test: true }
            : realClock;
        const scheduleId = scheduleDocumentId(user);
        if (!scheduleId) continue;
        if (!scheduleCache.has(scheduleId)) {
            scheduleCache.set(scheduleId, (await db.collection("schedule").doc(scheduleId).get()).data() || {});
        }
        const enrolledSnap = await userDoc.ref.collection("enrolledSubjects").get();
        const enrolled = new Set();
        enrolledSnap.docs.forEach(doc => {
            const item = doc.data();
            if (item.status === "removed") return;
            [doc.id, item.name, item.subjectKey, item.subjectId].forEach(value => {
                const normalized = normalizeCourseName(value);
                if (normalized) enrolled.add(normalized);
            });
        });
        if (!enrolled.size) continue;

        const day = (scheduleCache.get(scheduleId).allDays || [])
            .find(item => item.date === clock.date);
        const schedules = [...(day?.schedules || [])];
        const notificationTest = user.attendanceNotificationTest || {};
        const notificationTestLectures = Array.isArray(notificationTest.lectures)
            ? notificationTest.lectures : [notificationTest];
        const notificationTestActive = userDoc.id === "2510044" &&
            notificationTest.enabled === true &&
            notificationTest.date === realClock.date &&
            Date.parse(notificationTest.expiresAt || "") > Date.now() &&
            notificationTestLectures.some(test => enrolled.has(normalizeCourseName(test.subject)));
        if (notificationTestActive) {
            for (const test of notificationTestLectures) {
                if (!enrolled.has(normalizeCourseName(test.subject))) continue;
                schedules.push({
                    subject: test.subject,
                    grade: user.grade || "",
                    period: test.period || 1,
                    classGroup: test.classGroup || "",
                    startTime: test.startTime,
                    endTime: test.endTime,
                    attendanceNotificationTest: true,
                    testId: `${notificationTest.testId || "today"}_${test.period}_${test.classGroup || "all"}`
                });
            }
        }

        const grade =
            String(
                user.grade || ""
            )
            .replace(
                "年",
                ""
            )
            .trim();


        const classSelections =

            user.classSelections &&
            typeof user.classSelections ===
                "object"

                ? user.classSelections

                : {};


        /*
        まず

        ・履修済み
        ・本人の学年

        だけにする。
        */

        const eligibleSchedules =
            schedules.filter(
                item => {

                    if (
                        !enrolled.has(
                            normalizeCourseName(
                                item.subject
                            )
                        )
                    ) {

                        return false;

                    }


                    const itemGrade =
                        String(
                            item.grade || ""
                        )
                        .replace(
                            "年",
                            ""
                        )
                        .trim();


                    if (
                        grade &&
                        itemGrade &&
                        itemGrade !== grade
                    ) {

                        return false;

                    }


                    return true;

                }
            );


        /*
        日付 × 科目 × 時限
        で講義をまとめる。

        同じ科目・同じ時限の
        A/B/Cクラスを1つの選択単位にする。
        */

        const lectureGroups =
            new Map();


        for (
            const rawItem of
            eligibleSchedules
        ) {

            const subject =
                String(
                    rawItem.subject || ""
                ).trim();


            const periodNumber =
                normalizePeriodNumber(
                    rawItem.period
                );


            if (
                !subject ||
                !periodNumber
            ) {

                continue;

            }


            const lectureKey =
                `${clock.date}|${subject}|${periodNumber}`;


            if (
                !lectureGroups.has(
                    lectureKey
                )
            ) {

                lectureGroups.set(
                    lectureKey,
                    {
                        date:
                            clock.date,

                        subject,

                        period:
                            periodNumber,

                        rows:
                            [],

                        options:
                            new Set()
                    }
                );

            }


            const lectureGroup =
                lectureGroups.get(
                    lectureKey
                );


            lectureGroup.rows.push(
                rawItem
            );


            extractClassGroups(
                rawItem.classGroup
            ).forEach(
                value =>
                    lectureGroup
                        .options
                        .add(
                            value
                        )
            );

        }


        /*
        各「日付 × 科目 × 時限」を判定
        */

        for (
            const lectureGroup of
            lectureGroups.values()
        ) {

            const options =
                [
                    ...lectureGroup.options
                ].sort();


            const selectedClass =
                resolveClassSelection(

                    classSelections,

                    lectureGroup.subject,

                    lectureGroup.date,

                    lectureGroup.period

                );


            /*
            classGroupが書かれている講義。

            候補がAだけでも
            クラス選択必須。
            */

            if (
                options.length > 0 &&
                !selectedClass
            ) {

                /*
                出席・退席通知はまだ送らない。

                先に
                「クラスを選んでください」
                Pushを送る。
                */

                await sendClassSelectionNotification(
                    userDoc,
                    {
                        date:
                            lectureGroup.date,

                        subject:
                            lectureGroup.subject,

                        period:
                            lectureGroup.period,

                        options
                    }
                );


                continue;

            }


            /*
            「クラスなし」

            → 本人は今日この講義を受けない。

            出席通知も退席通知も送らない。
            */

            if (
                selectedClass ===
                CLASS_SELECTION_NONE
            ) {

                continue;

            }


            let matchingRows =
                lectureGroup.rows;


            /*
            クラス分けされている場合は
            選択されたクラスだけ残す。
            */

            if (
                options.length > 0
            ) {

                matchingRows =
                    lectureGroup.rows.filter(
                        row => {

                            const rowGroups =
                                extractClassGroups(
                                    row.classGroup
                                );


                            /*
                            classGroupなしの補助情報行
                            */

                            if (
                                rowGroups.length === 0
                            ) {

                                return true;

                            }


                            return (
                                rowGroups.includes(
                                    selectedClass
                                )
                            );

                        }
                    );

            }


            if (
                !matchingRows.length
            ) {

                continue;

            }


            /*
            選択クラスの行を優先
            */

            const preferred =

                matchingRows.find(
                    row =>
                        extractClassGroups(
                            row.classGroup
                        ).includes(
                            selectedClass
                        )
                ) ||

                matchingRows[0];


            const item =
                mergeScheduleRows(
                    matchingRows,
                    preferred
                );


            if (!item) {
                continue;
            }


            const periodNumber =
                lectureGroup.period;


            /*
            通知テストの場合は
            テスト専用scheduleIdを使う。
            */

            const recordScheduleId =

                item.attendanceNotificationTest

                    ? `${scheduleId}_test_${item.testId}`

                    : scheduleId;


            const recordId =
                slotId(
                    recordScheduleId,
                    clock.date,
                    periodNumber,
                    lectureGroup.subject
                );


            const override =
                attendanceOverrides[
                    recordId
                ] || {};


            const defaults =
                PERIOD_TIMES[
                    periodNumber
                ] || {};


            const startTime =

                override.startTime ||

                item.startTime ||

                defaults.startTime;


            const endTime =

                override.endTime ||

                item.endTime ||

                defaults.endTime;


            if (
                !startTime ||
                !endTime
            ) {

                continue;

            }


            /*
            選択済みクラスを通知・打刻側へ渡す。

            クラス指定なしなら空欄。
            */

            const group =

                options.length > 0

                    ? selectedClass

                    : "";


            const notificationType =

                clock.minutes ===
                timeMinutes(
                    startTime
                ) - 10

                    ? "arrival"

                    : clock.minutes ===
                    timeMinutes(
                        endTime
                    ) - 5

                        ? "departure"

                        : "";


            if (
                !notificationType
            ) {

                continue;

            }


            /*
             学生画面が保存する attendanceRecords を確認する。
             定時前に終了打刻済みなら、終了5分前通知は送らない。
            */
            const recordSnapshots =
                await userDoc.ref
                    .collection(
                        "attendanceRecords"
                    )
                    .where(
                        "date",
                        "==",
                        clock.date
                    )
                    .get();


            const record =
                recordSnapshots.docs.find(
                    snapshot => {

                        const data =
                            snapshot.data() || {};

                        return (
                            Number(data.period) ===
                                periodNumber &&
                            data.subject ===
                                lectureGroup.subject &&
                            Boolean(
                                data.attendanceNotificationTest
                            ) === Boolean(
                                item.attendanceNotificationTest
                            ) &&
                            (
                                !item.attendanceNotificationTest ||
                                data.testId ===
                                    item.testId
                            )
                        );
                    }
                );


            if (
                record &&
                (
                    notificationType ===
                        "arrival" ||

                    record.data()
                        .endStampedAt
                    ||
                    record.data()
                        .endKind
                )
            ) {

                continue;

            }


            const dispatchId =

                `${userDoc.id}_` +

                `${recordId}_` +

                `${notificationType}_` +

                `${encodeURIComponent(
                    group || "all"
                )}`;


            const dispatchRef =
                db.collection(
                    "attendanceNotificationDispatches"
                )
                .doc(
                    dispatchId
                );


            let claimed =
                false;


            await db.runTransaction(
                async transaction => {

                    const existing =
                        await transaction.get(
                            dispatchRef
                        );


                    if (
                        existing.exists
                    ) {

                        return;

                    }


                    transaction.create(
                        dispatchRef,
                        {
                            userId:
                                userDoc.id,

                            recordId,

                            notificationType,

                            group,

                            testClock:
                                clock.test ===
                                true,

                            evaluatedDate:
                                clock.date,

                            evaluatedMinutes:
                                clock.minutes,

                            createdAt:
                                new Date()
                        }
                    );


                    claimed =
                        true;

                }
            );


            if (
                !claimed
            ) {

                continue;

            }


            const query =
                new URLSearchParams({

                    action:
                        notificationType,

                    recordId,

                    scheduleId:
                        recordScheduleId,

                    date:
                        clock.date,

                    period:
                        String(
                            periodNumber
                        ),

                    subject:
                        lectureGroup.subject,

                    classGroup:
                        group,

                    startTime,

                    endTime,

                    /*
                     テストの開始・終了打刻を同じ記録へ保存するため、
                     通知URLにもテストIDを渡す。
                    */
                    testId:
                        item.testId ||
                        "",

                    notificationTest:
                        item.attendanceNotificationTest
                            ? "1"
                            : ""

                }).toString();


            const label =
                group
                    ? `（${group}クラス）`
                    : "";


            const payload =

                notificationType ===
                "arrival"

                    ? {

                        title:
                            `📚 出席確認 ${label}`,

                        body:
                            `${lectureGroup.subject}：出席または欠席を選択してください`,

                        url:
                            `${SITE_URL}/attendance_check.html?${query}`,

                        tag:
                            `attendance-${recordId}-${encodeURIComponent(
                                group || "all"
                            )}`

                    }

                    : {

                        title:
                            `🚪 退席確認 ${label}`,

                        body:
                            `${lectureGroup.subject}：退席または早退を選択してください`,

                        url:
                            `${SITE_URL}/attendance_check.html?${query}`,

                        tag:
                            `departure-${recordId}`

                    };


            const results =
                await sendToUserDevices(
                    userDoc.id,
                    payload
                );


            await dispatchRef.update({
                results,
                sentAt:
                    new Date()
            });


            /*
            テスト通知の場合は
            結果をユーザーdocへ保存
            */

            if (
                item.attendanceNotificationTest
            ) {

                await userDoc.ref.update({

                    "attendanceNotificationTest.lastSentAt":
                        new Date(),

                    "attendanceNotificationTest.lastResults":
                        results

                });

            }

        }
    }
}

exports.sendAttendanceNotifications = onSchedule({
    schedule: "* * * * *", timeZone: "Asia/Tokyo", region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY]
}, processAttendanceNotifications);

// ======================
// 出席通知テスト
// 2510044だけに送信
// ======================

exports.sendAttendanceTest =
onRequest(
    {
        secrets: [
            WEB_PUSH_PUBLIC_KEY,
            WEB_PUSH_PRIVATE_KEY
        ]
    },

    async (request, response) => {

        try {

            const studentNumber =
                "2510044";


            const userSnap =
                await db
                    .collection("users")
                    .doc(studentNumber)
                    .get();


            if (!userSnap.exists) {

                response
                    .status(404)
                    .send(
                        "ユーザーが見つかりません"
                    );

                return;

            }


            const subscription =
                userSnap.data()
                    .pushSubscription;


            if (
                !subscription ||
                !subscription.endpoint ||
                !subscription.keys?.p256dh ||
                !subscription.keys?.auth
            ) {

                response
                    .status(400)
                    .send(
                        "pushSubscriptionがありません"
                    );

                return;

            }


            webpush.setVapidDetails(
                "mailto:kidokohei.shonaniryo2517027@gmail.com",
                WEB_PUSH_PUBLIC_KEY.value(),
                WEB_PUSH_PRIVATE_KEY.value()
            );


            const payload =
                JSON.stringify({
                    title:
                        "📅 出席打刻テスト",

                    body:
                        "成人看護学 打刻可能時間です\n出席しますか？",

                    url:
    "https://doko2517027-bit.github.io/university-notifier-web/index.html?attendance=1&subject=成人看護学"
                });


            await webpush.sendNotification(
                subscription,
                payload
            );


            response.send(
                "標準Web Push送信成功"
            );


        } catch (error) {

            console.error(
                "標準Web Push送信エラー:",
                error
            );


            response
                .status(500)
                .send(
                    error.message ||
                    "通知送信に失敗しました"
                );

        }

    }
);


// ======================
// 出席確認待ちを管理者へ通知
// ======================

exports.notifyAttendanceReviewRequired =
onDocumentUpdated(
    {
        document:
            "users/{studentNumber}/attendanceRecords/{recordId}",

        region:
            "asia-northeast1",

        secrets: [
            WEB_PUSH_PUBLIC_KEY,
            WEB_PUSH_PRIVATE_KEY
        ]
    },

    async event => {

        const before =
            event.data.before.data() || {};

        const after =
            event.data.after.data() || {};

        if (
            after.earlyEndReviewRequired !== true ||
            after.earlyEndReviewStatus !== "pending" ||
            before.earlyEndReviewStatus === "pending"
        ) {

            return;

        }

        webpush.setVapidDetails(
            "mailto:kidokohei.shonaniryo2517027@gmail.com",
            WEB_PUSH_PUBLIC_KEY.value(),
            WEB_PUSH_PRIVATE_KEY.value()
        );

        const payload = {
            title:
                "⚠️ 出席確認待ち",

            body:
                `${after.studentNumber || event.params.studentNumber}：` +
                `${after.subject || "科目未設定"} の確認が必要です`,

            url:
                `${SITE_URL}/attendance_admin.html`
        };

        const admins =
            await db.collection("admins").get();

        await Promise.all(
            admins.docs.map(
                admin =>
                    sendToUserDevices(
                        admin.id,
                        payload
                    )
            )
        );
    }
);


// ======================
// テスト問題の答え違い報告
// 管理者全員へWeb Pushを送信
// ======================

exports.notifyQuestionAnswerReport =
onDocumentCreated(
    {
        document: "reports/{reportId}",
        region: "asia-northeast1",
        secrets: [
            WEB_PUSH_PUBLIC_KEY,
            WEB_PUSH_PRIVATE_KEY
        ]
    },

    async event => {

        const snapshot = event.data;

        if (!snapshot) {
            return;
        }

        const report = snapshot.data();

        if (report.type !== "questionAnswer") {
            return;
        }

        webpush.setVapidDetails(
            "mailto:kidokohei.shonaniryo2517027@gmail.com",
            WEB_PUSH_PUBLIC_KEY.value(),
            WEB_PUSH_PRIVATE_KEY.value()
        );

        const adminSnapshot =
            await db.collection("admins").get();

        const payload = JSON.stringify({
            title: "⚠️ テスト問題の答え違い報告",
            body:
                `${report.questionType || "問題"}：` +
                `${String(report.question || "").slice(0, 80)}`,
            url:
                "https://doko2517027-bit.github.io/university-notifier-web/admin.html"
        });

        const notificationTargets = [];

        for (const adminDoc of adminSnapshot.docs) {
            const userRef = db.collection("users").doc(adminDoc.id);
            const deviceSnapshot =
                await userRef.collection("pushSubscriptions").get();
            const seenEndpoints = new Set();

            for (const deviceDoc of deviceSnapshot.docs) {
                const subscription = deviceDoc.data();

                if (
                    subscription?.endpoint &&
                    !seenEndpoints.has(subscription.endpoint)
                ) {
                    seenEndpoints.add(subscription.endpoint);
                    notificationTargets.push({
                        adminId: adminDoc.id,
                        deviceId: deviceDoc.id,
                        subscription,
                        deviceRef: deviceDoc.ref
                    });
                }
            }

            // 端末別データがまだない利用者は旧形式を利用する。
            if (notificationTargets.every(
                target => target.adminId !== adminDoc.id
            )) {
                const userSnapshot = await userRef.get();
                const legacySubscription =
                    userSnapshot.data()?.pushSubscription ||
                    userSnapshot.data()?.subscription;

                if (legacySubscription?.endpoint) {
                    notificationTargets.push({
                        adminId: adminDoc.id,
                        deviceId: "legacy",
                        subscription: legacySubscription,
                        deviceRef: null
                    });
                }
            }
        }

        const results = await Promise.all(
            notificationTargets.map(async target => {
                const {
                    adminId,
                    deviceId,
                    subscription,
                    deviceRef
                } = target;

                if (
                    !subscription?.endpoint ||
                    !subscription?.keys?.p256dh ||
                    !subscription?.keys?.auth
                ) {
                    return {
                        adminId,
                        deviceId,
                        result: "invalid"
                    };
                }

                try {
                    await webpush.sendNotification(subscription, payload);
                    return { adminId, deviceId, result: "sent" };
                } catch (error) {
                    const statusCode = error?.statusCode || null;

                    if (
                        deviceRef &&
                        (statusCode === 404 || statusCode === 410)
                    ) {
                        await deviceRef.delete();
                    }

                    return {
                        adminId,
                        deviceId,
                        result:
                            statusCode === 404 || statusCode === 410
                                ? "expired"
                                : "failed",
                        statusCode
                    };
                }
            })
        );

        await snapshot.ref.update({
            notificationSentAt:
                new Date(),
            notificationResults: results
        });

    }
);

// お問い合わせは2510044の全登録端末にだけ通知する。
exports.notifyContactMessage = onDocumentCreated(
    { document:"contacts/{contactId}", region:"asia-northeast1", secrets:[WEB_PUSH_PUBLIC_KEY,WEB_PUSH_PRIVATE_KEY] },
    async event => {
        const snapshot=event.data;
        if(!snapshot)return;
        const contact=snapshot.data();
        webpush.setVapidDetails("mailto:kidokohei.shonaniryo2517027@gmail.com",WEB_PUSH_PUBLIC_KEY.value(),WEB_PUSH_PRIVATE_KEY.value());
        const devices=await db.collection("users").doc("2510044").collection("pushSubscriptions").get();
        const payload=JSON.stringify({title:"📨 CareMate お問い合わせ",body:`${contact.category||"お問い合わせ"}：${String(contact.message||"").slice(0,80)}`,url:"https://doko2517027-bit.github.io/university-notifier-web/contact_admin.html"});
        const results=await Promise.all(devices.docs.map(async device=>{try{await webpush.sendNotification(device.data(),payload);return{deviceId:device.id,result:"sent"};}catch(error){if(error?.statusCode===404||error?.statusCode===410)await device.ref.delete();return{deviceId:device.id,result:"failed",statusCode:error?.statusCode||null};}}));
        await snapshot.ref.update({notificationSentAt:new Date(),notificationResults:results});
    }
);
