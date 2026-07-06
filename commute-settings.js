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
const departureTime = document.getElementById("departureTime");
const timeType = document.getElementById("timeType");
const routeTime = document.getElementById("routeTime");
const searchRouteButton = document.getElementById("searchRouteButton");
const routeResults = document.getElementById("routeResults");
const routeResultList = document.getElementById("routeResultList");
const trainSettingButton = document.getElementById("trainSettingButton");
const busSettingButton = document.getElementById("busSettingButton");
const commuteEditor = document.getElementById("commuteEditor");
const currentCommuteSetting = document.getElementById("currentCommuteSetting");
const viaSearch = document.getElementById("viaSearch");
const viaResults = document.getElementById("viaResults");
const viaSelected = document.getElementById("viaSelected");

setupTheme(themeButton);

let editingType="train";
let departure = null;
let via = null;
let arrival = null;

await initializePage([
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadCommute()
]);

searchRouteButton.onclick = searchRouteCandidates;

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

viaSearch.addEventListener("input", () => {

    searchPlaces(
        viaSearch.value,
        viaResults,
        "via"
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
    via = current.via ?? null;
    arrival = current.arrival ?? null;

    renderSelected();
    renderCurrent(commute);

}

function renderSelected() {

    departureSelected.innerHTML = departure
        ? `📍 ${departure.name}`
        : "";

    viaSelected.innerHTML = via
        ? `🚏 ${via.name}`
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

            ${commute.train.via ? `
            <div style="text-align:center;font-size:24px;">
                ↓
            </div>

            <p>
                🚏 <b>${commute.train.via.name}</b>
            </p>
            ` : ""}

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

            ${commute.bus.via ? `
            <div style="text-align:center;font-size:24px;">
                ↓
            </div>

            <p>
                🚏 <b>${commute.bus.via.name}</b>
            </p>
            ` : ""}

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
        via,
        arrival,
        departureTime: departureTime.value,
        durationMinutes: Number(durationMinutes.value)

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
    via = null;
    arrival = null;

    departureSearch.value = "";
    viaSearch.value = "";
    arrivalSearch.value = "";

    departureResults.innerHTML = "";
    viaResults.innerHTML = "";
    arrivalResults.innerHTML = "";

    departureSelected.innerHTML = "";
    viaSelected.innerHTML = "";
    arrivalSelected.innerHTML = "";

    commuteEditor.style.display = "none";

    showToast("保存しました");

}

let places = [];

async function searchPlaces(keyword, target, mode) {

    const text = keyword.trim();

    if (text.length < 2) {

        target.innerHTML = "";

        return;

    }

    try {

        target.innerHTML = "検索中...";

        const response = await fetch(

            `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=10`

        );

        const data = await response.json();

        if (!data.features) {
            target.innerHTML = "候補がありません。";
            return;
        }

        places = data.features.map(feature => {
            return {
                name: feature.properties.name,
                display_name: [
                    feature.properties.name,
                    feature.properties.city,
                    feature.properties.state,
                    feature.properties.country
                ].filter(Boolean).join(", "),
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                type: feature.properties.osm_value || "",
                class: feature.properties.osm_key || ""
            };
        });

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

    } else if (item.dataset.mode === "via") {

        via = selectedPlace;
        viaResults.innerHTML = "";
        viaSearch.value = selectedPlace.name;

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

async function searchRouteCandidates() {

    if (!departure || !arrival) {

        alert("出発地と到着地を選択してください。");

        return;

    }

    const baseTime = routeTime.value || "09:00";

    const routes = [

        {
            departTime: baseTime,
            arriveTime: addMinutes(baseTime, 34),
            duration: 34,
            transfers: 2,
            line: "京急川崎・横浜"
        },

        {
            departTime: addMinutes(baseTime, 5),
            arriveTime: addMinutes(baseTime, 42),
            duration: 37,
            transfers: 1,
            line: "京急川崎"
        },

        {
            departTime: addMinutes(baseTime, 10),
            arriveTime: addMinutes(baseTime, 48),
            duration: 38,
            transfers: 2,
            line: "横浜"
        }

    ];

    renderRouteCandidates(routes);

}

function addMinutes(time, minutes) {

    const [h, m] = time.split(":").map(Number);

    const date = new Date();

    date.setHours(h, m + minutes, 0, 0);

    return date.toTimeString().slice(0, 5);

}

function renderRouteCandidates(routes) {

    routeResults.style.display = "block";

    routeResultList.innerHTML = "";

    routes.forEach((route, index) => {

        routeResultList.innerHTML += `
            <div
                class="card route-candidate"
                data-index="${index}">

                <h3>
                    ${route.departTime}
                    ▶
                    ${route.arriveTime}
                </h3>

                <p>
                    ${route.duration}分　
                    乗換${route.transfers}回
                </p>

                <p>
                    ${route.line}
                </p>

                <small>
                    タップしてこのルートを保存
                </small>

            </div>
        `;

    });

    window.routeCandidates = routes;

}

document.addEventListener("click", async (e) => {

    const item =
        e.target.closest(".route-candidate");

    if (!item) return;

    const route =
        window.routeCandidates[
            Number(item.dataset.index)
        ];

    await saveSelectedRoute(route);

});

async function saveSelectedRoute(route) {

    const stops = [
        {
            name: departure.name,
            time: route.departTime
        }
    ];

    if (via) {
        stops.push({
            name: via.name,
            time: addMinutes(route.departTime, Math.floor(route.duration / 2))
        });
    }

    stops.push({
        name: arrival.name,
        time: route.arriveTime
    });

    const selectedRoute = {
        type: editingType,

        departure,
        via,
        arrival,

        departTime: route.departTime,
        arriveTime: route.arriveTime,
        durationMinutes: route.duration,
        transfers: route.transfers,
        lineSummary: route.line,

        stops,

        operationStatus: "通常運転"
    };

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            [`commute.${editingType}`]: selectedRoute
        }
    );

    showToast("ルートを保存しました");

    location.href = "index.html";

}