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

const mockPlaces = [
    {
        id: "station_keikyu_kawasakidaishi",
        name: "川崎大師駅",
        type: "train"
    },
    {
        id: "station_keikyu_kawasaki",
        name: "京急川崎駅",
        type: "train"
    },
    {
        id: "station_jr_yokohama",
        name: "横浜駅",
        type: "train"
    },
    {
        id: "station_jr_ishikawacho",
        name: "石川町駅",
        type: "train"
    },
    {
        id: "bus_kawasakidaishi",
        name: "川崎大師停留所",
        type: "bus"
    },
    {
        id: "bus_yokohama",
        name: "横浜駅前停留所",
        type: "bus"
    }
];

function searchPlaces(keyword, target, mode) {

    const text = keyword.trim();

    if (!text) {
        target.innerHTML = "";
        return;
    }

    const selectedType = editingType;

    const results = mockPlaces.filter(place => {
        return (
            place.type === selectedType &&
            place.name.includes(text)
        );
    });

    if (results.length === 0) {
        target.innerHTML = "候補がありません。";
        return;
    }

    target.innerHTML = "";

    results.forEach(place => {

        target.innerHTML += `
            <div
                class="setting-row commute-result"
                data-id="${place.id}"
                data-name="${place.name}"
                data-type="${place.type}"
                data-mode="${mode}">

                <div>

                    <b>

                        ${place.type === "train"
                            ? "🚉"
                            : "🚌"}

                        ${place.name}

                    </b>

                    <br>

                    <small>

                        ${place.type === "train"
                            ? "駅"
                            : "停留所"}

                    </small>

                </div>

            </div>
        `;

    });

}

document.addEventListener("click", (e) => {

    const item = e.target.closest(".commute-result");

    if (!item) return;

    const place = {
        id: item.dataset.id,
        name: item.dataset.name,
        type: item.dataset.type
    };

    if (item.dataset.mode === "departure") {

        departure = place;
        departureResults.innerHTML = "";
        departureSearch.value = place.name;

    } else {

        arrival = place;
        arrivalResults.innerHTML = "";
        arrivalSearch.value = place.name;

    }

    renderSelected();

});