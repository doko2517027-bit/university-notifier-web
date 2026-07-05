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

    const commute = user.commute;

    departure = commute.departure || null;
    arrival = commute.arrival || null;

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

function renderCurrent(commute) {

    currentCommuteSetting.innerHTML = `

    <div class="commute-summary">

        <h3>

            ${commute.type === "bus"
                ? "🚌 バス"
                : "🚆 電車"}

        </h3>

        <br>

        <div>

            <small>🚩 出発</small>

            <br>

            <b>${commute.departure.name}</b>

        </div>

        <div
            style="
                text-align:center;
                font-size:28px;
                margin:15px 0;
            ">

            ⬇️

        </div>

        <div>

            <small>🏫 到着</small>

            <br>

            <b>${commute.arrival.name}</b>

        </div>

    </div>

    `;

}

async function saveCommute() {

    if (!departure || !arrival) {

        alert("出発・到着を選択してください。");

        return;

    }

    const type = document.querySelector(
        'input[name="commuteType"]:checked'
    ).value;

    await updateDoc(
        doc(db, "users", studentNumber),
        {

            commute: {

                type,

                departure,

                arrival

            }

        }
    );

    renderCurrent({

        type,

        departure,

        arrival

    });

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

    const selectedType = document.querySelector(
        'input[name="commuteType"]:checked'
    ).value;

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