import { THROB_TEST_STUDENTS } from '../services/cloudSync.js';

export function throbAccessState({ loggedIn, localStudentNumber, verifiedStudentNumber }) {
  if (!loggedIn || !localStudentNumber) return 'login';
  if (!THROB_TEST_STUDENTS.includes(localStudentNumber)) return 'maintenance';
  if (verifiedStudentNumber === undefined) return 'checking';
  return verifiedStudentNumber === localStudentNumber ? 'allowed' : 'login';
}
