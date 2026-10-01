function buildStalePresenceUpdates(
  status,
  nowMillis = Date.now(),
  retentionMillis = 30 * 60 * 1000,
) {
  const updates = {};
  for (const [studentNumber, rawPresence] of Object.entries(status || {})) {
    if (!rawPresence || typeof rawPresence !== "object") continue;
    for (const [deviceId, presence] of Object.entries(rawPresence)) {
      if (!presence || typeof presence !== "object") continue;
      const lastChanged = Number(presence.lastChanged || 0);
      if (
        presence.state === "offline" &&
        lastChanged > 0 &&
        nowMillis - lastChanged > retentionMillis
      ) {
        updates[`status/${studentNumber}/${deviceId}`] = null;
      }
    }
  }
  return updates;
}

module.exports = { buildStalePresenceUpdates };
