import { createProfile, validProfile } from './profile.js';

export const THROB_TEST_STUDENTS = Object.freeze(['2510044']);
export const THROB_CLOUD_COLLECTION = 'throbPrototypeProfiles';
const sameProfile = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function verifiedCareMateStudent({ user, claims, studentNumber, profileStudentNumber }) {
  const id = String(studentNumber || '');
  if (!THROB_TEST_STUDENTS.includes(id)) return null;
  if (user?.uid !== `caremate-${id}` || String(claims?.studentNumber || '') !== id) return null;
  if (String(profileStudentNumber || '') !== id) return null;
  return id;
}

export function parseCloudProfile(document) {
  if (!document || document.version !== 1 || !Number.isSafeInteger(document.revision) || document.revision < 1) return null;
  if (typeof document.profileJson !== 'string' || document.profileJson.length > 100000) return null;
  try {
    const profile = JSON.parse(document.profileJson);
    return validProfile(profile) ? { profile, revision: document.revision } : null;
  } catch { return null; }
}

// The local CPU battle is not server-authoritative. This data must never be
// exchanged for CareMate learning points, paid currency, or ranked rewards.
export class PrototypeCloudSync {
  constructor({ adapter, getLocal, acceptRemote, onStatus }) {
    this.adapter = adapter;
    this.getLocal = getLocal;
    this.acceptRemote = acceptRemote;
    this.onStatus = onStatus;
    this.studentNumber = null;
    this.revision = 0;
    this.state = 'offline';
    this.pending = Promise.resolve();
  }

  status(state, message) {
    this.state = state;
    this.onStatus?.(state, message);
  }

  async connect(studentNumber) {
    if (!THROB_TEST_STUDENTS.includes(studentNumber)) return false;
    this.studentNumber = studentNumber;
    this.status('loading', 'クラウドの記録を確認中…');
    try {
      const raw = await this.adapter.read(studentNumber);
      const remote = raw === null ? null : parseCloudProfile(raw);
      if (raw !== null && !remote) {
        this.status('error', 'クラウド記録を読み取れません。上書きせず端末内に保存します。');
        return false;
      }
      if (!remote) {
        if (!sameProfile(this.getLocal(), createProfile())) {
          this.status('import', '端末の旧試作記録があります。本人の記録ならクラウドへ移してください。');
          return false;
        }
        const revision = await this.adapter.write(studentNumber, this.getLocal(), 0);
        this.revision = revision;
        this.status('synced', 'クラウドに保存済み');
        return true;
      }
      this.revision = remote.revision;
      const local = this.getLocal();
      if (sameProfile(local, remote.profile)) {
        this.status('synced', 'クラウドと同期済み');
        return true;
      }
      if (sameProfile(local, createProfile())) {
        if (!this.acceptRemote(remote.profile)) throw new Error('local-save-failed');
        this.status('synced', 'クラウドの記録を読み込みました');
        return true;
      }
      this.status('conflict', 'この端末とクラウドの記録が異なります。使う記録を選んでください。');
      return false;
    } catch (error) {
      this.status(error?.code === 'permission-denied' ? 'unavailable' : 'offline',
        'クラウド同期はまだ利用できません。記録はこの端末に保存します。');
      return false;
    }
  }

  save(profile) {
    if (this.state !== 'synced' || !this.studentNumber || !validProfile(profile)) return this.pending;
    this.pending = this.pending.then(async () => {
      if (this.state !== 'synced') return;
      try {
        this.revision = await this.adapter.write(this.studentNumber, profile, this.revision);
        this.status('synced', 'クラウドに保存済み');
      } catch (error) {
        this.status(error?.code === 'revision-conflict' ? 'conflict' : 'offline',
          error?.code === 'revision-conflict'
            ? '別の端末でも記録が変わりました。使う記録を選んでください。'
            : 'クラウドへ保存できません。端末内の記録は残っています。');
      }
    });
    return this.pending;
  }

  async chooseRemote() {
    if (!this.studentNumber || this.state !== 'conflict') return false;
    try {
      const remote = parseCloudProfile(await this.adapter.read(this.studentNumber));
      if (!remote) throw new Error('invalid-remote');
      if (!this.acceptRemote(remote.profile)) throw new Error('local-save-failed');
      this.revision = remote.revision;
      this.status('synced', 'クラウドの記録を使用中');
      return true;
    } catch {
      this.status('offline', 'クラウドを読み込めません。端末内の記録は残っています。');
      return false;
    }
  }

  async chooseLocal() {
    if (!this.studentNumber || !['conflict', 'import'].includes(this.state)) return false;
    try {
      const remote = await this.adapter.read(this.studentNumber);
      const parsed = remote === null ? null : parseCloudProfile(remote);
      if (remote !== null && !parsed) throw new Error('invalid-remote');
      this.revision = await this.adapter.write(this.studentNumber, this.getLocal(), parsed?.revision || 0);
      this.status('synced', 'この端末の記録をクラウドに保存しました');
      return true;
    } catch (error) {
      this.status(error?.code === 'revision-conflict' ? 'conflict' : 'offline',
        'クラウドへ保存できません。端末内の記録は残っています。');
      return false;
    }
  }
}
