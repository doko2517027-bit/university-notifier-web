console.log("settings.js 読み込み成功");
const VERSION = "3.0.0";

document.getElementById("departmentText").textContent =
    localStorage.getItem("department") || "未登録";

document.getElementById("majorText").textContent =
    localStorage.getItem("major") || "なし";

document.getElementById("gradeText").textContent =
    localStorage.getItem("grade") || "未登録";

document.getElementById("versionText").textContent =
    `Version ${VERSION}`;

// 戻るボタン
document
    .getElementById("back")
    .addEventListener("click", () => {

        history.back();

    });

// ダークモード
const themeButton = document.getElementById("themeButton");

console.log(themeButton);

// 前回の設定を反映
if (localStorage.getItem("theme") === "dark") {

    document.body.classList.add("dark");
    themeButton.textContent = "☀️";

} else {

    themeButton.textContent = "🌙";

}

// ボタンを押した時
themeButton.addEventListener("click", () => {

    console.log("themeボタン押された");

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {

        localStorage.setItem("theme", "dark");
        themeButton.textContent = "☀️";

    } else {

        localStorage.setItem("theme", "light");
        themeButton.textContent = "🌙";

    }

});