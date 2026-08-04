const {
    onRequest
} = require("firebase-functions/v2/https");

const {
    onDocumentCreated
} = require("firebase-functions/v2/firestore");

const { onSchedule } = require("firebase-functions/v2/scheduler");

const {
    defineSecret
} = require("firebase-functions/params");

const {
    initializeApp
} = require("firebase-admin/app");

const {
    getFirestore
} = require("firebase-admin/firestore");

const webpush =
    require("web-push");

const {
    PERIOD_TIMES,
    normalizeCourseName,
    slotId
} = require("./attendance_policy");


initializeApp();

const db =
    getFirestore();

const SITE_URL = "https://doko2517027-bit.github.io/university-notifier-web";

const WEB_PUSH_PUBLIC_KEY = defineSecret("WEB_PUSH_PUBLIC_KEY");
const WEB_PUSH_PRIVATE_KEY = defineSecret("WEB_PUSH_PRIVATE_KEY");

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

// 個人時間割（公式PDF×履修科目）からだけ出席・退席通知を生成する。
exports.sendAttendanceNotifications = onSchedule({
    schedule: "* * * * *", timeZone: "Asia/Tokyo", region: "asia-northeast1",
    secrets: [WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY]
}, async () => {
    webpush.setVapidDetails("mailto:kidokohei.shonaniryo2517027@gmail.com",
        WEB_PUSH_PUBLIC_KEY.value(), WEB_PUSH_PRIVATE_KEY.value());
    const clock = tokyoParts();
    const scheduleCache = new Map();
    const appSettings = (await db.collection("system").doc("app").get()).data() || {};
    const attendanceOverrides = appSettings.attendanceOverrides || {};
    const users = await db.collection("users").get();

    for (const userDoc of users.docs) {
        const user = userDoc.data() || {};
        const scheduleId = scheduleDocumentId(user);
        if (!scheduleId) continue;
        if (!scheduleCache.has(scheduleId)) {
            scheduleCache.set(scheduleId, (await db.collection("schedule").doc(scheduleId).get()).data() || {});
        }
        const day = (scheduleCache.get(scheduleId).allDays || [])
            .find(item => item.date === clock.date);
        if (!day) continue;

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

        const grade = String(user.grade || "").replace("年", "").trim();
        for (const item of day.schedules || []) {
            if (!enrolled.has(normalizeCourseName(item.subject))) continue;
            if (grade && String(item.grade || "").replace("年", "").trim() !== grade) continue;

            const periodNumber = Number.parseInt(item.period, 10);
            const recordId = slotId(scheduleId, clock.date, periodNumber, item.subject);
            const override = attendanceOverrides[recordId] || {};
            const defaults = PERIOD_TIMES[periodNumber] || {};
            const startTime = override.startTime || item.startTime || defaults.startTime;
            const endTime = override.endTime || item.endTime || defaults.endTime;
            const preference = user.attendancePreferences?.[encodeURIComponent(item.subject)] || {};
            if (preference.classGroup && item.classGroup && preference.classGroup !== item.classGroup) continue;

            const group = item.classGroup || "";
            const notificationType = clock.minutes === timeMinutes(startTime) - 10 ? "arrival"
                : clock.minutes === timeMinutes(endTime) - 5 ? "departure" : "";
            if (!notificationType) continue;

            const record = await db.collection("attendance").doc(userDoc.id)
                .collection("subjects").doc(encodeURIComponent(item.subject))
                .collection("records").doc(recordId).get();
            if (record.exists && (notificationType === "arrival" || record.data().checkOutAt)) continue;
            const dispatchId = `${userDoc.id}_${recordId}_${notificationType}_${encodeURIComponent(group || "all")}`;
            const dispatchRef = db.collection("attendanceNotificationDispatches").doc(dispatchId);
            let claimed = false;
            await db.runTransaction(async transaction => {
                const existing = await transaction.get(dispatchRef);
                if (existing.exists) return;
                transaction.create(dispatchRef, { userId: userDoc.id, recordId, notificationType, group, createdAt: new Date() });
                claimed = true;
            });
            if (!claimed) continue;

            const query = new URLSearchParams({ action: notificationType, recordId, scheduleId,
                date: clock.date, period: String(periodNumber), subject: item.subject,
                classGroup: group, startTime, endTime }).toString();
            const label = group ? `（${group}）` : "";
            const payload = notificationType === "arrival"
                ? { title: `📚 出席確認 ${label}`, body: `${item.subject}：出席または欠席を選択してください`, url: `${SITE_URL}/attendance_check.html?${query}`, tag: `attendance-${recordId}-${encodeURIComponent(group || "all")}` }
                : { title: `🚪 退席確認 ${label}`, body: `${item.subject}：退席または早退を選択してください`, url: `${SITE_URL}/attendance_check.html?${query}`, tag: `departure-${recordId}` };
            const results = await sendToUserDevices(userDoc.id, payload);
            await dispatchRef.update({ results, sentAt: new Date() });
        }
    }
});


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
