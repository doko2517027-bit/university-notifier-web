import { getIdTokenResult } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { auth, db } from '../../common.js';

const PILOT_STUDENT = '2510044';

export async function verifyDarumaPilot() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.uid !== `caremate-${PILOT_STUDENT}`) return false;
  const token = await getIdTokenResult(user);
  if (String(token.claims?.studentNumber || '') !== PILOT_STUDENT) return false;
  const profile = await getDocFromServer(doc(db, 'users', PILOT_STUDENT));
  return profile.exists() && String(profile.data()?.studentNumber || profile.id) === PILOT_STUDENT;
}
