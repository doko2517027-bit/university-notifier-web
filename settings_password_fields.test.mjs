import assert from "node:assert/strict";
import test from "node:test";
import { savedExternalPasswordFields } from "./settings_password_fields.mjs";

test("manaba更新時は再設定要求を解除し、連携確認をやり直す", () => {
  assert.deepEqual(savedExternalPasswordFields("manaba", "encrypted"), {
    manabaPasswordEncrypted: "encrypted",
    manabaSetupSkipped: false,
    manabaResetRequired: false,
    manabaVerified: null,
    manabaVerifiedAt: null,
    manabaVerificationError: null,
  });
});
