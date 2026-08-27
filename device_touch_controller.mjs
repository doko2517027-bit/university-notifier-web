export const DEVICE_TOUCH_LAST_SUCCESS_KEY = "careMateDeviceLastTouchAt";
export const DEVICE_TOUCH_PENDING_KEY = "careMateDeviceTouchPendingAt";
export const DEVICE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
export const DEVICE_TOUCH_PENDING_TTL_MS = 60 * 1000;

const DEVICE_TOUCH_EXCLUDED_PAGES = new Set([
  "login.html",
  "register.html",
  "clinical_login.html",
]);

export function shouldStartCareMateDeviceTouch({
  studentNumber,
  loggedIn,
  pathname,
}) {
  const pageName = String(pathname || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .pop() || "index.html";

  return (
    /^\d{7}$/.test(String(studentNumber || "")) &&
    loggedIn === true &&
    !DEVICE_TOUCH_EXCLUDED_PAGES.has(pageName)
  );
}

export function isVerifiedCareMateDeviceTouchIdentity({
  uid,
  studentNumber,
  tokenStudentNumber,
  profileExists,
  profileStudentNumber,
}) {
  const normalizedStudentNumber = String(studentNumber || "");

  return (
    /^\d{7}$/.test(normalizedStudentNumber) &&
    uid === `caremate-${normalizedStudentNumber}` &&
    tokenStudentNumber === normalizedStudentNumber &&
    profileExists === true &&
    profileStudentNumber === normalizedStudentNumber
  );
}

export function isCareMateDeviceTouchDue({
  now,
  lastSuccessAt,
  pendingAt,
  intervalMs = DEVICE_TOUCH_INTERVAL_MS,
  pendingTtlMs = DEVICE_TOUCH_PENDING_TTL_MS,
}) {
  if (lastSuccessAt > 0 && now - lastSuccessAt < intervalMs) return false;
  if (pendingAt > 0 && now - pendingAt < pendingTtlMs) return false;
  return true;
}

export function shouldForceLogoutCareMateSession({
  authTimeMillis,
  deviceRequestedAt = 0,
  allDevicesRequestedAt = 0,
}) {
  const requestedAt = Math.max(
    Number(deviceRequestedAt || 0),
    Number(allDevicesRequestedAt || 0),
  );
  const authenticatedAt = Number(authTimeMillis || 0);

  return requestedAt > 0 && (!authenticatedAt || authenticatedAt <= requestedAt);
}

export function createCareMateDeviceTouchController({
  storage,
  shouldStart,
  verifyIdentity,
  getDeviceId,
  sendTouch,
  getNow = () => Date.now(),
  onError = () => {},
}) {
  let inFlight = null;

  return async function touchCareMateDevice() {
    if (!shouldStart()) return false;
    if (inFlight) return inFlight;

    const now = getNow();
    const lastSuccessAt = Number(
      storage.getItem(DEVICE_TOUCH_LAST_SUCCESS_KEY) || 0,
    );
    const pendingAt = Number(storage.getItem(DEVICE_TOUCH_PENDING_KEY) || 0);

    if (!isCareMateDeviceTouchDue({ now, lastSuccessAt, pendingAt })) {
      return false;
    }

    const startedAt = now;
    storage.setItem(DEVICE_TOUCH_PENDING_KEY, String(startedAt));

    const task = (async () => {
      try {
        if (!(await verifyIdentity())) return false;

        const result = await sendTouch(getDeviceId());
        if (result !== true) return false;

        storage.setItem(DEVICE_TOUCH_LAST_SUCCESS_KEY, String(getNow()));
        return true;
      } catch (error) {
        onError(error);
        return false;
      } finally {
        if (
          storage.getItem(DEVICE_TOUCH_PENDING_KEY) === String(startedAt)
        ) {
          storage.removeItem(DEVICE_TOUCH_PENDING_KEY);
        }
      }
    })();

    inFlight = task;

    try {
      return await task;
    } finally {
      if (inFlight === task) inFlight = null;
    }
  };
}
