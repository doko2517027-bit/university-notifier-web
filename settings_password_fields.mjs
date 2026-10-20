export function savedExternalPasswordFields(kind, encryptedPassword) {
  if (kind === "manaba") {
    return {
      manabaPasswordEncrypted: encryptedPassword,
      manabaSetupSkipped: false,
      manabaResetRequired: false,
      manabaVerified: null,
      manabaVerifiedAt: null,
      manabaVerificationError: null,
    };
  }
  throw new Error("未対応の連携サービスです");
}
