// Do not mistake a service outage or rate limit for an incorrect password.
export function loginErrorMessage(error) {
    switch (error?.code) {
        case "functions/unauthenticated":
        case "auth/invalid-custom-token":
            return "学籍番号またはパスワードを確認してください。";
        case "functions/permission-denied":
            return "このアカウントは利用が許可されていません。";
        case "functions/resource-exhausted":
            return "ログインの試行回数が上限に達しました。15分後にお試しください。";
        case "functions/failed-precondition":
            return "入口の認証が必要です。管理者が発行した新しい文言から開いてください。";
        case "functions/internal":
        case "functions/unavailable":
        case "functions/deadline-exceeded":
            return "認証サービスが一時的に利用できません。管理者へお知らせください。パスワードを変更する必要はありません。";
        default:
            return "ログインできませんでした。通信状態を確認して、もう一度お試しください。";
    }
}
