import {
    db,
    studentNumber,
    setupTheme,
    loadProfileImage,
    loadUserName,
    initializePage,
    showAssignmentSkeleton,
    setupAdminTab,
    setupOfflineAlert,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
} from "./common.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const userName = document.getElementById("userName");
const assignmentList = document.getElementById("assignmentList");
if(assignmentList){
    showAssignmentSkeleton(assignmentList);
}
const themeButton = document.getElementById("themeButton");
const loggedIn = localStorage.getItem("loggedIn");
const topProfileImage = document.getElementById("topProfileImage");

if (loggedIn !== "true") {
    location.href = "login.html";
}

await initializePage([
    
    setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadAssignments(),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()

]);

setupTheme(themeButton);

async function loadAssignments() {

    if (!studentNumber) {
        assignmentList.innerHTML = "ログインしてください。";
        return;
    }

    const snap = await getDoc(
        doc(db, "assignments", studentNumber)
    );

    if (!snap.exists()) {
        assignmentList.innerHTML = "未提出課題はありません。";
        return;
    }

    const data = snap.data();

    const assignments = data.assignments || [];

    if (assignments.length === 0) {
        assignmentList.innerHTML = "未提出課題はありません。";
        return;
    }

    assignmentList.innerHTML = "";

    assignments.forEach(item => {

        const course =
            item.course ||
            item.courseName ||
            item.subject ||
            "科目名なし";

        const title =
            item.title ||
            item.name ||
            "課題名なし";

        const deadline =
            item.deadline ||
            item.due ||
            item.limit ||
            "締切不明";

        const rawCourseUrl =
            item.courseUrl ||
            "";

        const url =
            item.url
                ? "https://sums.manaba.jp/ct/" + item.url
                : "";

        assignmentList.innerHTML += `
            <div class="switch-card">
                <h3>📚 ${course}</h3>

                <p>
                    <b>課題</b><br>
                    ${title}
                </p>

                <p>
                    <b>締切</b><br>
                    ${deadline}
                </p>

                ${
                    url
                    ? `<div class="switch-card assignment-card"
                            onclick="location.href='${url}'">`
                    : `<p>リンクなし</p>`
                }
            </div>
        `;

    });

}

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};