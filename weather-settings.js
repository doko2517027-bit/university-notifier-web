import {
    db,
    studentNumber,
    initializePage,
    setupTheme,
    loadUserName,
    loadProfileImage,
    showToast,
    setupAdminTab
} from "./common.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const themeButton = document.getElementById("themeButton");
const userName = document.getElementById("userName");
const topProfileImage = document.getElementById("topProfileImage");

const weatherSearch = document.getElementById("weatherSearch");
const weatherResults = document.getElementById("weatherResults");
const weatherSelected = document.getElementById("weatherSelected");
const saveWeatherButton = document.getElementById("saveWeatherButton");
const currentWeather = document.getElementById("currentWeather");

let selectedWeatherLocation = null;

setupTheme(themeButton);

await initializePage([
    setupAdminTab(),
    loadUserName(userName),
    loadProfileImage(topProfileImage),
    loadWeatherSetting()
]);

weatherSearch.addEventListener("input", () => {
    searchWeatherLocation(weatherSearch.value);
});

saveWeatherButton.onclick = saveWeatherSetting;

const weatherLocations = [
    {
        id: "yokohama_naka",
        name: "横浜市中区",
        prefecture: "神奈川県",
        latitude: 35.4437,
        longitude: 139.6500
    },
    {
        id: "yokohama_totsuka",
        name: "横浜市戸塚区",
        prefecture: "神奈川県",
        latitude: 35.4002,
        longitude: 139.5330
    },
    {
        id: "yokohama_kohoku",
        name: "横浜市港北区",
        prefecture: "神奈川県",
        latitude: 35.5198,
        longitude: 139.6336
    },
    {
        id: "kawasaki",
        name: "川崎市",
        prefecture: "神奈川県",
        latitude: 35.5308,
        longitude: 139.7029
    },
    {
        id: "fujisawa",
        name: "藤沢市",
        prefecture: "神奈川県",
        latitude: 35.3392,
        longitude: 139.4900
    },
    {
        id: "chigasaki",
        name: "茅ヶ崎市",
        prefecture: "神奈川県",
        latitude: 35.3339,
        longitude: 139.4047
    },
    {
        id: "tokyo_chiyoda",
        name: "千代田区",
        prefecture: "東京都",
        latitude: 35.6938,
        longitude: 139.7532
    },
    {
        id: "shibuya",
        name: "渋谷区",
        prefecture: "東京都",
        latitude: 35.6618,
        longitude: 139.7041
    }
];

async function loadWeatherSetting() {

    if (!studentNumber) return;

    const snap = await getDoc(
        doc(db, "users", studentNumber)
    );

    if (!snap.exists()) return;

    const user = snap.data();

    if (!user.weather) {
        currentWeather.innerHTML = "まだ登録されていません。";
        return;
    }

    selectedWeatherLocation = user.weather;

    renderSelectedWeather();
    renderCurrentWeather(user.weather);

}

function searchWeatherLocation(keyword) {

    const text = keyword.trim();

    if (!text) {
        weatherResults.innerHTML = "";
        return;
    }

    const results = weatherLocations.filter(location =>
        location.name.includes(text)
    );

    if (results.length === 0) {
        weatherResults.innerHTML = "候補がありません。";
        return;
    }

    weatherResults.innerHTML = "";

    results.forEach(location => {

        weatherResults.innerHTML += `
            <div
                class="setting-row weather-result"
                data-id="${location.id}"
                data-name="${location.name}"
                data-prefecture="${location.prefecture}"
                data-latitude="${location.latitude}"
                data-longitude="${location.longitude}">

                <div>
                    <b>🌤 ${location.name}</b><br>
                    <small>${location.prefecture}</small>
                </div>

            </div>
        `;

    });

}

document.addEventListener("click", (e) => {

    const item = e.target.closest(".weather-result");

    if (!item) return;

    selectedWeatherLocation = {
        id: item.dataset.id,
        name: item.dataset.name,
        prefecture: item.dataset.prefecture,
        latitude: Number(item.dataset.latitude),
        longitude: Number(item.dataset.longitude)
    };

    weatherSearch.value = selectedWeatherLocation.name;
    weatherResults.innerHTML = "";

    renderSelectedWeather();

});

function renderSelectedWeather() {

    weatherSelected.innerHTML = selectedWeatherLocation
        ? `✅ 選択中<br><b>${selectedWeatherLocation.name}</b>`
        : "";

}

function renderCurrentWeather(weather) {

    currentWeather.innerHTML = `
        <div>
            <h3>🌤 ${weather.name}</h3>
            <small>
                緯度 ${weather.latitude}<br>
                経度 ${weather.longitude}
            </small>
        </div>
    `;

}

async function saveWeatherSetting() {

    if (!selectedWeatherLocation) {
        alert("地域を選択してください。");
        return;
    }

    await updateDoc(
        doc(db, "users", studentNumber),
        {
            weather: selectedWeatherLocation
        }
    );

    renderCurrentWeather(selectedWeatherLocation);

    showToast("保存しました");

}