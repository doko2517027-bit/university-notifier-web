const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStalePresenceUpdates } = require("./presence_cleanup.js");

test("古いオフライン端末だけをリアルタイム監視から整理する", () => {
  const updates = buildStalePresenceUpdates(
    {
      2510044: {
        online: { state: "online", lastChanged: 1000 },
        recent: { state: "offline", lastChanged: 900 },
        stale: { state: "offline", lastChanged: 100 },
      },
    },
    1000,
    200,
  );
  assert.deepEqual(updates, { "status/2510044/stale": null });
});
