export function savedExternalPasswordFields(kind, encryptedPassword) {
  if (kind === "manaba") {
    return {
      manabaPasswordEncrypted: encryptedPassword,
      manabaSetupSkipped: false,
      manabaResetRequired: false,
      manabaVerified: false,
      manabaVerifiedAt: null,
    };
  }
  if (kind === "activeMail") {
    return {
      activeMailPasswordEncrypted: encryptedPassword,
      activeMailSetupSkipped: false,
      activeMailResetRequired: false,
    };
  }
  throw new Error("未対応の連携サービスです");
}
