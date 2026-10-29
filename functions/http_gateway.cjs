"use strict";

const http = require("node:http");
const { isIP } = require("node:net");

const PUBLIC_METHODS = new Set(["authenticateCareMate", "authenticateStudyApp", "redeemEntrancePhrase"]);
const ERROR_STATUS = {
  "invalid-argument": 400, unauthenticated: 401, "permission-denied": 403,
  "not-found": 404, "already-exists": 409, "failed-precondition": 400,
  "resource-exhausted": 429, unavailable: 503,
};

// The callable business logic remains unchanged. Authentication, request limits
// and the HTTP boundary are enforced here instead of by the Cloud Run frontend.
function createGateway({ handlers, verifyIdToken, allowedOrigin, maxRequests = 60, now = Date.now }) {
  const windows = new Map();
  let active = 0;
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };
    const fail = (code, message) => send(ERROR_STATUS[code] || 500, { error: { status: code, message } });
    if (origin && origin !== allowedOrigin) return fail("permission-denied", "許可されていない接続元です。");
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Vary", "Origin");
    }
    if (req.url === "/health" && req.method === "GET") return send(200, { ready: true });
    const match = /^\/api\/([A-Za-z][A-Za-z0-9]{0,63})$/.exec(req.url || "");
    const method = match?.[1];
    const handler = method && Object.hasOwn(handlers, method) ? handlers[method] : null;
    if (typeof handler?.run !== "function") return fail("not-found", "この操作は利用できません。");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
      res.writeHead(204); return res.end();
    }
    if (req.method !== "POST") return fail("invalid-argument", "POSTが必要です。");
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
      return fail("invalid-argument", "JSONが必要です。");
    }
    // Render's proxy appends the real client address. Never trust an address
    // prepended by a caller to bypass the persisted per-account login throttle.
    const lastHop = String(req.headers["x-forwarded-for"] || "").split(",").at(-1).trim();
    const ip = isIP(lastHop) ? lastHop : req.socket.remoteAddress || "unknown";
    const time = now();
    for (const [key, entry] of windows) if (entry.expires <= time) windows.delete(key);
    if (windows.size >= 5000 && !windows.has(ip)) return fail("resource-exhausted", "しばらくしてからお試しください。");
    const window = windows.get(ip) || { count: 0, expires: time + 60_000 };
    windows.set(ip, window);
    if (++window.count > maxRequests || active >= 4) {
      res.setHeader("Retry-After", "60");
      return fail("resource-exhausted", "しばらくしてからお試しください。");
    }
    active++;
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) throw { code: "invalid-argument", message: "入力が長すぎます。" };
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw { code: "invalid-argument", message: "入力形式を確認してください。" }; }
      if (!body || typeof body !== "object" || Array.isArray(body)
        || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        throw { code: "invalid-argument", message: "入力形式を確認してください。" };
      }
      let auth;
      if (!PUBLIC_METHODS.has(method)) {
        const token = /^Bearer ([^\s]{1,8192})$/.exec(req.headers.authorization || "")?.[1];
        if (!token) throw { code: "unauthenticated", message: "ログインが必要です。" };
        let decoded;
        try { decoded = await verifyIdToken(token, true); }
        catch { throw { code: "unauthenticated", message: "再度ログインしてください。" }; }
        auth = { uid: decoded.uid, token: decoded };
      }
      const result = await handler.run({ data: body.data, auth, rawRequest: { ip } });
      send(200, { data: result ?? null });
    } catch (error) {
      const code = Object.hasOwn(ERROR_STATUS, error?.code) ? error.code : "internal";
      // Never serialize SDK errors, request bodies, credentials or stack traces.
      fail(code, code === "internal" ? "処理を完了できませんでした。" : String(error.message || "操作できません。"));
    } finally {
      active--;
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5000;
  return server;
}

module.exports = { createGateway };
