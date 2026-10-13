import { THROB_CLOUD_COLLECTION, verifiedCareMateStudent } from '../services/cloudSync.js';

// Public Firebase client config, matching CareMate's existing project.
// No service-account key or administrator secret belongs in browser code.
const firebaseConfig = {
  apiKey: 'AIzaSyAEtS2NGZKqHFh29kmR9OjEpshbC1yvjFY',
  authDomain: 'universitynotifier-67517.firebaseapp.com',
  projectId: 'universitynotifier-67517',
  appId: '1:908622250178:web:3e355fce8698fcf179bb5b',
};
const sdk = 'https://www.gstatic.com/firebasejs/12.2.1';

export async function connectCareMate() {
  const [{ initializeApp, getApps, getApp }, { getAuth, getIdTokenResult }, firestore, functions] = await Promise.all([
    import(`${sdk}/firebase-app.js`),
    import(`${sdk}/firebase-auth.js`),
    import(`${sdk}/firebase-firestore.js`),
    import(`${sdk}/firebase-functions.js`),
  ]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await auth.authStateReady();
  const user = auth.currentUser;
  const studentNumber = localStorage.getItem('studentNumber');
  if (localStorage.getItem('loggedIn') !== 'true' || !user || !studentNumber) return null;
  const token = await getIdTokenResult(user);
  const db = firestore.getFirestore(app);
  const userSnapshot = await firestore.getDoc(firestore.doc(db, 'users', studentNumber));
  if (!userSnapshot.exists()) return null;
  const verified = verifiedCareMateStudent({ user, claims: token.claims, studentNumber,
    profileStudentNumber: userSnapshot.data()?.studentNumber || studentNumber });
  if (!verified) return null;

  const adapter = {
    async read(id) {
      const snapshot = await firestore.getDoc(firestore.doc(db, THROB_CLOUD_COLLECTION, id));
      return snapshot.exists() ? snapshot.data() : null;
    },
    async write(id, profile, expectedRevision) {
      const profileJson = JSON.stringify(profile);
      if (profileJson.length > 100000) throw new Error('profile-too-large');
      const ref = firestore.doc(db, THROB_CLOUD_COLLECTION, id);
      return firestore.runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const revision = snapshot.exists() ? Number(snapshot.data()?.revision) : 0;
        if (revision !== expectedRevision) {
          const error = new Error('revision-conflict');
          error.code = 'revision-conflict';
          throw error;
        }
        transaction.set(ref, { version: 1, revision: revision + 1, profileJson,
          updatedAt: firestore.serverTimestamp() });
        return revision + 1;
      });
    },
  };
  let learningPoints = null;
  try {
    const snapshot = await firestore.getDoc(firestore.doc(db, 'totalRanking', verified));
    const value = Number(snapshot.data()?.point);
    if (Number.isSafeInteger(value) && value >= 0) learningPoints = value;
  } catch {
    // The point display is optional. Throb never writes official CareMate points.
  }
  const functionsApp = functions.getFunctions(app, 'asia-northeast1');
  const gacha = {
    async state() {
      return (await functions.httpsCallable(functionsApp, 'getThrobGachaState')({})).data;
    },
    async draw(payload) {
      return (await functions.httpsCallable(functionsApp, 'drawThrobGacha')(payload)).data;
    },
    async buy(payload) {
      return (await functions.httpsCallable(functionsApp, 'buyThrobShopItem')(payload)).data;
    },
    async equip(payload) {
      return (await functions.httpsCallable(functionsApp, 'equipThrobItem')(payload)).data;
    },
  };
  return { studentNumber: verified, adapter, learningPoints, gacha };
}
