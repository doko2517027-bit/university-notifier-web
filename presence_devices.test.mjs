import test from "node:test";
import assert from "node:assert/strict";
import {
  getPrimaryPresenceDevice,
  normalizePresenceDevices,
} from "./presence_devices.mjs";

test("旧形式の接続情報も1台の端末として表示できる", () => {
  const entries = normalizePresenceDevices({
    state: "online",
    pageName: "ホーム画面",
    lastChanged: 10,
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].deviceId, "legacy");
  assert.equal(entries[0].pageName, "ホーム画面");
});

test("複数端末はそれぞれの画面を保持し、オンライン端末を代表状態にする", () => {
  const rawPresence = {
    phone: {
      state: "online",
      deviceLabel: "iPhone",
      pageName: "設定画面",
      lastChanged: 100,
    },
    tablet: {
      state: "away",
      deviceLabel: "iPad",
      pageName: "ホーム画面",
      lastChanged: 200,
    },
  };

  const entries = normalizePresenceDevices(rawPresence);
  assert.deepEqual(
    entries.map((item) => item.deviceId),
    ["tablet", "phone"],
  );
  assert.equal(getPrimaryPresenceDevice(rawPresence).deviceId, "phone");
});
