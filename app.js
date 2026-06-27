const button = document.getElementById("subscribe");

button.addEventListener("click", async () => {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
        alert("通知が許可されました！");
    } else {
        alert("通知が拒否されました。");
    }
});