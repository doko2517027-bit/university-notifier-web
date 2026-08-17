import {setupTheme,initializePage,loadProfileImage,loadUserName,setupAdminTab} from "./common.js";
const $=id=>document.getElementById(id);setupTheme($("themeButton"));await initializePage([setupAdminTab(),loadUserName($("userName")),loadProfileImage($("topProfileImage"))]);
