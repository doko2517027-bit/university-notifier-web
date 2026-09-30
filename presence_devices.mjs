const PRESENCE_PRIORITY = {
  online: 0,
  away: 1,
  offline: 2,
};

export function normalizePresenceDevices(rawPresence) {
  if (!rawPresence || typeof rawPresence !== "object") return [];

  if (typeof rawPresence.state === "string") {
    return [{ deviceId: "legacy", deviceLabel: "旧端末", ...rawPresence }];
  }

  return Object.entries(rawPresence)
    .filter(([, presence]) => presence && typeof presence.state === "string")
    .map(([deviceId, presence]) => ({ deviceId, ...presence }))
    .sort((a, b) => Number(b.lastChanged || 0) - Number(a.lastChanged || 0));
}

export function getPrimaryPresenceDevice(rawPresence) {
  return (
    normalizePresenceDevices(rawPresence)
      .slice()
      .sort((a, b) => {
        const priorityDifference =
          (PRESENCE_PRIORITY[a.state] ?? 3) -
          (PRESENCE_PRIORITY[b.state] ?? 3);
        return (
          priorityDifference ||
          Number(b.lastChanged || 0) - Number(a.lastChanged || 0)
        );
      })[0] || null
  );
}
