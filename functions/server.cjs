"use strict";

const { cert, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { createGateway } = require("./http_gateway.cjs");

const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (account.project_id !== "universitynotifier-67517"
  || account.client_email !== "caremate-functions@universitynotifier-67517.iam.gserviceaccount.com"
  || !account.private_key) {
  throw new Error("The dedicated CareMate service credential is required.");
}
initializeApp({ credential: cert(account), projectId: account.project_id });
// Used only by the read-only audit to report the actual loaded credential.
process.env.CAREMATE_RUNTIME_SERVICE_ACCOUNT = account.client_email;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const handlers = require("./index.js");
const server = createGateway({
  handlers,
  verifyIdToken: (token, revoked) => getAuth().verifyIdToken(token, revoked),
  allowedOrigin: "https://doko2517027-bit.github.io",
});
server.listen(Number(process.env.PORT || 10000), "0.0.0.0", () => console.log("CareMate authentication service ready"));
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
});
