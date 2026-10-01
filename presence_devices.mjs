const PRESENCE_PRIORITY = {
  online: 0,
  away: 1,
  offline: 2,
};

export function normalizePresenceDevices(
  rawPresence,
  { now = 0, offlineRetentionMs = 0 } = {},
) {
  if (!rawPresence || typeof rawPresence !== "object") return [];

  const devices = Object.entries(rawPresence)
    .filter(([, presence]) => presence && typeof presence.state === "string")
    .map(([deviceId, presence]) => ({ deviceId, ...presence }))
    .filter((presence) => {
      if (!now || !offlineRetentionMs || presence.state !== "offline") return true;
      const lastChanged = Number(presence.lastChanged || 0);
      return lastChanged > 0 && now - lastChanged <= offlineRetentionMs;
    });

  // 移行前の1端末形式と新しい端末別形式が同じ学生の下に混在しても、
  // 新形式を隠さず、それぞれの現在画面を独立して表示する。
  if (typeof rawPresence.state === "string") {
    devices.push({
      deviceId: "legacy",
      deviceLabel: "旧端末",
      studentNumber: rawPresence.studentNumber,
      state: rawPresence.state,
      page: rawPresence.page,
      pageName: rawPresence.pageName,
      lastChanged: rawPresence.lastChanged,
    });
  }

  const merged = new Map();
  devices.forEach((device) => {
    const label = String(device.deviceLabel || "").trim();
    if (!label) {
      merged.set(`${device.deviceId}`, device);
      return;
    }
    const existing = merged.get(`label:${label}`);
    if (!existing) {
      merged.set(`label:${label}`, { ...device, mergedDeviceCount: 1 });
      return;
    }
    const existingPriority = PRESENCE_PRIORITY[existing.state] ?? 3;
    const devicePriority = PRESENCE_PRIORITY[device.state] ?? 3;
    const keep = devicePriority < existingPriority ||
      (devicePriority === existingPriority && Number(device.lastChanged || 0) > Number(existing.lastChanged || 0))
      ? device : existing;
    merged.set(`label:${label}`, {
      ...keep,
      mergedDeviceCount: Number(existing.mergedDeviceCount || 1) + 1,
      mergedDeviceIds: [...(existing.mergedDeviceIds || [existing.deviceId]), device.deviceId].filter(Boolean),
    });
  });

  return [...merged.values()].sort((a, b) => {
    const priorityDifference =
      (PRESENCE_PRIORITY[a.state] ?? 3) -
      (PRESENCE_PRIORITY[b.state] ?? 3);
    return priorityDifference || Number(b.lastChanged || 0) - Number(a.lastChanged || 0);
  });
}

export function getPrimaryPresenceDevice(rawPresence, options = {}) {
  return (
    normalizePresenceDevices(rawPresence, options)
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
