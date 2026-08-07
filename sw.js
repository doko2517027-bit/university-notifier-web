/* ========================================
   CareMate Service Worker
   Push通知・通知タップ処理
======================================== */


/* ========================================
   Service Worker更新
======================================== */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(
            self.skipWaiting()
        );

    }
);


self.addEventListener(
    "activate",
    event => {

        event.waitUntil(
            self.clients.claim()
        );

    }
);


/* ========================================
   Push通知受信
======================================== */

self.addEventListener(
    "push",
    event => {

        event.waitUntil(
            handlePushEvent(
                event
            )
        );

    }
);


/**
 * Push通知を表示する。
 */
async function handlePushEvent(
    event
) {

    const data =
        readPushData(
            event
        );


    const notificationType =
        resolveNotificationType(
            data
        );


    const targetUrl =
        createAttendanceTargetUrl(
            data,
            notificationType
        );


    const actions =
        createNotificationActions(
            notificationType
        );


    const title =
        data.title ||
        getDefaultTitle(
            notificationType
        );


    const body =
        data.body ||
        getDefaultBody(
            notificationType
        );


    const tag =
        data.tag ||
        createNotificationTag(
            data,
            notificationType
        );


    const options = {

        body,

        icon:
            data.icon ||
            "/icon-192.png",

        badge:
            data.badge ||
            "/icon-192.png",

        tag,

        renotify:
            Boolean(tag),

        requireInteraction:
            true,

        timestamp:
            Date.now(),

        actions,

        data: {

            url:
                targetUrl.href,

            notificationType,

            defaultAction:
                getDefaultAction(
                    notificationType
                ),

            subject:
                normalizeText(
                    data.subject
                ),

            period:
                normalizePeriod(
                    data.period
                ),

            date:
                normalizeDate(
                    data.date ||
                    data.attendanceDate
                ),

            expiresAt:
                normalizeText(
                    data.expiresAt
                )

        }

    };


    await self.registration
        .showNotification(
            title,
            options
        );

}


/* ========================================
   Pushデータ取得
======================================== */

/**
 * Pushデータを安全に読み込む。
 */
function readPushData(
    event
) {

    if (!event.data) {

        return {};

    }


    try {

        const json =
            event.data.json();


        if (
            json &&
            typeof json === "object"
        ) {

            return json;

        }

    } catch (error) {

        console.warn(
            "Push JSON取得失敗:",
            error
        );

    }


    try {

        const text =
            event.data.text();


        return {

            title:
                "CareMate",

            body:
                text

        };

    } catch (error) {

        console.warn(
            "Pushテキスト取得失敗:",
            error
        );


        return {};

    }

}


/* ========================================
   通知種類
======================================== */

/**
 * 通知種類を決める。
 *
 * start
 * 講義開始10分前通知
 *
 * end
 * 講義終了5分前通知
 */
function resolveNotificationType(
    data
) {

    const directValue =
        normalizeText(

            data.notificationType ||

            data.attendanceType ||

            data.type ||

            data.action

        ).toLowerCase();


    if (
        [
            "start",
            "arrival",
            "attendance",
            "present"
        ].includes(
            directValue
        )
    ) {

        return "start";

    }


    if (
        [
            "end",
            "finish",
            "departure"
        ].includes(
            directValue
        )
    ) {

        return "end";

    }


    const rawUrl =
        normalizeText(
            data.url
        );


    if (rawUrl) {

        try {

            const url =
                new URL(
                    rawUrl,
                    self.location.origin
                );


            const urlAction =
                normalizeText(
                    url.searchParams.get(
                        "action"
                    )
                ).toLowerCase();


            if (
                [
                    "start",
                    "arrival",
                    "attendance",
                    "present"
                ].includes(
                    urlAction
                )
            ) {

                return "start";

            }


            if (
                [
                    "end",
                    "finish",
                    "departure"
                ].includes(
                    urlAction
                )
            ) {

                return "end";

            }

        } catch (error) {

            console.warn(
                "Push URL解析失敗:",
                error
            );

        }

    }


    return "general";

}


/* ========================================
   通知ボタン
======================================== */

/**
 * 通知に表示する操作ボタンを返す。
 */
function createNotificationActions(
    notificationType
) {

    /*
     * 開始通知。
     *
     * 開始打刻または欠席を選べる。
     */
    if (
        notificationType ===
        "start"
    ) {

        return [

            {
                action:
                    "start",

                title:
                    "開始打刻"
            },

            {
                action:
                    "absent",

                title:
                    "欠席"
            }

        ];

    }


    /*
     * 終了通知。
     *
     * 早退通知は出さない。
     * 終了打刻だけ表示する。
     */
    if (
        notificationType ===
        "end"
    ) {

        return [

            {
                action:
                    "end",

                title:
                    "終了打刻"
            }

        ];

    }


    return [];

}


/* ========================================
   通知文
======================================== */

function getDefaultTitle(
    notificationType
) {

    if (
        notificationType ===
        "start"
    ) {

        return "講義開始10分前です";

    }


    if (
        notificationType ===
        "end"
    ) {

        return "講義終了5分前です";

    }


    return "CareMate";

}


function getDefaultBody(
    notificationType
) {

    if (
        notificationType ===
        "start"
    ) {

        return (
            "講義の開始打刻をしてください。"
        );

    }


    if (
        notificationType ===
        "end"
    ) {

        return (
            "講義の終了打刻をしてください。"
        );

    }


    return (
        "CareMateからのお知らせです。"
    );

}


/* ========================================
   通知URL
======================================== */

/**
 * 通知から開く出席管理画面URLを作る。
 */
function createAttendanceTargetUrl(
    data,
    notificationType
) {

    let url;


    try {

        url =
            new URL(

                data.url ||
                "/attendance.html",

                self.location.origin

            );

    } catch (error) {

        console.warn(
            "通知URL作成失敗:",
            error
        );


        url =
            new URL(
                "/attendance.html",
                self.location.origin
            );

    }


    /*
     * 出席通知は必ず
     * attendance.htmlへ移動させる。
     */
    if (
        notificationType === "start" ||
        notificationType === "end"
    ) {

        url.pathname =
            "/university-notifier-web/attendance.html";

    }


    const subject =
        normalizeText(
            data.subject
        );


    const period =
        normalizePeriod(
            data.period
        );


    const date =
        normalizeDate(

            data.date ||

            data.attendanceDate

        );


    if (subject) {

        url.searchParams.set(
            "subject",
            subject
        );

    }


    if (period) {

        url.searchParams.set(
            "period",
            String(period)
        );

    }


    if (date) {

        url.searchParams.set(
            "date",
            date
        );

    }


    if (
        notificationType ===
        "start"
    ) {

        url.searchParams.set(
            "action",
            "start"
        );


        url.searchParams.set(
            "source",
            "start_notification"
        );

    }


    if (
        notificationType ===
        "end"
    ) {

        url.searchParams.set(
            "action",
            "end"
        );


        url.searchParams.set(
            "source",
            "end_notification"
        );

    }


    return url;

}


/* ========================================
   通知タグ
======================================== */

function createNotificationTag(
    data,
    notificationType
) {

    const date =
        normalizeDate(

            data.date ||

            data.attendanceDate

        ) ||
        "today";


    const period =
        normalizePeriod(
            data.period
        ) ||
        "unknown";


    const subject =
        normalizeText(
            data.subject
        ) ||
        "lecture";


    return [

        "attendance",

        notificationType,

        date,

        period,

        subject

    ].join("-");

}


/* ========================================
   通知タップ
======================================== */

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        event.waitUntil(
            handleNotificationClick(
                event
            )
        );

    }
);


/**
 * 通知または通知ボタンを押した時の処理。
 */
async function handleNotificationClick(
    event
) {

    const notificationData =
        event.notification.data ||
        {};


    const targetUrl =
        createClickTargetUrl(

            notificationData,

            event.action

        );


    const clientList =
        await self.clients.matchAll({

            type:
                "window",

            includeUncontrolled:
                true

        });


    /*
     * CareMateがすでに開いている場合は、
     * その画面を出席管理へ移動して前面表示する。
     */
    for (
        const client of clientList
    ) {

        try {

            const clientUrl =
                new URL(
                    client.url
                );


            if (
                clientUrl.origin !==
                self.location.origin
            ) {

                continue;

            }


            if (
                "navigate" in client
            ) {

                await client.navigate(
                    targetUrl.href
                );

            }


            if (
                "focus" in client
            ) {

                return client.focus();

            }

        } catch (error) {

            console.warn(
                "既存画面の再利用失敗:",
                error
            );

        }

    }


    /*
     * 開いている画面がなければ
     * 新しい画面を開く。
     */
    return self.clients.openWindow(
        targetUrl.href
    );

}


/* ========================================
   タップ後URL
======================================== */

/**
 * 押された通知ボタンをURLへ反映する。
 */
function createClickTargetUrl(
    notificationData,
    clickedAction
) {

    let url;


    try {

        url =
            new URL(

                notificationData.url ||

                "/attendance.html",

                self.location.origin

            );

    } catch {

        url =
            new URL(
                "/attendance.html",
                self.location.origin
            );

    }


    const notificationType =
        normalizeText(
            notificationData
                .notificationType
        );


    const action =
        normalizeClickedAction(

            clickedAction ||

            notificationData
                .defaultAction ||

            notificationType

        );


    if (action) {

        url.searchParams.set(
            "action",
            action
        );

    }


    if (
        action === "start" ||
        action === "absent"
    ) {

        url.searchParams.set(
            "source",
            "start_notification"
        );

    }


    if (
        action === "end"
    ) {

        url.searchParams.set(
            "source",
            "end_notification"
        );

    }


    const subject =
        normalizeText(
            notificationData.subject
        );


    const period =
        normalizePeriod(
            notificationData.period
        );


    const date =
        normalizeDate(
            notificationData.date
        );


    if (subject) {

        url.searchParams.set(
            "subject",
            subject
        );

    }


    if (period) {

        url.searchParams.set(
            "period",
            String(period)
        );

    }


    if (date) {

        url.searchParams.set(
            "date",
            date
        );

    }


    return url;

}


/**
 * 古い通知ボタン名も
 * 新しい名前へ変換する。
 */
function normalizeClickedAction(
    value
) {

    const action =
        normalizeText(
            value
        ).toLowerCase();


    const aliases = {

        start:
            "start",

        arrival:
            "start",

        attendance:
            "start",

        present:
            "start",

        absent:
            "absent",

        absence:
            "absent",

        end:
            "end",

        finish:
            "end",

        departure:
            "end"

    };


    return (
        aliases[action] ||
        ""
    );

}


/* ========================================
   初期操作
======================================== */

function getDefaultAction(
    notificationType
) {

    if (
        notificationType ===
        "start"
    ) {

        return "start";

    }


    if (
        notificationType ===
        "end"
    ) {

        return "end";

    }


    return "";

}


/* ========================================
   共通変換
======================================== */

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


function normalizePeriod(
    value
) {

    const period =
        Number(
            String(
                value ?? ""
            )
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
        : "";

}


function normalizeDate(
    value
) {

    const text =
        normalizeText(
            value
        );


    if (!text) {

        return "";

    }


    const cleaned =
        text

            .replace(
                /年|\/|\./g,
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


    const match =
        cleaned.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (!match) {

        return "";

    }


    return (

        `${match[1]}-` +

        `${match[2].padStart(
            2,
            "0"
        )}-` +

        `${match[3].padStart(
            2,
            "0"
        )}`

    );

}