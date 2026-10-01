const ACTIVE_TIMEOUT_MS = 30 * 60 * 1000;
const COOLDOWN_MS = 5 * 60 * 1000;

function millis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return Number(value) || 0;
}

function manualUpdateDecision(existing, nowMillis = Date.now()) {
  const status = String(existing?.status || "");
  const updatedAt = millis(existing?.updatedAt || existing?.requestedAt);
  const age = updatedAt ? nowMillis - updatedAt : Number.POSITIVE_INFINITY;

  if (["queued", "running"].includes(status) && age < ACTIVE_TIMEOUT_MS) {
    return { allowed: false, reason: "already-running" };
  }
  if (["success", "partial", "failed"].includes(status) && age < COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown" };
  }
  return { allowed: true, reason: "ready" };
}

module.exports = {
  ACTIVE_TIMEOUT_MS,
  COOLDOWN_MS,
  manualUpdateDecision,
};
