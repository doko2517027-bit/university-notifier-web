self.addEventListener("push", event => {

    const data = event.data.json();

    event.waitUntil(

        self.registration.showNotification(
            data.title,
            {
                body: data.body,
                icon: "icon-192.png",
                badge: "icon-192.png",
                data: { url: data.url || "./index.html" },
                tag: data.tag || undefined,
                renotify: Boolean(data.tag)
            }
        )

    );

});

self.addEventListener("notificationclick", event => {

    event.notification.close();

    const notificationData=event.notification.data;
    const targetUrl=new URL(
        typeof notificationData==="string"
            ? notificationData
            : notificationData?.url||"./index.html",
        self.location.origin
    ).href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(async clientList => {

            for (const client of clientList) {

                if ("focus" in client && "navigate" in client) {
                    try {
                        await client.navigate(targetUrl);
                        return await client.focus();
                    } catch (error) {
                        // 別オリジン等で再利用できない場合は新しい画面を開く。
                    }
                }

            }

            return clients.openWindow(targetUrl);

        })
    );

});
