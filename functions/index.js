const {
    onRequest
} = require("firebase-functions/v2/https");

const {
    initializeApp
} = require("firebase-admin/app");

const {
    getMessaging
} = require("firebase-admin/messaging");

const {
    getFirestore
} = require("firebase-admin/firestore");


initializeApp();

const db = getFirestore();



// ======================
// 通知テスト
// ======================

exports.sendAttendanceTest =
onRequest(
async (request, response)=>{


    const studentNumber = "2510044";


    const userSnap =
        await db
            .collection("users")
            .doc(studentNumber)
            .get();


    if(!userSnap.exists){

        response
            .status(404)
            .send(
                "user not found"
            );

        return;

    }


    const token =
        userSnap.data().fcmToken;


    if(!token){

        response
            .status(400)
            .send(
                "fcmToken missing"
            );

        return;

    }



    const message = {


        token,


        notification:{


            title:
            "📅 出席打刻テスト",


            body:
            "成人看護学 打刻可能時間です\n出席しますか？"

        },


        webpush:{


            notification:{


                actions:[

                    {
                        action:"attendance",
                        title:"出席"
                    },

                    {
                        action:"absent",
                        title:"欠席"
                    }

                ]

            }

        }


    };



    try{


        await getMessaging()
            .send(message);



        response.send(
            "通知送信成功"
        );


    }catch(error){


        console.error(error);


        response
        .status(500)
        .send(
            error.message
        );


    }


});