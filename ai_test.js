async function sendMessage() {

    const messageInput =
        document.getElementById("message");

    const result =
        document.getElementById("result");

    const message =
        messageInput.value.trim();

    if (!message) {
        alert("メッセージを入力してください。");
        return;
    }

    result.textContent = "送信中...";

    try {

        const response = await fetch(
            "https://caremate-ai-server.onrender.com/api/chat",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "AI通信に失敗しました");
        }

        result.textContent = data.reply;

    } catch (e) {

        console.error(e);
        result.textContent = "エラー: " + e.message;

    }

}