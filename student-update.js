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

    if (!/^\d{7}$/.test(value)) {

        alert("学生番号は7桁の数字で入力してください。");
        return;

    }

    const year = value.substring(0, 2);
    const department = value.substring(2, 4);
    const number = parseInt(value.substring(4));

    if (
        year !== "25" &&
        year !== "26"
    ) {

        alert("学生番号が正しくありません。");
        return;

    }

    if (
        department !== "10" &&
        department !== "20" &&
        department !== "30"
    ) {

        alert("学生番号が正しくありません。");
        return;

    }

    if (
        department === "10" &&
        (number < 1 || number > 200)
    ) {

        alert("学生番号が正しくありません。");
        return;

    }

    if (
        department === "20" &&
        (number < 1 || number > 60)
    ) {

        alert("学生番号が正しくありません。");
        return;

    }

    if (
        department === "30" &&
        (number < 1 || number > 60)
    ) {

        alert("学生番号が正しくありません。");
        return;

    }

    localStorage.setItem(
        "studentNumber",
        value
    );

    alert("登録が完了しました。");

    location.href = "index.html";

});