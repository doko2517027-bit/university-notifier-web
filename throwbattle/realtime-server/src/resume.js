export const RECONNECT_GRACE_MS = 60_000;

export function resumableSession(sessions, token, uid, now = Date.now()) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  for (const [id, session] of sessions) {
    if (session.resumeToken !== token || session.identity.uid !== uid) continue;
    if (session.disconnectedAt && now - session.disconnectedAt >= RECONNECT_GRACE_MS) return null;
    return { id, session };
  }
  return null;
}

export function sessionExpired(session, now = Date.now()) {
  return !!session.disconnectedAt && now - session.disconnectedAt >= RECONNECT_GRACE_MS;
}
