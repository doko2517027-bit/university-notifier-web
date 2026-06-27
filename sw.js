self.addEventListener("push", (event) => {

    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "icon-192.png",
            badge: "icon-192.png"
        })
    );

});