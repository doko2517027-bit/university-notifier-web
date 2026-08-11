import {
    db,
    studentNumber,
    setupTheme,
    initializePage,
    loadProfileImage,
    loadUserName,
    loadMyRanking,
    setupAdminTab,
    isAdmin,
    showToast,
    updateAssignmentNavBadge,
    updateShareNavBadge,
    updateNewsNavBadge
} from "./common.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";


/* ========================================
   HTML要素
======================================== */

const userName =
    document.getElementById("userName");

const themeButton =
    document.getElementById("themeButton");

const topProfileImage =
    document.getElementById("topProfileImage");

const backButton =
    document.getElementById("backButton");


const systemNewsTotalCount =
    document.getElementById(
        "systemNewsTotalCount"
    );

const systemNewsTodayCount =
    document.getElementById(
        "systemNewsTodayCount"
    );

const systemNewsPendingCount =
    document.getElementById(
        "systemNewsPendingCount"
    );


const systemNewsTitle =
    document.getElementById(
        "systemNewsTitle"
    );

const systemNewsBody =
    document.getElementById(
        "systemNewsBody"
    );

const systemNewsTitleCount =
    document.getElementById(
        "systemNewsTitleCount"
    );

const systemNewsBodyCount =
    document.getElementById(
        "systemNewsBodyCount"
    );

const sendSystemNewsNotification =
    document.getElementById(
        "sendSystemNewsNotification"
    );

const systemNewsImportant =
    document.getElementById(
        "systemNewsImportant"
    );

const postSystemNews =
    document.getElementById(
        "postSystemNews"
    );


const systemNewsSearch =
    document.getElementById(
        "systemNewsSearch"
    );

const systemNewsSort =
    document.getElementById(
        "systemNewsSort"
    );

const systemNewsFilteredCount =
    document.getElementById(
        "systemNewsFilteredCount"
    );

const refreshSystemNews =
    document.getElementById(
        "refreshSystemNews"
    );

const systemNewsList =
    document.getElementById(
        "systemNewsList"
    );


/* 編集モーダル */

const editSystemNewsModal =
    document.getElementById(
        "editSystemNewsModal"
    );

const editSystemNewsId =
    document.getElementById(
        "editSystemNewsId"
    );

const editSystemNewsTitle =
    document.getElementById(
        "editSystemNewsTitle"
    );

const editSystemNewsBody =
    document.getElementById(
        "editSystemNewsBody"
    );

const editSystemNewsImportant =
    document.getElementById(
        "editSystemNewsImportant"
    );

const cancelSystemNewsEdit =
    document.getElementById(
        "cancelSystemNewsEdit"
    );

const saveSystemNewsEdit =
    document.getElementById(
        "saveSystemNewsEdit"
    );


/* 削除モーダル */

const deleteSystemNewsModal =
    document.getElementById(
        "deleteSystemNewsModal"
    );

const deleteSystemNewsTitle =
    document.getElementById(
        "deleteSystemNewsTitle"
    );

const cancelSystemNewsDelete =
    document.getElementById(
        "cancelSystemNewsDelete"
    );

const confirmSystemNewsDelete =
    document.getElementById(
        "confirmSystemNewsDelete"
    );


/* ========================================
   状態
======================================== */

let systemNewsItems = [];

let selectedDeleteId = "";

let stopSystemNewsListener = null;


/* ========================================
   初期化
======================================== */

setupTheme(themeButton);

const admin =
    await isAdmin();

if (!admin) {

    alert(
        "管理者のみアクセスできます。"
    );

    location.href =
        "index.html";

    throw new Error(
        "管理者権限がありません。"
    );

}


await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadMyRanking(),
    loadProfileImage(topProfileImage),
    updateAssignmentNavBadge(),
    updateShareNavBadge(),
    updateNewsNavBadge()
]);


setupEvents();

updatePostForm();

startSystemNewsListener();


/* ========================================
   Firestore監視
======================================== */

function startSystemNewsListener() {

    if (stopSystemNewsListener) {

        stopSystemNewsListener();

    }

    const newsQuery =
        query(
            collection(
                db,
                "systemNews"
            ),
            orderBy(
                "createdAt",
                "desc"
            )
        );

    stopSystemNewsListener =
        onSnapshot(
            newsQuery,
            snapshot => {

                systemNewsItems =
                    snapshot.docs.map(
                        newsDocument => ({
                            id:
                                newsDocument.id,

                            ...newsDocument.data()
                        })
                    );

                renderSystemNews();

            },
            error => {

                console.error(
                    "CareMateお知らせ取得エラー:",
                    error
                );

                if (systemNewsList) {

                    systemNewsList.innerHTML = `
                        <div class="system-news-loading">
                            お知らせの取得に失敗しました。
                        </div>
                    `;

                }

            }
        );

}


/* ========================================
   イベント
======================================== */

function setupEvents() {

    if (backButton) {

        backButton.onclick = () => {

            location.href =
                "admin.html";

        };

    }


    [
        systemNewsTitle,
        systemNewsBody
    ]
    .filter(Boolean)
    .forEach(input => {

        input.addEventListener(
            "input",
            updatePostForm
        );

    });


    if (postSystemNews) {

        postSystemNews.onclick =
            postNews;

    }


    if (systemNewsSearch) {

        systemNewsSearch
            .addEventListener(
                "input",
                renderSystemNews
            );

    }


    if (systemNewsSort) {

        systemNewsSort
            .addEventListener(
                "change",
                renderSystemNews
            );

    }


    if (refreshSystemNews) {

        refreshSystemNews.onclick =
            refreshNewsList;

    }


    if (systemNewsList) {

        systemNewsList.addEventListener(
            "click",
            event => {

                const editButton =
                    event.target.closest(
                        ".edit-system-news"
                    );

                if (editButton) {

                    openEditModal(
                        editButton.dataset.id
                    );

                    return;

                }


                const deleteButton =
                    event.target.closest(
                        ".delete-system-news"
                    );

                if (deleteButton) {

                    openDeleteModal(
                        deleteButton.dataset.id
                    );

                }

            }
        );

    }


    if (cancelSystemNewsEdit) {

        cancelSystemNewsEdit.onclick =
            () => {

                closeModal(
                    editSystemNewsModal
                );

            };

    }


    if (saveSystemNewsEdit) {

        saveSystemNewsEdit.onclick =
            saveEditedNews;

    }


    if (cancelSystemNewsDelete) {

        cancelSystemNewsDelete.onclick =
            () => {

                closeModal(
                    deleteSystemNewsModal
                );

            };

    }


    if (confirmSystemNewsDelete) {

        confirmSystemNewsDelete.onclick =
            deleteSelectedNews;

    }


    [
        editSystemNewsModal,
        deleteSystemNewsModal
    ]
    .filter(Boolean)
    .forEach(modal => {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeModal(modal);

                }

            }
        );

    });

}


/* ========================================
   新規投稿
======================================== */

function updatePostForm() {

    const titleLength =
        systemNewsTitle
            ?.value.length || 0;

    const bodyLength =
        systemNewsBody
            ?.value.length || 0;


    if (systemNewsTitleCount) {

        systemNewsTitleCount
            .textContent =
            String(titleLength);

    }


    if (systemNewsBodyCount) {

        systemNewsBodyCount
            .textContent =
            String(bodyLength);

    }


    if (postSystemNews) {

        postSystemNews.disabled =
            !systemNewsTitle
                ?.value.trim() ||
            !systemNewsBody
                ?.value.trim();

    }

}


async function postNews() {

    if (!postSystemNews) {
        return;
    }

    const title =
        systemNewsTitle
            ?.value.trim() || "";

    const body =
        systemNewsBody
            ?.value.trim() || "";


    if (!title || !body) {

        alert(
            "タイトルと本文を入力してください。"
        );

        return;

    }


    const shouldNotify =
        sendSystemNewsNotification
            ?.checked !== false;


    postSystemNews.disabled = true;

    postSystemNews.textContent =
        "投稿中...";


    try {

        await addDoc(
            collection(
                db,
                "systemNews"
            ),
            {
                title,
                body,

                author:
                    studentNumber || "",

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    null,

                updatedBy:
                    null,

                important:
                    systemNewsImportant
                        ?.checked === true,

                /*
                既存通知処理との互換性を維持
                */

                notifyTarget:
                    shouldNotify
                        ? "allUsers"
                        : "none",

                notificationRequested:
                    shouldNotify,

                notificationSentAt:
                    shouldNotify
                        ? null
                        : serverTimestamp()
            }
        );


        if (systemNewsTitle) {

            systemNewsTitle.value =
                "";

        }

        if (systemNewsBody) {

            systemNewsBody.value =
                "";

        }

        if (systemNewsImportant) {

            systemNewsImportant.checked =
                false;

        }

        if (
            sendSystemNewsNotification
        ) {

            sendSystemNewsNotification
                .checked = true;

        }


        updatePostForm();

        showToast(
            "お知らせを投稿しました"
        );

    } catch (error) {

        console.error(
            "お知らせ投稿エラー:",
            error
        );

        alert(
            "お知らせの投稿に失敗しました。"
        );

    } finally {

        postSystemNews.textContent =
            "お知らせを投稿する";

        updatePostForm();

    }

}


/* ========================================
   一覧表示
======================================== */

function renderSystemNews() {

    updateSummary();

    if (!systemNewsList) {
        return;
    }


    const keyword =
        String(
            systemNewsSearch
                ?.value || ""
        )
        .trim()
        .toLowerCase();


    let filteredItems =
        systemNewsItems.filter(
            news => {

                if (!keyword) {
                    return true;
                }

                const searchTarget =
                    `${news.title || ""} ` +
                    `${news.body || ""}`
                        .toLowerCase();

                return searchTarget
                    .includes(keyword);

            }
        );


    const oldestFirst =
        systemNewsSort?.value === "oldest";

    filteredItems =
        [...filteredItems]
            .sort((newsA, newsB) => {
                // 重要なお知らせは日付順より優先して先頭へ固定する。
                const importantDifference =
                    Number(newsB.important === true) -
                    Number(newsA.important === true);

                if (importantDifference !== 0) {
                    return importantDifference;
                }

                const timeDifference =
                    getTimestampMilliseconds(newsA.createdAt) -
                    getTimestampMilliseconds(newsB.createdAt);

                return oldestFirst
                    ? timeDifference
                    : -timeDifference;
            });


    if (systemNewsFilteredCount) {

        systemNewsFilteredCount
            .textContent =
            `${filteredItems.length}件を表示`;

    }


    if (filteredItems.length === 0) {

        systemNewsList.innerHTML = `
            <div class="system-news-loading">
                条件に一致するお知らせはありません。
            </div>
        `;

        return;

    }


    systemNewsList.innerHTML =
        filteredItems
            .map(createSystemNewsHtml)
            .join("");

}


function createSystemNewsHtml(news) {

    const createdDate =
        formatDate(
            news.createdAt
        );

    const updatedDate =
        formatDate(
            news.updatedAt
        );

    const notificationText =
        news.notifyTarget === "none" ||
        news.notificationRequested === false
            ? "🔕 通知なし"
            : "🔔 即時通知";


    return `
        <article
            class="
                system-news-item
                ${
                    news.important
                        ? "is-important"
                        : ""
                }
            ">

            <div class="system-news-item-heading">

                <div>

                    ${
                        news.important
                            ? `
                                <span class="system-news-important-badge">
                                    📌 重要
                                </span>
                            `
                            : ""
                    }

                    <h3>
                        ${escapeHtml(
                            news.title ||
                            "タイトルなし"
                        )}
                    </h3>

                </div>

                <span class="system-news-notification-status">

                    ${notificationText}

                </span>

            </div>


            <div class="system-news-item-body">

                ${escapeHtml(
                    news.body || ""
                ).replace(/\n/g, "<br>")}

            </div>


            <div class="system-news-item-meta">

                <span>
                    投稿日：
                    ${escapeHtml(createdDate)}
                </span>

                ${
                    news.updatedAt
                        ? `
                            <span>
                                更新日：
                                ${escapeHtml(
                                    updatedDate
                                )}
                            </span>
                        `
                        : ""
                }

                <span>
                    投稿者：
                    ${escapeHtml(
                        news.author || "-"
                    )}
                </span>

            </div>


            <div class="system-news-item-actions">

                <button
                    type="button"
                    class="btn edit-system-news"
                    data-id="${escapeHtml(news.id)}">

                    編集

                </button>

                <button
                    type="button"
                    class="btn btn-danger delete-system-news"
                    data-id="${escapeHtml(news.id)}">

                    削除

                </button>

            </div>

        </article>
    `;

}


/* ========================================
   件数表示
======================================== */

function updateSummary() {

    const today =
        new Date();

    let todayCount = 0;

    systemNewsItems.forEach(news => {

        const date =
            timestampToDate(
                news.createdAt
            );

        if (
            date &&
            date.getFullYear() ===
                today.getFullYear() &&
            date.getMonth() ===
                today.getMonth() &&
            date.getDate() ===
                today.getDate()
        ) {

            todayCount += 1;

        }
    });


    setText(
        systemNewsTotalCount,
        `${systemNewsItems.length}件`
    );

    setText(
        systemNewsTodayCount,
        `${todayCount}件`
    );

}


/* ========================================
   編集
======================================== */

function openEditModal(newsId) {

    const news =
        systemNewsItems.find(
            item => item.id === newsId
        );

    if (!news) {

        alert(
            "お知らせが見つかりません。"
        );

        return;

    }


    if (editSystemNewsId) {

        editSystemNewsId.value =
            news.id;

    }

    if (editSystemNewsTitle) {

        editSystemNewsTitle.value =
            news.title || "";

    }

    if (editSystemNewsBody) {

        editSystemNewsBody.value =
            news.body || "";

    }

    if (editSystemNewsImportant) {

        editSystemNewsImportant
            .checked =
            news.important === true;

    }


    openModal(
        editSystemNewsModal
    );

    editSystemNewsTitle
        ?.focus();

}


async function saveEditedNews() {

    const newsId =
        editSystemNewsId
            ?.value.trim() || "";

    const title =
        editSystemNewsTitle
            ?.value.trim() || "";

    const body =
        editSystemNewsBody
            ?.value.trim() || "";


    if (!newsId) {
        return;
    }


    if (!title || !body) {

        alert(
            "タイトルと本文を入力してください。"
        );

        return;

    }


    if (saveSystemNewsEdit) {

        saveSystemNewsEdit.disabled =
            true;

        saveSystemNewsEdit.textContent =
            "保存中...";

    }


    try {

        await updateDoc(
            doc(
                db,
                "systemNews",
                newsId
            ),
            {
                title,
                body,

                important:
                    editSystemNewsImportant
                        ?.checked === true,

                updatedAt:
                    serverTimestamp(),

                updatedBy:
                    studentNumber || ""
            }
        );


        closeModal(
            editSystemNewsModal
        );

        showToast(
            "お知らせを更新しました"
        );

    } catch (error) {

        console.error(
            "お知らせ更新エラー:",
            error
        );

        alert(
            "お知らせの更新に失敗しました。"
        );

    } finally {

        if (saveSystemNewsEdit) {

            saveSystemNewsEdit.disabled =
                false;

            saveSystemNewsEdit.textContent =
                "変更を保存";

        }

    }

}


/* ========================================
   削除
======================================== */

function openDeleteModal(newsId) {

    const news =
        systemNewsItems.find(
            item => item.id === newsId
        );

    if (!news) {

        alert(
            "お知らせが見つかりません。"
        );

        return;

    }


    selectedDeleteId =
        news.id;


    setText(
        deleteSystemNewsTitle,
        news.title ||
        "タイトルなし"
    );


    openModal(
        deleteSystemNewsModal
    );

}


async function deleteSelectedNews() {

    if (!selectedDeleteId) {
        return;
    }


    if (confirmSystemNewsDelete) {

        confirmSystemNewsDelete
            .disabled = true;

        confirmSystemNewsDelete
            .textContent =
            "削除中...";

    }


    try {

        await deleteDoc(
            doc(
                db,
                "systemNews",
                selectedDeleteId
            )
        );


        closeModal(
            deleteSystemNewsModal
        );

        selectedDeleteId = "";

        showToast(
            "お知らせを削除しました"
        );

    } catch (error) {

        console.error(
            "お知らせ削除エラー:",
            error
        );

        alert(
            "お知らせの削除に失敗しました。"
        );

    } finally {

        if (confirmSystemNewsDelete) {

            confirmSystemNewsDelete
                .disabled = false;

            confirmSystemNewsDelete
                .textContent =
                "削除する";

        }

    }

}


/* ========================================
   手動更新
======================================== */

async function refreshNewsList() {

    if (!refreshSystemNews) {
        return;
    }


    refreshSystemNews.disabled =
        true;

    refreshSystemNews.textContent =
        "更新中...";


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "systemNews"
                    ),
                    orderBy(
                        "createdAt",
                        "desc"
                    )
                )
            );


        systemNewsItems =
            snapshot.docs.map(
                newsDocument => ({
                    id:
                        newsDocument.id,

                    ...newsDocument.data()
                })
            );


        renderSystemNews();

        showToast(
            "お知らせを更新しました"
        );

    } catch (error) {

        console.error(
            "お知らせ更新エラー:",
            error
        );

        alert(
            "お知らせの更新に失敗しました。"
        );

    } finally {

        refreshSystemNews.disabled =
            false;

        refreshSystemNews.textContent =
            "↻ 更新";

    }

}


/* ========================================
   共通処理
======================================== */

function timestampToDate(value) {

    if (!value) {
        return null;
    }

    try {

        if (
            typeof value.toDate ===
            "function"
        ) {

            return value.toDate();

        }

        const date =
            new Date(value);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;

    } catch {

        return null;

    }

}


function getTimestampMilliseconds(
    value
) {

    const date =
        timestampToDate(value);

    return date
        ? date.getTime()
        : 0;

}


function formatDate(value) {

    const date =
        timestampToDate(value);

    if (!date) {
        return "日時未設定";
    }

    return date.toLocaleString(
        "ja-JP"
    );

}


function setText(
    element,
    value
) {

    if (!element) {
        return;
    }

    element.textContent =
        String(value ?? "");

}


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function openModal(modal) {

    if (!modal) {
        return;
    }

    modal.hidden = false;

    document.body.classList.add(
        "admin-modal-open"
    );

}


function closeModal(modal) {

    if (!modal) {
        return;
    }

    modal.hidden = true;

    if (
        editSystemNewsModal?.hidden &&
        deleteSystemNewsModal?.hidden
    ) {

        document.body.classList.remove(
            "admin-modal-open"
        );

    }

}


window.addEventListener(
    "beforeunload",
    () => {

        if (stopSystemNewsListener) {

            stopSystemNewsListener();

        }

    }
);
