const PRIMARY_ADMIN_NUMBER = "2510044";

function isPrimaryAdmin(studentNumber, role) {
  return studentNumber === PRIMARY_ADMIN_NUMBER && role === "admin";
}

function canManageAccount(actorNumber, targetNumber, targetRole) {
  if (actorNumber === targetNumber) return false;
  return actorNumber === PRIMARY_ADMIN_NUMBER || targetRole !== "admin";
}

module.exports = { PRIMARY_ADMIN_NUMBER, isPrimaryAdmin, canManageAccount };
