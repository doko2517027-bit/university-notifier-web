export const DEFAULT_ALLOWED_STUDENTS = Object.freeze(['2510044']);

export function authorizedIdentity(decoded, allowedStudents = DEFAULT_ALLOWED_STUDENTS) {
  const studentNumber = String(decoded?.studentNumber || '');
  if (!allowedStudents.includes(studentNumber)) return null;
  if (decoded?.uid !== `caremate-${studentNumber}` || !/^\d{7}$/.test(studentNumber)) return null;
  return { uid: decoded.uid, studentNumber, name: studentNumber };
}
