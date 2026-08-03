const {
    onRequest
} = require("firebase-functions/v2/https");

const {
    initializeApp
} = require("firebase-admin/app");

const {
    getMessaging
} = require("firebase-admin/messaging");


initializeApp();



// ======================
// 通知テスト
// ======================

exports.sendAttendanceTest =
onRequest(
async (request, response)=>{


    const token =
        request.query.token;



    if(!token){

        response
            .status(400)
            .send(
                "token missing"
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