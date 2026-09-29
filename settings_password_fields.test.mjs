import assert from "node:assert/strict";
import test from "node:test";
import { savedExternalPasswordFields } from "./settings_password_fields.mjs";

test("Manaba更新時は再設定要求を解除し、連携確認をやり直す", () => {
  assert.deepEqual(savedExternalPasswordFields("manaba", "encrypted"), {
    manabaPasswordEncrypted: "encrypted",
    manabaSetupSkipped: false,
    manabaResetRequired: false,
    manabaVerified: false,
    manabaVerifiedAt: null,
  });
});

test("ActiveMail更新時は設定済みとして扱う", () => {
  assert.deepEqual(savedExternalPasswordFields("activeMail", "encrypted"), {
    activeMailPasswordEncrypted: "encrypted",
    activeMailSetupSkipped: false,
    activeMailResetRequired: false,
  });
});
