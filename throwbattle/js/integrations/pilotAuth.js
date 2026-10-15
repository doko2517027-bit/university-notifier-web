import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { auth, db } from '../../../common.js';
import { isThrobPilotIdentity, THROB_PILOT_STUDENT_NUMBER } from './pilotAccess.mjs';

export async function verifyThrobPilot() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.uid !== `caremate-${THROB_PILOT_STUDENT_NUMBER}`) return false;

  const token = await getIdTokenResult(user);
  if (String(token.claims?.studentNumber || '') !== THROB_PILOT_STUDENT_NUMBER) return false;

  const profile = await getDocFromServer(doc(db, 'users', THROB_PILOT_STUDENT_NUMBER));
  return isThrobPilotIdentity({
    uid: user.uid,
    tokenStudentNumber: String(token.claims?.studentNumber || ''),
    profileExists: profile.exists(),
    profileStudentNumber: String(profile.data()?.studentNumber || profile.id || ''),
  });
}
