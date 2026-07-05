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
const backButton = document.getElementById("backButton");
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

document
    .getElementById("backButton")
    .onclick = () => {

    history.back();

};

weatherSearch.addEventListener("input", () => {
    searchWeatherLocation(weatherSearch.value);
});

saveWeatherButton.onclick = saveWeatherSetting;

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

async function searchWeatherLocation(keyword) {

    const text = keyword.trim();

    if (!text) {
        weatherResults.innerHTML = "";
        return;
    }

    try {

        weatherResults.innerHTML = "検索中...";

        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=10&language=ja&format=json`
        );

        const data = await response.json();

        weatherResults.innerHTML = "";

        if (!data.results || data.results.length === 0) {
            weatherResults.innerHTML = "候補がありません。";
            return;
        }

        data.results.forEach(location => {

            weatherResults.innerHTML += `
                <div
                    class="setting-row weather-result"
                    data-id="${location.id}"
                    data-name="${location.name}"
                    data-prefecture="${location.admin1 ?? ""}"
                    data-country="${location.country ?? ""}"
                    data-latitude="${location.latitude}"
                    data-longitude="${location.longitude}">

                    <div>
                        <b>🌤 ${location.name}</b><br>
                        <small>
                            ${location.admin1 ?? ""}
                            ${location.country ?? ""}
                        </small>
                    </div>

                </div>
            `;

        });

    } catch (e) {

        console.error(e);

        weatherResults.innerHTML =
            "検索に失敗しました。";

    }

}

document.addEventListener("click", (e) => {

    const item = e.target.closest(".weather-result");

    if (!item) return;

    selectedWeatherLocation = {
        id: item.dataset.id,
        name: item.dataset.name,
        prefecture: item.dataset.prefecture,
        country: item.dataset.country,
        latitude: Number(item.dataset.latitude),
        longitude: Number(item.dataset.longitude)
    };

    weatherSearch.value = selectedWeatherLocation.name;
    weatherResults.innerHTML = "";

    renderSelectedWeather();

});

function renderSelectedWeather() {

    if (!selectedWeatherLocation) {
        weatherSelected.innerHTML = "";
        return;
    }

    weatherSelected.innerHTML = `
        <div class="card setting-card">

            <h3>✅ 選択中</h3>

            <p>
                <b>${selectedWeatherLocation.name}</b><br>
                <small>
                    ${selectedWeatherLocation.prefecture || ""}
                    ${selectedWeatherLocation.country || ""}
                </small>
            </p>

            <small>
                緯度 ${selectedWeatherLocation.latitude}<br>
                経度 ${selectedWeatherLocation.longitude}
            </small>

        </div>
    `;

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

document
.getElementById("profileButton")
.onclick = () => {

    location.href = "profile.html";

};