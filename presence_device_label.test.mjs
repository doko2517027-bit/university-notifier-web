import test from "node:test";
import assert from "node:assert/strict";
import { describePresenceDevice } from "./presence_device_label.mjs";

test("iPhoneは不正確な機種番号を推定せずブラウザだけ添える", () => {
  assert.equal(
    describePresenceDevice({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
    }),
    "iPhone（詳細不明）・Safari",
  );
});

test("Androidは取得できる機種名とブラウザを表示する", () => {
  assert.equal(
    describePresenceDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36",
    }),
    "Android（SM-S918B）・Chrome",
  );
  assert.equal(
    describePresenceDevice({ userAgent: "Mozilla/5.0 (Linux; Android 15; K) Chrome/128.0" , clientHintModel: "Pixel 9" }),
    "Android（Pixel 9）・Chrome",
  );
});

test("PCはOSとブラウザを表示する", () => {
  assert.equal(
    describePresenceDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" }),
    "Windows PC・Chrome",
  );
});
