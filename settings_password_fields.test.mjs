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

test("ActiveMail更新時は自動ログインの確認待ちに戻す", () => {
  assert.deepEqual(savedExternalPasswordFields("activeMail", "encrypted"), {
    activeMailPasswordEncrypted: "encrypted",
    activeMailSetupSkipped: false,
    activeMailResetRequired: false,
    activeMailVerified: null,
    activeMailVerifiedAt: null,
    activeMailVerificationError: null,
  });
});
