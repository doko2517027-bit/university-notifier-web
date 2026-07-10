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

        let unitHtml = "";

        unitSnap.forEach(unitDoc => {

            const unit = unitDoc.data();

            unitHtml += `
                <div class="card setting-card">

                    <h3>📘 ${unit.name}</h3>

                    <p>
                        ${unit.range || ""}
                    </p>

                    <div
                        class="card setting-card"
                        onclick="location.href='daily_question.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                        <h3>🎯 今日の1問</h3>
                        <p>AIが作成した日替わり問題</p>
                    </div>

                    <div
                        class="card setting-card"
                        onclick="location.href='fill_blank.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                        <h3>📝 AI穴埋め</h3>
                        <p>講義資料から作成した穴埋め問題</p>
                    </div>

                    <div
                        class="card setting-card"
                        onclick="location.href='quiz.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                        <h3>🧠 AI四択</h3>
                        <p>講義資料から作成した四択問題</p>
                    </div>

                    <div
                        class="card setting-card"
                        onclick="location.href='must_remember.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                        <h3>⭐ ここだけ覚えろ</h3>
                        <p>重要ポイントだけ確認</p>
                    </div>

                    <div
                        class="card setting-card"
                        onclick="location.href='weakness.html?subjectId=${subjectDoc.id}&unitId=${unitDoc.id}'">
                        <h3>📊 苦手ランキング</h3>
                        <p>間違えやすい問題を確認</p>
                    </div>

                </div>
            `;

        });

        subjectUnitList.innerHTML += `
            <div class="card setting-card">

                <h2>📚 ${subject.name}</h2>

                ${unitHtml || "<p>単元はまだありません。</p>"}

            </div>
        `;

    }

}