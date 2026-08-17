import {auth,functions,setupTheme,initializePage,loadProfileImage,loadUserName,setupAdminTab} from "./common.js";
import {httpsCallable} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js";
import {getIdTokenResult} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
const $=id=>document.getElementById(id);setupTheme($("themeButton"));await initializePage([setupAdminTab(),loadUserName($("userName")),loadProfileImage($("topProfileImage"))]);
const status=$("hospitalStatus");
if(!auth.currentUser){status.textContent="CareMateへログインしてから病院登録を行ってください。";$("hospitalForm").hidden=true}else{const token=await getIdTokenResult(auth.currentUser);if(!/^\d{7}$/.test(String(token.claims.studentNumber||""))){status.textContent="CareMateのログイン情報を確認できません。いったんCareMateへログインし直してください。";$("hospitalForm").hidden=true}}
$("hospitalForm").onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;status.textContent="病院を登録中…";try{await httpsCallable(functions,"createClinicalHospital")({hospitalName:$("hospitalName").value.trim(),hospitalId:$("hospitalId").value.trim()});status.textContent="病院を登録しました。登録したアカウントでClinicalへログインしてください。"}catch(error){console.error(error);status.textContent=error.code==="functions/already-exists"?"すでに病院が登録されています。病院アカウントを削除するまで新規登録できません。":"病院を登録できませんでした。病院名・病院ID・CareMateログインを確認してください。"}finally{button.disabled=false}};
