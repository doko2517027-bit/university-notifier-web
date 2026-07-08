import {
    db,
    studentNumber,
    initializePage,
    setupTheme,
    loadUserName,
    loadProfileImage,
    showToast,
    encryptData,
    decryptData
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
const commuteEditor = document.getElementById("commuteEditor");
const currentCommuteSetting = document.getElementById("currentCommuteSetting");
const viaSearch = document.getElementById("viaSearch");
const viaResults = document.getElementById("viaResults");
const viaSelected = document.getElementById("viaSelected");

setupTheme(themeButton);

let departure = null;
let via = null;
let arrival = null;
let odptRailways = null;

const ODPT_WORKER_URL = "https://caremate-odpt-api.kidokohei-shonaniryo2517027.workers.dev";

await initializePage([
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadCommute()
]);

searchRouteButton.onclick = searchRouteCandidates;

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

    if (!user.commuteEncrypted) {

        currentCommuteSetting.innerHTML =
            "まだ登録されていません。";

        return;

    }

    const commute =
        await decryptData(user.commuteEncrypted);

    const current = commute.route ?? {};

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

function renderCurrent(commute) {

    const route = commute.route;

    if (!route?.departure) {

        currentCommuteSetting.innerHTML =
            "まだ設定されていません。";

        return;

    }

    currentCommuteSetting.innerHTML = `
        <div class="card setting-card">

            <h3>🚃 現在の通学ルート</h3>

            <p>
                🚩 <b>${route.departure.name}</b>
            </p>

            ${route.via ? `
                <div style="text-align:center;font-size:24px;">
                    ↓
                </div>

                <p>
                    🚏 <b>${route.via.name}</b>
                </p>
            ` : ""}

            <div style="text-align:center;font-size:24px;">
                ↓
            </div>

            <p>
                🏫 <b>${route.arrival.name}</b>
            </p>

            <small>
                ${route.departTime} → ${route.arriveTime}
                ／ ${route.durationMinutes}分
                ／ 乗換${route.transfers}回
            </small>

            <br><br>

            <button
                class="btn btn-danger delete-route"
                data-type="route">
                ルートを削除
            </button>

        </div>
    `;

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
            `https://express.heartrails.com/api/json?method=getStations&name=${encodeURIComponent(text)}`
        );

        const data = await response.json();

        const stations =
            data.response.station || [];

        places = stations.map(station => {

            return {
                name: `${station.name}駅`,
                fullName: `${station.name}駅（${station.line}）`,
                display_name: `${station.name}駅, ${station.line}, ${station.prefecture}`,
                latitude: Number(station.y),
                longitude: Number(station.x),
                line: station.line,
                prefecture: station.prefecture,
                type: "train"
            };

        });

        places = removeDuplicatePlaces(places);

        if (places.length === 0) {
            target.innerHTML = "候補がありません。";
            return;
        }

        renderPlaces(target, mode);

    } catch (e) {

        console.error(e);
        target.innerHTML = "検索に失敗しました。";

    }

}

function renderPlaces(target, mode) {

    target.innerHTML = places.map((place, index) => {

        return `
            <div
                class="setting-row commute-result"
                data-index="${index}"
                data-mode="${mode}">

                <div>

                    <b>
                        🚉 ${place.name}
                    </b>

                    <br>

                    <small>
                        ${place.line || ""}
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
        name: place.name,
        fullName: place.fullName,
        latitude: place.latitude,
        longitude: place.longitude,
        line: place.line,
        prefecture: place.prefecture,
        type: "commute"
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

document.addEventListener("click", async (e) => {

    const button =
        e.target.closest(".delete-route");

    if (!button) return;

    const updateData = {
        commuteEncrypted: null,
        commute: null
    };

    await updateDoc(
        doc(db, "users", studentNumber),
        updateData
    );

    currentCommuteSetting.innerHTML =
        "まだ設定されていません。";

    departure = null;
    via = null;
    arrival = null;

    departureSearch.value = "";
    viaSearch.value = "";
    arrivalSearch.value = "";

    departureSelected.innerHTML = "";
    viaSelected.innerHTML = "";
    arrivalSelected.innerHTML = "";

    routeResults.style.display = "none";
    routeResultList.innerHTML = "";

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
            line: departure.line || "路線未設定"
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

async function loadOdptRailways() {

    if (odptRailways) {
        return odptRailways;
    }

    const response = await fetch(
        `${ODPT_WORKER_URL}/railways`
    );

    if (!response.ok) {
        throw new Error("ODPT路線一覧の取得に失敗しました");
    }

    odptRailways = await response.json();

    return odptRailways;

}

function normalizeLineName(name) {

    return String(name || "")
        .replaceAll("ＪＲ", "JR")
        .replaceAll("地下鉄", "")
        .replaceAll("線", "")
        .replaceAll("　", "")
        .replaceAll(" ", "")
        .toLowerCase();

}

async function findOdptRailwayCode(lineName) {

    if (!lineName) return "";

    const railways = await loadOdptRailways();

    const target =
        normalizeLineName(lineName);

    const matched = railways.find(railway => {

        const titleJa =
            railway["dc:title"] ||
            railway["odpt:railwayTitle"]?.ja ||
            "";

        const sameTitle =
            normalizeLineName(titleJa).includes(target) ||
            target.includes(normalizeLineName(titleJa));

        const sameOperator =
            normalizeLineName(
                railway["odpt:operator"]
            ).includes(target);

        return sameTitle || sameOperator;

    });

    if (!matched) {
        return "";
    }

    return String(matched["@id"] || "")
        .replace("urn:ucode:", "")
        .replace("odpt.Railway:", "");

}

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

    let lineCode = "";

    try {

        lineCode =
            await findOdptRailwayCode(
                departure.line || route.line
            );

        alert(
            "HeartRails line: " + departure.line + "\n" +
            "ODPT lineCode: " + lineCode
        );

    } catch (e) {

        console.error(e);

    }

    const selectedRoute = {
        type: "commute",

        departure,
        via,
        arrival,

        departTime: route.departTime,
        arriveTime: route.arriveTime,
        durationMinutes: route.duration,
        transfers: route.transfers,
        lineSummary: route.line,
        lineCode,

        stops,

        operationStatus: "通常運転"
    };

    const encrypted =
        await encryptData({
            route: selectedRoute
        });

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            commuteEncrypted: encrypted,
            commute: null
        }
    );

    showToast("ルートを保存しました");

    location.href = "index.html";

}

function removeDuplicatePlaces(list) {

    const seen = new Set();

    return list.filter(place => {

        const key =
            `${place.name}_${place.lat}_${place.lon}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;

    });

}