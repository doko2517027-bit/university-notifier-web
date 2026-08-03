importScripts(
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js"
);


firebase.initializeApp({
    apiKey: "AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY",
    authDomain: "universitynotifier-67517.firebaseapp.com",
    projectId: "universitynotifier-67517",
    storageBucket: "universitynotifier-67517.firebasestorage.app",
    messagingSenderId: "908622250178",
    appId: "1:908622250178:web:3e355fce8698fcf179bb5b"
});


const messaging =
    firebase.messaging();


messaging.onBackgroundMessage(
    payload => {

        console.log(
            "バックグラウンド通知受信:",
            payload
        );


        self.registration.showNotification(
            payload.notification.title,
            {
                body:
                    payload.notification.body,

                icon:
                    "/icon-192.png",

                badge:
                    "/icon-192.png"
            }
        );

    }
);