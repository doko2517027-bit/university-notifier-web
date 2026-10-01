function buildOrphanedPresenceUpdates(status, knownDeviceIdsByStudent = {}) {
  const updates = {};
  for (const [studentNumber, rawPresence] of Object.entries(status || {})) {
    if (!rawPresence || typeof rawPresence !== "object") continue;
    const knownDeviceIds = new Set(
      knownDeviceIdsByStudent[studentNumber] || [],
    );
    for (const [deviceId, presence] of Object.entries(rawPresence)) {
      if (!presence || typeof presence !== "object") continue;
      if (
        presence.state === "offline" &&
        !knownDeviceIds.has(deviceId)
      ) {
        updates[`status/${studentNumber}/${deviceId}`] = null;
      }
    }
  }
  return updates;
}

module.exports = { buildOrphanedPresenceUpdates };
