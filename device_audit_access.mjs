export function isPrimaryDeviceAuditViewer(currentUser, claims) {
  return (
    currentUser?.uid === "caremate-2510044" &&
    claims?.studentNumber === "2510044" &&
    claims?.admin === true
  );
}
