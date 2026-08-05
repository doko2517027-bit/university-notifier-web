self.addEventListener("push", event => {

    const data = event.data.json();

    const targetUrl=data.url||"./index.html";
    const isArrival=new URL(targetUrl,self.location.origin).searchParams.get("action")==="arrival";
    event.waitUntil(

        self.registration.showNotification(
            data.title,
            {
                body: data.body,
                icon: "icon-192.png",
                badge: "icon-192.png",
                data: { url: targetUrl },
                tag: data.tag || undefined,
                renotify: Boolean(data.tag),
                actions: isArrival ? [
                    { action: "attendance", title: "出席" },
                    { action: "absence", title: "欠席" }
                ] : []
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
    );
    if(event.action==="attendance")targetUrl.searchParams.set("choice","arrival");
    if(event.action==="absence")targetUrl.searchParams.set("choice","absence");
    const targetHref=targetUrl.href;

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(async clientList => {

            for (const client of clientList) {

                if ("focus" in client && "navigate" in client) {
                    try {
                        await client.navigate(targetHref);
                        return await client.focus();
                    } catch (error) {
                        // 別オリジン等で再利用できない場合は新しい画面を開く。
                    }
                }

            }

            return clients.openWindow(targetHref);

        })
    );

});
