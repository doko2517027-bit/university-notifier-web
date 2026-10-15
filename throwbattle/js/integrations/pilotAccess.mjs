export const THROB_PILOT_STUDENT_NUMBER = '2510044';

export function isThrobPilotIdentity({ uid, tokenStudentNumber, profileStudentNumber, profileExists }) {
  return profileExists === true &&
    uid === `caremate-${THROB_PILOT_STUDENT_NUMBER}` &&
    tokenStudentNumber === THROB_PILOT_STUDENT_NUMBER &&
    profileStudentNumber === THROB_PILOT_STUDENT_NUMBER;
}
