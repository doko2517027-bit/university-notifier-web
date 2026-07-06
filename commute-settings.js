import {
    db,
    studentNumber,
    initializePage,
    setupTheme,
    loadUserName,
    loadProfileImage,
    showToast
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");
const topProfileImage = document.getElementById("topProfileImage");

const departureSearch = document.getElementById("departureSearch");
const arrivalSearch = document.getElementById("arrivalSearch");

const departureResults = document.getElementById("departureResults");
const arrivalResults = document.getElementById("arrivalResults");

const departureSelected = document.getElementById("departureSelected");
const arrivalSelected = document.getElementById("arrivalSelected");

const saveButton = document.getElementById("saveCommuteButton");

const trainSettingButton =
document.getElementById(
    "trainSettingButton"
);

const busSettingButton =
document.getElementById(
    "busSettingButton"
);

const commuteEditor =
document.getElementById(
    "commuteEditor"
);

let editingType="train";

const currentCommuteSetting =
    document.getElementById("currentCommuteSetting");

setupTheme(themeButton);

await initializePage([
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadCommute()
]);

let departure = null;
let arrival = null;

saveButton.onclick = saveCommute;

trainSettingButton.onclick=()=>{

    editingType="train";

    commuteEditor.style.display="block";

};

busSettingButton.onclick=()=>{

    editingType="bus";

    commuteEditor.style.display="block";

};

departureSearch.addEventListener("input", () => {
    searchPlaces(
        departureSearch.value,
        departureResults,
        "departure"
    );
});

arrivalSearch.addEventListener("input", () => {
    searchPlaces(
        arrivalSearch.value,
        arrivalResults,
        "arrival"
    );
});

async function loadCommute() {

    if (!studentNumber) return;

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const user = snap.data();

    if (!user.commute) {

        currentCommuteSetting.innerHTML =
            "まだ登録されていません。";

        return;

    }

    const commute = user.commute ?? {};

    const current = commute[editingType] ?? {};

    departure = current.departure ?? null;
    arrival = current.arrival ?? null;

    renderSelected();
    renderCurrent(commute);

}

function renderSelected() {

    departureSelected.innerHTML = departure
        ? `📍 ${departure.name}`
        : "";

    arrivalSelected.innerHTML = arrival
        ? `🏫 ${arrival.name}`
        : "";

}

function renderCurrent(commute){

    let html = "";

    if (commute.train?.departure) {

        html += `
        <div class="card setting-card">

            <h3>🚆 電車</h3>

            <p>
                🚩 <b>${commute.train.departure.name}</b>
            </p>

            <div style="text-align:center;font-size:24px;">
                ↓
            </div>

            <p>
                🏫 <b>${commute.train.arrival.name}</b>
            </p>

            <small>
                時刻表ベースの目安です
            </small>

            <br><br>

            <button
                class="btn btn-danger delete-route"
                data-type="train">
                電車ルートを削除
            </button>

        </div>
        `;

    }

    if (commute.bus?.departure) {

        html += `
        <div class="card setting-card">

            <h3>🚌 バス</h3>

            <p>
                🚩 <b>${commute.bus.departure.name}</b>
            </p>

            <div style="text-align:center;font-size:24px;">
                ↓
            </div>

            <p>
                🏫 <b>${commute.bus.arrival.name}</b>
            </p>

            <small>
                時刻表ベースの目安です
            </small>

            <br><br>

            <button
                class="btn btn-danger delete-route"
                data-type="bus">
                バスルートを削除
            </button>

        </div>
        `;

    }

    if (html === "") {
        html = "まだ設定されていません。";
    }

    currentCommuteSetting.innerHTML = html;

}

async function saveCommute() {

    if (!departure || !arrival) {

        alert("出発・到着を選択してください。");

        return;

    }

    const updateData = {};

    updateData[
        `commute.${editingType}`
    ] = {

        departure,

        arrival

    };

    await updateDoc(

        doc(db,"users",studentNumber),

        updateData

    );

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    renderCurrent(snap.data().commute);

    departure = null;
    arrival = null;

    departureSearch.value = "";
    arrivalSearch.value = "";

    departureResults.innerHTML = "";
    arrivalResults.innerHTML = "";

    departureSelected.innerHTML = "";
    arrivalSelected.innerHTML = "";

    commuteEditor.style.display = "none";

    showToast("保存しました");

}

let places = [];

async function searchPlaces(keyword, target, mode) {

    const text = keyword.trim();

    if (!text) {

        target.innerHTML = "";

        return;

    }

    try {

        target.innerHTML = "検索中...";

        const response = await fetch(

            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=jp&limit=10`

        );

        places = await response.json();

        places = filterCommutePlaces(places);

        if (places.length === 0) {
            target.innerHTML = "候補がありません。";
            return;
        }

        renderPlaces(target, mode);

    } catch (e) {

        console.error(e);

    }

}

function renderPlaces(target, mode) {

    target.innerHTML = places.map((place, index) => {

        const name =
            place.name ||
            place.display_name.split(",")[0];

        const subText =
            place.display_name
                .split(",")
                .slice(1, 3)
                .join(" / ");

        return `

            <div
                class="setting-row commute-result"
                data-index="${index}"
                data-mode="${mode}">

                <div>

                    <b>
                        ${editingType === "train" ? "🚉" : "🚌"}
                        ${name}
                    </b>

                    <br>

                    <small>
                        ${subText}
                    </small>

                </div>

            </div>

        `;

    }).join("");

}

document.addEventListener("click", (e) => {

    const item = e.target.closest(".commute-result");

    if (!item) return;

    const place = places[
        Number(item.dataset.index)
    ];

    const selectedPlace = {
        name: place.name || place.display_name.split(",")[0],
        fullName: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
        osmType: place.type,
        osmClass: place.class,
        type: editingType
    };

    if (item.dataset.mode === "departure") {

        departure = selectedPlace;
        departureResults.innerHTML = "";
        departureSearch.value = selectedPlace.name;

    } else {

        arrival = selectedPlace;
        arrivalResults.innerHTML = "";
        arrivalSearch.value = selectedPlace.name;

    }

    renderSelected();

});

function filterCommutePlaces(results) {

    const filtered = results.filter(place => {

        const text =
            `${place.display_name} ${place.type} ${place.class}`.toLowerCase();

        if (editingType === "train") {

            return (
                text.includes("駅") ||
                text.includes("station") ||
                text.includes("railway")
            );

        }

        if (editingType === "bus") {

            return (
                text.includes("バス停") ||
                text.includes("停留所") ||
                text.includes("bus_stop") ||
                text.includes("bus station")
            );

        }

        return true;

    });

    return filtered.length > 0
        ? filtered
        : results;

}

document.addEventListener("click", async (e) => {

    const button =
        e.target.closest(".delete-route");

    if (!button) return;

    const type = button.dataset.type;

    if (!confirm("このルートを削除しますか？")) {
        return;
    }

    const updateData = {};

    updateData[`commute.${type}`] = null;

    await updateDoc(
        doc(db, "users", studentNumber),
        updateData
    );

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    renderCurrent(snap.data().commute ?? {});

    showToast("削除しました");

});

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};