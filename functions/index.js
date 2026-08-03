const {
    onRequest
} = require("firebase-functions/v2/https");

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