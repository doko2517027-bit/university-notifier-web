import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile } from './profile.js';
import { PrototypeCloudSync, parseCloudProfile, verifiedCareMateStudent } from './cloudSync.js';

const student = '2510044';
const documentFor = (profile, revision = 1) => ({ version: 1, revision, profileJson: JSON.stringify(profile) });

function fakeAdapter(initial = null) {
  let record = initial;
  return {
    async read() { return record; },
    async write(id, profile, expectedRevision) {
      assert.equal(id, student);
      const current = record?.revision || 0;
      if (current !== expectedRevision) {
        const error = new Error('revision-conflict'); error.code = 'revision-conflict'; throw error;
      }
      record = documentFor(profile, current + 1);
      return record.revision;
    },
    externalWrite(profile) { record = documentFor(profile, (record?.revision || 0) + 1); },
    record() { return record; },
  };
}

test('pilot identity needs Firebase UID, claim and profile document to agree', () => {
  const identity = { user: { uid: 'caremate-2510044' }, claims: { studentNumber: student },
    studentNumber: student, profileStudentNumber: student };
  assert.equal(verifiedCareMateStudent(identity), student);
  assert.equal(verifiedCareMateStudent({ ...identity, claims: { studentNumber: '2510054' } }), null);
  assert.equal(verifiedCareMateStudent({ ...identity, studentNumber: '2510054' }), null);
  assert.equal(verifiedCareMateStudent({ ...identity, profileStudentNumber: '2510054' }), null);
});

test('cloud payload is rejected when revision or profile shape is invalid', () => {
  assert.equal(parseCloudProfile(documentFor(createProfile(), 1))?.revision, 1);
  assert.equal(parseCloudProfile(documentFor({}, 1)), null);
  assert.equal(parseCloudProfile(documentFor(createProfile(), 0)), null);
});

test('first connection creates a blank profile and saves later changes', async () => {
  const local = createProfile();
  const adapter = fakeAdapter();
  const sync = new PrototypeCloudSync({ adapter, getLocal: () => local, acceptRemote: () => true });
  assert.equal(await sync.connect(student), true);
  assert.equal(sync.state, 'synced');
  assert.equal(adapter.record().revision, 1);
  assert.equal(JSON.parse(adapter.record().profileJson).character.xp, 0);
  local.character.xp = 55;
  await sync.save(local);
  assert.equal(adapter.record().revision, 2);
});

test('old standalone progress is not uploaded without the owner choosing it', async () => {
  const local = createProfile(); local.character.xp = 15;
  const adapter = fakeAdapter();
  const sync = new PrototypeCloudSync({ adapter, getLocal: () => local, acceptRemote: () => true });
  assert.equal(await sync.connect(student), false);
  assert.equal(sync.state, 'import');
  assert.equal(adapter.record(), null);
  assert.equal(await sync.chooseLocal(), true);
  assert.equal(JSON.parse(adapter.record().profileJson).character.xp, 15);
});

test('remote record loads automatically only into a fresh local profile', async () => {
  const remote = createProfile(); remote.character.xp = 40;
  const adapter = fakeAdapter(documentFor(remote));
  let local = createProfile();
  const sync = new PrototypeCloudSync({ adapter, getLocal: () => local, acceptRemote: (value) => { local = value; return true; } });
  assert.equal(await sync.connect(student), true);
  assert.equal(local.character.xp, 40);
  assert.equal(adapter.record().revision, 1);
});

test('different local and remote records require an explicit choice', async () => {
  const remote = createProfile(); remote.character.xp = 40;
  const adapter = fakeAdapter(documentFor(remote));
  let local = createProfile(); local.character.xp = 15;
  const sync = new PrototypeCloudSync({ adapter, getLocal: () => local, acceptRemote: (value) => { local = value; return true; } });
  assert.equal(await sync.connect(student), false);
  assert.equal(sync.state, 'conflict');
  assert.equal(local.character.xp, 15);
  assert.equal(adapter.record().revision, 1);
  assert.equal(await sync.chooseLocal(), true);
  assert.equal(adapter.record().revision, 2);
  assert.equal(JSON.parse(adapter.record().profileJson).character.xp, 15);
});

test('concurrent cloud update pauses sync rather than silently overwriting', async () => {
  let local = createProfile();
  const adapter = fakeAdapter();
  const sync = new PrototypeCloudSync({ adapter, getLocal: () => local, acceptRemote: () => true });
  await sync.connect(student);
  const other = createProfile(); other.character.xp = 40;
  adapter.externalWrite(other);
  local.character.xp = 15;
  await sync.save(local);
  assert.equal(sync.state, 'conflict');
  assert.equal(JSON.parse(adapter.record().profileJson).character.xp, 40);
});

test('invalid remote data is never replaced automatically', async () => {
  const adapter = fakeAdapter(documentFor({}, 1));
  const sync = new PrototypeCloudSync({ adapter, getLocal: createProfile, acceptRemote: () => true });
  assert.equal(await sync.connect(student), false);
  assert.equal(sync.state, 'error');
  assert.equal(adapter.record().revision, 1);
});
