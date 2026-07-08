self.addEventListener("push", event => {

    const data = event.data.json();

    event.waitUntil(

        self.registration.showNotification(
            data.title,
            {
                body: data.body,
                icon: "icon-192.png",
                badge: "icon-192.png",
                data: data.url
            }
        )

    );

});

self.addEventListener("notificationclick", event => {

    event.notification.close();

    const targetUrl =
        event.notification.data || "./index.html";

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clientList => {

            for (const client of clientList) {

                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }

            }

            return clients.openWindow(targetUrl);

        })
    );

});