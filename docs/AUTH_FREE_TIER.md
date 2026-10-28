# CareMate authentication on Firebase Spark

Updated: 2026-10-28 (JST)

Firebase project: `universitynotifier-67517` (Spark, no linked billing account).
The existing Firebase Authentication UIDs, Firestore data, private password hashes,
and `access` allow-list are retained. No password reset or data conversion is required.

## Runtime

- Public pages: existing GitHub Pages URL.
- Authentication/administrative operations: `https://caremate-auth.onrender.com/api/`.
- Render service: `srv-dbgoi1mi0phs738jjdm0`, My Workspace, **free** compute.
- Build: `npm ci --prefix functions --omit=dev --no-audit --no-fund`.
- Start: `node functions/server.cjs`.
- Health: `GET /health`.
- Existing Python assignment cron is unchanged.

`functions/index.js` and `functions/entrance_gate.js` remain the shared business
logic; the HTTP gateway calls their `.run` handlers only after enforcing the
request boundary. Do not redeploy these as Cloud Functions while using Spark.

The frontend waits for a healthy free instance before sending a request. Only
health GETs are retried; account creation, password changes and one-time phrase
operations are never automatically replayed. A free instance can take about a
minute to resume after being idle. The frontend allows up to two minutes.

## Security

- Same salted PBKDF2 password verification, allow-list and primary-admin checks.
- Protected operations verify Firebase ID tokens and check token revocation.
- Current `access` is checked server-side; stale custom claims do not grant roles.
- Login attempt limits persist in Firestore; the HTTP gateway adds request-size,
  connection-origin, address-rate and concurrency limits.
- Private key is a Render secret environment variable, never a repository asset.
- Dedicated existing service identity: `caremate-functions@universitynotifier-67517.iam.gserviceaccount.com`.
- The additional custom role `caremateTokenVerifier` grants only
  `firebaseauth.users.get`, required for revocation checks. Existing datastore
  permissions are retained; owner/editor rights were not added.
- The HTTP service serves no source files and returns no secrets or stack traces.

## Costs and limits

No paid compute plan is selected. Firebase Spark stops at its free limits.
Render free instance-hours are shared with other free services in the workspace.
Render bandwidth/build overages depend on the existing workspace's billing
settings; free compute alone does not guarantee a zero total workspace bill.
Never upgrade a plan or enable paid capacity without separate user authorization.

## Validation

- 59 automated regression/transport/security tests passed.
- Real temporary account: password verification, custom-token exchange on Spark,
  unchanged UID, access check, member/admin separation, private-data denial,
  password change and re-login passed on the deployed Render endpoint.
- Temporary validation documents and the temporary Firebase Auth user were removed.
- Existing users' passwords and assignment submission history were not modified.

## Rollback

Git history retains the prior client and Cloud Functions definitions. Restoring
the old client requires a functioning Cloud Functions deployment, which is not
available on Spark. Do not restore the old transport alone. Keep the free HTTP
gateway live and roll back to a known-good HTTP gateway/client commit together.

## 2026-10-28 page-loading correction

A stale named import (`functions`) in `common.js` prevented the authenticated
page module graph from linking. Removed that obsolete import/re-export and
unified versioned common-module imports. A VM linking regression test now
checks every client module's local imports before evaluation.

Protected page authorization now reads the current user's `access` document
with `getDocFromServer`. Firebase Security Rules validate the current allow-list
on the server; a cached client role or localStorage flag is never sufficient.
This avoids waking the free HTTP gateway on every page/tab change. Privileged
operations still go through the HTTP gateway and its token/role checks.

Opening the login UI starts a one-shot health warm-up. There are no periodic
keep-alive requests. Profile-cache reads and activity metadata no longer add
network waits before navigating to Home. A separate classic-script status
message remains visible if page modules fail before protected content can show.

Browser verification used local-only sample auth/data (no real accounts, keys
or Firestore writes): Home, day-detail popup, Study, Assignments and Settings
rendered and navigation succeeded. Production users' credentials were not used
for this local UI verification.
