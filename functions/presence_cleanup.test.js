const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOrphanedPresenceUpdates } = require("./presence_cleanup.js");

test("端末履歴にない旧オフラインIDだけを整理し、実端末は残す", () => {
  const updates = buildOrphanedPresenceUpdates(
    {
      2510044: {
        macCurrent: { state: "offline", lastChanged: 1000 },
        macOld: { state: "offline", lastChanged: 900 },
        transientOnline: { state: "online", lastChanged: 100 },
      },
    },
    { 2510044: ["macCurrent"] },
  );
  assert.deepEqual(updates, { "status/2510044/macOld": null });
});
