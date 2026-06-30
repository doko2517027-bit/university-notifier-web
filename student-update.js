const studentNumber =
    document.getElementById("studentNumber");

document
.getElementById("register")
.addEventListener("click", () => {

    const value = studentNumber.value.trim();

    if (value === "") {

        alert("学生番号を入力してください。");
        return;

    }

    localStorage.setItem(
        "studentNumber",
        value
    );

    alert("登録が完了しました。");

    location.href = "index.html";

});