import { isLeaveActive } from "./academic_lifecycle.mjs";

export function courseRegistrationAccess(user = {}, { previewMode = false } = {}) {
  if (previewMode) {
    return { allowed: true, reason: "preview" };
  }

  if (isLeaveActive(user)) {
    return {
      allowed: false,
      reason: "leave",
      title: "休学中です",
      message: "休学中は履修登録できません。ホーム画面の「復学」から再開してください。",
    };
  }

  if (["graduated", "withdrawn"].includes(user.academicStatus)) {
    return {
      allowed: false,
      reason: user.academicStatus,
      title: "履修登録できません",
      message: "現在の学籍ステータスでは履修登録できません。",
    };
  }

  // manabaの認証状態は課題取得用。外部サービスの一時的な認証失敗で、
  // CareMate内の履修登録まで止めない。
  return { allowed: true, reason: "active" };
}
