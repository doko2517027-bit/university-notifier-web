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
    searchPlaces(departureSearch.value);
});

arrivalSearch.addEventListener("input", () => {
    searchPlaces(arrivalSearch.value);
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

    let html="";

    if(commute.train?.departure){

        html += `
        <div class="card">

            <h3>🚆 電車</h3>

            🚩 ${commute.train.departure.name}

            <br><br>

            ⬇️

            <br><br>

            🏫 ${commute.train.arrival.name}

        </div>
        `;

    }

    if(commute.bus?.departure){

        html += `
        <div class="card">

            <h3>🚌 バス</h3>

            🚩 ${commute.bus.departure.name}

            <br><br>

            ⬇️

            <br><br>

            🏫 ${commute.bus.arrival.name}

        </div>
        `;

    }

    if(html===""){

        html="まだ設定されていません。";

    }

    currentCommuteSetting.innerHTML=html;

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

    showToast("保存しました");

}

let places = [];

async function searchPlaces(keyword) {

    const text = keyword.trim();

    if (!text) {

        departureResults.innerHTML = "";
        arrivalResults.innerHTML = "";

        return;

    }

    try {

        const response = await fetch(

            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=jp&limit=10`

        );

        places = await response.json();

        renderPlaces();

    } catch (e) {

        console.error(e);

    }

}

function renderPlaces() {

    const html = places.map((place,index)=>`

        <div
            class="commute-result"
            data-index="${index}"
            data-mode="departure">

            <b>📍 ${place.display_name}</b>

        </div>

    `).join("");

    departureResults.innerHTML =
        html.replaceAll(
            'data-mode="departure"',
            'data-mode="departure"'
        );

    arrivalResults.innerHTML =
        html.replaceAll(
            'data-mode="departure"',
            'data-mode="arrival"'
        );

}

document.addEventListener("click", (e) => {

    const item = e.target.closest(".commute-result");

    if (!item) return;

    const place = places[
        Number(item.dataset.index)
    ];

    const selectedPlace = {
        name: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
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