const PUBLIC_KEY = "BJk2fKTmfe7AZuXjW-IGMDyis_zN0iZ1B0oiG5MVefZ4n3W9mrBu-xBiWYjG_V6U2b5sGMuVXvKTbrwRKXSAiUs";

const button = document.getElementById("subscribe");

button.addEventListener("click", async () => {

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        alert("通知が拒否されました");
        return;
    }

    const registration = await navigator.serviceWorker.register("sw.js");

    await navigator.serviceWorker.ready;

    const subscription =

        await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY)
        });

   document.body.innerHTML += `
   <pre>${JSON.stringify(subscription, null, 2)}</pre>
   `;

    alert("登録完了！");

});

function urlBase64ToUint8Array(base64String) {

    const padding = "=".repeat((4 - base64String.length % 4) % 4);

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

}