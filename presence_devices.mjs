const PRESENCE_PRIORITY = {
  online: 0,
  away: 1,
  offline: 2,
};

export function normalizePresenceDevices(rawPresence) {
  if (!rawPresence || typeof rawPresence !== "object") return [];

  const devices = Object.entries(rawPresence)
    .filter(([, presence]) => presence && typeof presence.state === "string")
    .map(([deviceId, presence]) => ({ deviceId, ...presence }));

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

  return devices.sort((a, b) => {
    const priorityDifference =
      (PRESENCE_PRIORITY[a.state] ?? 3) -
      (PRESENCE_PRIORITY[b.state] ?? 3);
    return priorityDifference || Number(b.lastChanged || 0) - Number(a.lastChanged || 0);
  });
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
