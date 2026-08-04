const {
    onRequest
} = require("firebase-functions/v2/https");

const {
    onDocumentCreated
} = require("firebase-functions/v2/firestore");

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


initializeApp();

const db =
    getFirestore();


const WEB_PUSH_PUBLIC_KEY =
    defineSecret(
        "WEB_PUSH_PUBLIC_KEY"
    );

const WEB_PUSH_PRIVATE_KEY =
    defineSecret(
        "WEB_PUSH_PRIVATE_KEY"
    );



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

        const results = await Promise.allSettled(
            adminSnapshot.docs.map(async adminDoc => {

                const userSnapshot =
                    await db.collection("users")
                        .doc(adminDoc.id)
                        .get();

                const subscription =
                    userSnapshot.data()?.pushSubscription ||
                    userSnapshot.data()?.subscription;

                if (
                    !subscription?.endpoint ||
                    !subscription?.keys?.p256dh ||
                    !subscription?.keys?.auth
                ) {
                    return "subscription-missing";
                }

                await webpush.sendNotification(
                    subscription,
                    payload
                );

                return "sent";

            })
        );

        await snapshot.ref.update({
            notificationSentAt:
                new Date(),
            notificationResults:
                results.map(result =>
                    result.status === "fulfilled"
                        ? result.value
                        : "failed"
                )
        });

    }
);
