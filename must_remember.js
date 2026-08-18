import { db, setupTheme, initializePage, loadProfileImage } from "./common.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const topProfileImage = document.getElementById("topProfileImage");
const rememberArea = document.getElementById("rememberArea");

const params = new URLSearchParams(location.search);
const subjectId = params.get("subjectId");
const unitId = params.get("unitId");

setupTheme(themeButton);

await initializePage([loadProfileImage(topProfileImage), loadRemember()]);

document.getElementById("backButton").onclick = () => {
  history.back();
};

document.getElementById("profileButton").onclick = () => {
  location.href = "profile.html";
};

async function loadRemember() {
  if (!subjectId || !unitId) {
    rememberArea.innerHTML = "科目または単元が指定されていません。";
    return;
  }

  const snap = await getDoc(
    doc(
      db,
      "examSubjects",
      subjectId,
      "units",
      unitId,
      "publishedQuestions",
      "published",
    ),
  );

  if (!snap.exists()) {
    rememberArea.innerHTML = "重要ポイントはまだありません。";
    return;
  }

  const data = snap.data();
  const points = (data.important_points || []).filter(
    (point) => typeof point === "string" && point.trim() !== "",
  );

  const pointImages = (data.important_point_images || []).filter(
    (item) =>
      item &&
      typeof item === "object" &&
      String(item.imageUrl || "").trim() !== "",
  );

  if (points.length === 0 && pointImages.length === 0) {
    rememberArea.innerHTML = "重要ポイントが生成されていません。";
    return;
  }

  rememberArea.innerHTML = `
        <div class="card setting-card">

            <h3>
                ⭐ 試験前にここだけ確認
            </h3>

            ${
              points.length
                ? `
                        <ul>
                            ${points
                              .map((point) => `<li>${escapeHtml(point)}</li>`)
                              .join("")}
                        </ul>
                    `
                : ""
            }

            ${
              pointImages.length
                ? `
                        <div class="important-point-image-list">

                            ${pointImages
                              .map((item) => {
                                const description = String(
                                  item.description || "",
                                );

                                return `
                                        <figure class="important-point-image-card">

                                            <img
                                                src="${escapeHtml(item.imageUrl)}"
                                                alt="${escapeHtml(
                                                  description ||
                                                    "重要ポイント画像",
                                                )}"
                                                loading="lazy">

                                            ${
                                              description
                                                ? `
                                                        <figcaption>
                                                            ${escapeHtml(description)}
                                                        </figcaption>
                                                    `
                                                : ""
                                            }

                                        </figure>
                                    `;
                              })
                              .join("")}

                        </div>
                    `
                : ""
            }

        </div>
    `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
