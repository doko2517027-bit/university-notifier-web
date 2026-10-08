import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [indexHtml, appJs, settingsHtml, settingsJs, pushJs] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./settings.html", import.meta.url), "utf8"),
  readFile(new URL("./settings.js", import.meta.url), "utf8"),
  readFile(new URL("./push_subscription.js", import.meta.url), "utf8"),
]);

test("ホームはPush未登録者だけに案内カードと設定案内を表示する", () => {
  assert.match(indexHtml, /id="pushNotificationSetupCard"/);
  assert.match(indexHtml, /Push通知を登録してください/);
  assert.match(indexHtml, /id="pushNotificationGuideModal"/);
  assert.match(indexHtml, /id="openPushNotificationSettings"/);
  assert.match(indexHtml, /id="sendMyPushTestNotification"/);
  assert.match(indexHtml, /id="confirmPushNotificationWorking"/);
  assert.match(appJs, /pushNotificationSetupCard\.hidden = status\.registered/);
  assert.match(appJs, /settings\.html#pushNotifications/);
  assert.match(appJs, /sendMyPushTestNotification/);
  assert.match(appJs, /confirmPushNotificationWorking/);
});

test("Push登録済み判定は権限だけでなく現在端末・新旧の保存先を照合する", () => {
  assert.match(pushJs, /pushManager\?\.getSubscription/);
  assert.match(pushJs, /collection\(db, "users", userId, "pushSubscriptions"\)/);
  assert.match(pushJs, /resolvedUserData\?\.pushSubscription/);
  assert.match(pushJs, /currentSubscription \|\| accountRegistered/);
  assert.match(pushJs, /pushSelfReportedWorking === true/);
});

test("権限済みなのに購読保存が欠けた端末は自動修復する", () => {
  assert.match(pushJs, /permission === "granted" && repair && !currentSubscription/);
  assert.match(pushJs, /home-status-repair/);
  assert.match(pushJs, /caremate:push-registration-changed/);
});

test("設定画面は登録状態を表示し、説明後に端末の許可を求める", () => {
  assert.match(settingsHtml, /id="pushNotifications"/);
  assert.match(settingsHtml, /id="pushRegistrationStatus"/);
  assert.match(settingsJs, /requestPushPermissionWithEducation\(\{ force: true \}\)/);
  assert.match(settingsJs, /この端末のPush通知は登録済みです/);
});
