const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createGateway } = require("./http_gateway.cjs");
const origin = "https://doko2517027-bit.github.io";
async function setup(t, options = {}) {
  let calls = 0;
  const server = createGateway({
    handlers: {
      authenticateCareMate: { run: async ({ data }) => ({ accepted: data.studentNumber }) },
      authenticateStudyApp: { run: async ({ data }) => ({ accepted: data.studentNumber }) },
      requestStudyAppPasswordReset: { run: async ({ data }) => ({ accepted: Boolean(data.studentNumber) }) },
      completeStudyAppRegistration: { run: async ({ auth, data }) => ({ uid: auth.uid, studentNumber: data.studentNumber }) },
      createStudyAppUploadSignature: { run: async ({ auth }) => ({ uid: auth.uid, signature: "hidden" }) },
      checkCareMateAccess: { run: async ({ auth }) => { calls++; return { uid: auth.uid }; } },
      issueEntrancePhrase: { run: async () => { throw { code: "permission-denied", message: "管理者のみ" }; } },
      faulty: { run: async () => { throw new Error("secret must never be returned"); } },
    },
    allowedOrigin: origin,
    verifyIdToken: async (token, revoked) => {
      assert.equal(revoked, true);
      if (token !== "valid") throw new Error("revoked");
      return { uid: "caremate-2510044", studentNumber: "2510044" };
    },
    ...options,
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (method, body = { data: {} }, extra = {}) => fetch(`${url}/api/${method}`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { post, url, calls: () => calls };
}
test("public login and health work without a token", async t => {
  const { post, url } = await setup(t);
  const response = await post("authenticateCareMate", { data: { studentNumber: "2510044" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: { accepted: "2510044" } });
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("strict-transport-security"), /max-age=31536000/);
  const study = await post("authenticateStudyApp", { data: { studentNumber: "2510044" } });
  assert.equal(study.status, 200);
  const reset = await post("requestStudyAppPasswordReset", { data: { studentNumber: "2510147" } });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { data: { accepted: true } });
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ready: true });
});
test("protected operations reject missing, forged and revoked tokens before handler execution", async t => {
  const { post, calls } = await setup(t);
  assert.equal((await post("checkCareMateAccess")).status, 401);
  assert.equal((await post("checkCareMateAccess", { data: {} }, { Authorization: "Bearer forged" })).status, 401);
  assert.equal(calls(), 0);
  const r = await post("checkCareMateAccess", { data: {} }, { Authorization: "Bearer valid" });
  assert.deepEqual(await r.json(), { data: { uid: "caremate-2510044" } });
  assert.equal(calls(), 1);
  assert.equal((await post("completeStudyAppRegistration", { data: { studentNumber: "2510147" } })).status, 401);
  const registration = await post("completeStudyAppRegistration", { data: { studentNumber: "2510147" } }, { Authorization: "Bearer valid" });
  assert.deepEqual(await registration.json(), { data: { uid: "caremate-2510044", studentNumber: "2510147" } });
  assert.equal((await post("createStudyAppUploadSignature", { data: { purpose: "question" } })).status, 401);
  const upload = await post("createStudyAppUploadSignature", { data: { purpose: "question" } }, { Authorization: "Bearer valid" });
  assert.deepEqual(await upload.json(), { data: { uid: "caremate-2510044", signature: "hidden" } });
});
test("cross-origin, unknown routes, malformed and oversized requests are rejected", async t => {
  const { post, url } = await setup(t);
  assert.equal((await post("authenticateCareMate", { data: {} }, { Origin: "https://attacker.invalid" })).status, 403);
  assert.equal((await fetch(`${url}/api/authenticateCareMate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: {} }) })).status, 403);
  assert.equal((await post("constructor")).status, 404);
  assert.equal((await post("authenticateCareMate", "not json")).status, 400);
  assert.equal((await post("authenticateCareMate", { data: [] })).status, 400);
  assert.equal((await post("authenticateCareMate", { data: { password: "x".repeat(17_000) } })).status, 400);
});
test("error responses retain permission errors but hide internal errors", async t => {
  const { post } = await setup(t);
  const headers = { Authorization: "Bearer valid" };
  assert.equal((await post("issueEntrancePhrase", { data: {} }, headers)).status, 403);
  const r = await post("faulty", { data: {} }, headers);
  assert.equal(r.status, 500);
  assert.doesNotMatch(await r.text(), /secret/);
});
test("rate limiting cannot be bypassed by spoofing the first forwarded address", async t => {
  const { post } = await setup(t, { maxRequests: 2 });
  for (let i = 0; i < 2; i++) {
    assert.equal((await post("authenticateCareMate", { data: {} }, { "X-Forwarded-For": `1.1.1.${i}, 2.2.2.2` })).status, 200);
  }
  assert.equal((await post("authenticateCareMate", { data: {} }, { "X-Forwarded-For": "9.9.9.9, 2.2.2.2" })).status, 429);
});
