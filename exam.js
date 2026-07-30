import {
    db,
    setupTheme,
    initializePage,
    loadProfileImage
} from "./common.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const examTitle =
    document.getElementById("examTitle");

const subjectUnitList =
    document.getElementById("subjectUnitList");

setupTheme(themeButton);

await initializePage([
    loadProfileImage(topProfileImage),
    loadExam(),
    loadSubjectUnits()
]);

document
.getElementById("backButton")
.onclick = () => {

    history.back();

};

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};

async function loadExam() {

    const snap = await getDoc(
        doc(db, "system", "exam")
    );

    if (!snap.exists()) {

        examTitle.textContent =
            "テスト対策";

        examCountdown.textContent =
            "テスト情報はまだ登録されていません。";

        return;

    }

    const exam = snap.data();

    if (exam.enabled !== true) {

        examTitle.textContent =
            "テスト対策";

        examCountdown.textContent =
            "現在、テストモードはOFFです。";

        return;

    }

    examTitle.textContent =
        exam.title || "テスト対策";

    const today = new Date();
    const start = new Date(exam.startDate);
    const end = new Date(exam.endDate);

    const diffToStart =
        Math.ceil((start - today) / (1000 * 60 * 60 * 24));

    const diffToEnd =
        Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (today < start) {

        examCountdown.textContent =
            `開始まであと${diffToStart}日です。`;

    } else if (today <= end) {

        examCountdown.textContent =
            `終了まであと${diffToEnd}日です。`;

    } else {

        examCountdown.textContent =
            "テスト期間は終了しました。";

    }

}

async function loadSubjectUnits() {

    const subjectSnap = await getDocs(
        query(
            collection(db, "examSubjects"),
            orderBy("createdAt", "desc")
        )
    );

    if (subjectSnap.empty) {
        subjectUnitList.innerHTML =
            "科目はまだありません。";
        return;
    }

    subjectUnitList.innerHTML = "";

    for (const subjectDoc of subjectSnap.docs) {

        const subject = subjectDoc.data();

        const subjectCard = document.createElement("div");
        subjectCard.className = "card setting-card";

        const subjectHeader = document.createElement("div");
        subjectHeader.innerHTML = `
            <h2>📚 ${subject.name}</h2>
            <p>タップして単元を表示</p>
        `;

        const unitList = document.createElement("div");
        unitList.style.display = "none";

        subjectHeader.onclick = () => {
            unitList.style.display =
                unitList.style.display === "none"
                    ? "block"
                    : "none";
        };

        const unitSnap = await getDocs(
            query(
                collection(
                    db,
                    "examSubjects",
                    subjectDoc.id,
                    "units"
                ),
                orderBy("createdAt", "desc")
            )
        );

        if (unitSnap.empty) {

            unitList.innerHTML =
                "<p>単元はまだありません。</p>";

        } else {

            const published = await Promise.all(

                unitSnap.docs.map(async (unitDoc) => {

                    const publishedSnap = await getDoc(
                        doc(
                            db,
                            "examSubjects",
                            subjectDoc.id,
                            "units",
                            unitDoc.id,
                            "publishedQuestions",
                            "published"
                        )
                    );

                    return {
                        unitDoc,
                        unit: unitDoc.data(),
                        data: publishedSnap.exists()
                            ? publishedSnap.data()
                            : {}
                    };

                })

            );

            for (const { unitDoc, unit, data } of published) {

                const hasDailyQuestion =
                    data.today_question &&
                    typeof data.today_question.question === "string" &&
                    data.today_question.question.trim() !== "" &&
                    Array.isArray(data.today_question.choices) &&
                    data.today_question.choices.length > 0;

                const hasFillBlank =
                    Array.isArray(data.fill_blank) &&
                    data.fill_blank.some(q =>
                        q &&
                        typeof q.question === "string" &&
                        q.question.trim() !== "" &&
                        (
                            (
                                Array.isArray(q.answers) &&
                                q.answers.some(answer =>
                                    String(answer).trim() !== ""
                                )
                            ) ||
                            String(q.answer || "").trim() !== ""
                        )
                    );

                const hasQuiz =
                    Array.isArray(data.quiz) &&
                    data.quiz.some(q =>
                        q &&
                        typeof q.question === "string" &&
                        q.question.trim() !== "" &&
                        Array.isArray(q.choices) &&
                        q.choices.length > 0 &&
                        q.choices.every(choice =>
                            String(choice).trim() !== ""
                        ) &&
                        q.answer !== undefined &&
                        q.answer !== null
                    );

                const hasImportantPoints =
                    Array.isArray(data.important_points) &&
                    data.important_points.some(point =>
                        typeof point === "string" &&
                        point.trim() !== ""
                    );

                let menuHtml = "";

                if (hasDailyQuestion) {
                    menuHtml += `
                        <div
                            class="card setting-card"
                            onclick="location.href='daily_question.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                            <h3>🎯 今日の1問</h3>
                            <p>日替わり問題</p>
                        </div>
                    `;
                }

                if (hasFillBlank) {
                    menuHtml += `
                        <div
                            class="card setting-card"
                            onclick="location.href='fill_blank.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                            <h3>📝 穴埋め問題</h3>
                            <p>穴埋め問題に挑戦</p>
                        </div>
                    `;
                }

                if (hasQuiz) {
                    menuHtml += `
                        <div
                            class="card setting-card"
                            onclick="location.href='quiz.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                            <h3>🧠 四択問題</h3>
                            <p>四択問題に挑戦</p>
                        </div>
                    `;
                }

                if (hasImportantPoints) {
                    menuHtml += `
                        <div
                            class="card setting-card"
                            onclick="location.href='must_remember.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                            <h3>⭐ ここだけ覚えろ</h3>
                            <p>重要ポイントを確認</p>
                        </div>
                    `;
                }

                if (
                    !hasDailyQuestion &&
                    !hasFillBlank &&
                    !hasQuiz &&
                    !hasImportantPoints
                ) {
                    continue;
                }

                const unitCard =
                    document.createElement("div");

                unitCard.className =
                    "card setting-card";

                const unitHeader =
                    document.createElement("div");

                unitHeader.innerHTML = `
                    <h3>📘 ${unit.name}</h3>
                    <p>${unit.range || ""}</p>
                `;

                const menu =
                    document.createElement("div");

                menu.style.display = "none";

                menu.innerHTML = menuHtml;

                unitHeader.onclick = () => {
                    menu.style.display =
                        menu.style.display === "none"
                            ? "block"
                            : "none";
                };

                unitCard.appendChild(unitHeader);
                unitCard.appendChild(menu);
                unitList.appendChild(unitCard);

            }

        }

        if (unitList.children.length === 0) {
            continue;
        }

        subjectCard.appendChild(subjectHeader);
        subjectCard.appendChild(unitList);
        subjectUnitList.appendChild(subjectCard);

    }

    if (subjectUnitList.children.length === 0) {
        subjectUnitList.innerHTML =
            "表示できる問題はまだありません。";
    }

}