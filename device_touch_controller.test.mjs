import test from "node:test";
import assert from "node:assert/strict";

import {
  DEVICE_TOUCH_LAST_SUCCESS_KEY,
  DEVICE_TOUCH_PENDING_KEY,
  DEVICE_TOUCH_INTERVAL_MS,
  createCareMateDeviceTouchController,
  isCareMateForceLogoutCheckDue,
  isVerifiedCareMateDeviceTouchIdentity,
  requiresCareMateReauthentication,
  shouldForceLogoutCareMateSession,
  shouldStartCareMateDeviceTouch,
} from "./device_touch_controller.mjs";

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("ログイン済みの主要ページだけ端末touchを開始する", () => {
  const base = {
    studentNumber: "2510044",
    loggedIn: true,
    pathname: "/university-notifier-web/index.html",
  };

  assert.equal(shouldStartCareMateDeviceTouch(base), true);
  assert.equal(
    shouldStartCareMateDeviceTouch({ ...base, pathname: "/quiz.html" }),
    true,
  );
  assert.equal(
    shouldStartCareMateDeviceTouch({ ...base, pathname: "/login.html" }),
    false,
  );
  assert.equal(
    shouldStartCareMateDeviceTouch({ ...base, pathname: "/register.html" }),
    false,
  );
  assert.equal(
    shouldStartCareMateDeviceTouch({ ...base, loggedIn: false }),
    false,
  );
});

test("認証UID・トークン・プロフィールがすべて本人と一致した時だけ許可する", () => {
  const identity = {
    uid: "caremate-2510044",
    studentNumber: "2510044",
    tokenStudentNumber: "2510044",
    profileExists: true,
    profileStudentNumber: "2510044",
  };

  assert.equal(isVerifiedCareMateDeviceTouchIdentity(identity), true);
  assert.equal(
    isVerifiedCareMateDeviceTouchIdentity({
      ...identity,
      uid: "caremate-2510001",
    }),
    false,
  );
  assert.equal(
    isVerifiedCareMateDeviceTouchIdentity({
      ...identity,
      profileExists: false,
    }),
    false,
  );
});

test("旧ローカルログインだけが再ログイン対象になる", () => {
  assert.equal(
    requiresCareMateReauthentication({
      studentNumber: "2510001",
      loggedIn: true,
      uid: "",
    }),
    true,
  );
  assert.equal(
    requiresCareMateReauthentication({
      studentNumber: "2510001",
      loggedIn: true,
      uid: "caremate-2519999",
    }),
    true,
  );
  assert.equal(
    requiresCareMateReauthentication({
      studentNumber: "2510001",
      loggedIn: true,
      uid: "caremate-2510001",
    }),
    false,
  );
  assert.equal(
    requiresCareMateReauthentication({
      studentNumber: "2510001",
      loggedIn: false,
      uid: "",
    }),
    false,
  );
});

test("アプリを開くとtouchし、短時間のページ移動では再送しない", async () => {
  const storage = createStorage();
  let now = 1_000_000;
  let sendCount = 0;
  const createController = () =>
    createCareMateDeviceTouchController({
      storage,
      shouldStart: () => true,
      verifyIdentity: async () => true,
      getDeviceId: () => "12345678-1234-1234-1234-123456789012",
      sendTouch: async () => {
        sendCount += 1;
        return true;
      },
      getNow: () => now,
    });

  assert.equal(await createController()(), true);
  assert.equal(sendCount, 1);

  now += 60 * 1000;
  assert.equal(await createController()(), false);
  assert.equal(sendCount, 1);

  now += DEVICE_TOUCH_INTERVAL_MS;
  assert.equal(await createController()(), true);
  assert.equal(sendCount, 2);
});

test("同じページ内の同時要求は1回のtouchにまとめる", async () => {
  const storage = createStorage();
  let finishTouch;
  let sendCount = 0;
  const controller = createCareMateDeviceTouchController({
    storage,
    shouldStart: () => true,
    verifyIdentity: async () => true,
    getDeviceId: () => "12345678-1234-1234-1234-123456789012",
    sendTouch: async () => {
      sendCount += 1;
      return new Promise((resolve) => {
        finishTouch = resolve;
      });
    },
    getNow: () => 2_000_000,
  });

  const first = controller();
  const second = controller();
  await Promise.resolve();
  finishTouch(true);

  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(sendCount, 1);
});

test("未ログインでは送信せず、Functions失敗も画面処理へ例外を返さない", async () => {
  const storage = createStorage();
  let sendCount = 0;
  const loggedOutController = createCareMateDeviceTouchController({
    storage,
    shouldStart: () => false,
    verifyIdentity: async () => true,
    getDeviceId: () => "unused",
    sendTouch: async () => {
      sendCount += 1;
      return true;
    },
  });

  assert.equal(await loggedOutController(), false);
  assert.equal(sendCount, 0);

  const failingController = createCareMateDeviceTouchController({
    storage,
    shouldStart: () => true,
    verifyIdentity: async () => true,
    getDeviceId: () => "12345678-1234-1234-1234-123456789012",
    sendTouch: async () => {
      throw new Error("functions unavailable");
    },
    getNow: () => 3_000_000,
  });

  assert.equal(await failingController(), false);
  assert.equal(storage.getItem(DEVICE_TOUCH_LAST_SUCCESS_KEY), null);
  assert.equal(storage.getItem(DEVICE_TOUCH_PENDING_KEY), null);
});

test("強制ログアウト要求より前の認証だけを対象にする", () => {
  assert.equal(
    shouldForceLogoutCareMateSession({
      authTimeMillis: 1_000,
      deviceRequestedAt: 2_000,
    }),
    true,
  );
  assert.equal(
    shouldForceLogoutCareMateSession({
      authTimeMillis: 1_000,
      allDevicesRequestedAt: 2_000,
    }),
    true,
  );
  assert.equal(
    shouldForceLogoutCareMateSession({
      authTimeMillis: 3_000,
      deviceRequestedAt: 2_000,
      allDevicesRequestedAt: 2_500,
    }),
    false,
  );
  assert.equal(
    shouldForceLogoutCareMateSession({
      authTimeMillis: 0,
      allDevicesRequestedAt: 2_000,
    }),
    true,
  );
});

test("強制ログアウトの補助確認は1分間隔に抑制する", () => {
  assert.equal(
    isCareMateForceLogoutCheckDue({ now: 100_000, lastCheckedAt: 0 }),
    true,
  );
  assert.equal(
    isCareMateForceLogoutCheckDue({
      now: 150_000,
      lastCheckedAt: 100_000,
    }),
    false,
  );
  assert.equal(
    isCareMateForceLogoutCheckDue({
      now: 160_000,
      lastCheckedAt: 100_000,
    }),
    true,
  );
});
