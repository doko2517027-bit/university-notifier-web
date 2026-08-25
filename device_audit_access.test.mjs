import test from "node:test";
import assert from "node:assert/strict";

import { isPrimaryDeviceAuditViewer } from "./device_audit_access.mjs";

test("端末情報の画面表示は認証済み2510044だけに許可する", () => {
  const claims = { studentNumber: "2510044", admin: true };

  assert.equal(
    isPrimaryDeviceAuditViewer({ uid: "caremate-2510044" }, claims),
    true,
  );
  assert.equal(
    isPrimaryDeviceAuditViewer({ uid: "caremate-2510001" }, claims),
    false,
  );
  assert.equal(
    isPrimaryDeviceAuditViewer(
      { uid: "caremate-2510044" },
      { studentNumber: "2510044", admin: false },
    ),
    false,
  );
  assert.equal(
    isPrimaryDeviceAuditViewer(
      { uid: "caremate-2510044" },
      { studentNumber: "2510001", admin: true },
    ),
    false,
  );
});
