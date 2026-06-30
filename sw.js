self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(clients.claim());
});

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

    event.waitUntil(
        clients.openWindow(event.notification.data)
    );

});