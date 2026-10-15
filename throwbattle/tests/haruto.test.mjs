import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WEAPONS, SKILLS } from '../js/data.js';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('ハルトは単一の正式デザインとして登録され、仮キャラも残る', async () => {
  const manifest = await readJson('assets/characters/manifest.json');
  assert.deepEqual(manifest.characters, ['haruto/character.json', 'training_dummy/character.json']);
  const haruto = await readJson('assets/characters/haruto/character.json');
  assert.equal(haruto.id, 'haruto');
  assert.equal(haruto.name, 'ハルト');
  assert.equal(haruto.status, 'animation-first-pass');
  assert.equal(haruto.weaponId, 'haruto_laptop');
  assert.ok(haruto.maxHp > 0 && haruto.moveSpeed > 0 && haruto.jumpPower > 0);
  assert.ok(haruto.hitbox.width > 0 && haruto.hitbox.height > 0);
  assert.deepEqual(Object.keys(haruto.sprite.animations), ['idle', 'run', 'jump', 'fall', 'attack', 'skill', 'dodge', 'hit', 'death', 'respawn', 'victory']);
  assert.equal(haruto.sprite.animations.idle.fps, 8);
  assert.equal(haruto.sprite.animations.idle.loop, true);
  assert.equal(haruto.sprite.animations.victory.loop, false, '勝利の最後の姿勢を保持し、待機姿勢へ急に戻さない');
  assert.equal(haruto.sprite.animations.idle.available, true);
  assert.ok(Object.values(haruto.sprite.animations).every((animation) => animation.available === true));
  assert.equal(haruto.sprite.animations.attack.releaseFrame, 2);
  assert.ok(Object.values(haruto.sprite.animations).every((animation) => animation.frames.every((frame) => frame.startsWith('animations/'))));
  await access(new URL('assets/characters/haruto/' + haruto.sprite.fallback, root));
});

test('11動作44コマはすべて512pxのRGBA PNGで登録されている', async () => {
  const haruto = await readJson('assets/characters/haruto/character.json');
  let count = 0;
  for (const [action, animation] of Object.entries(haruto.sprite.animations)) {
    assert.equal(animation.frames.length, 4, `${action} must have 4 distinct frames`);
    for (const [index, file] of animation.frames.entries()) {
      assert.equal(file, `animations/${action}_0${index + 1}.png`);
      const data = await readFile(new URL(`assets/characters/haruto/${file}`, root));
      assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert.equal(data.readUInt32BE(16), 512);
      assert.equal(data.readUInt32BE(20), 512);
      assert.equal(data[25], 6);
      count++;
    }
  }
  assert.equal(count, 44);
});

test('ハルトのノートパソコンは独立した透明画像で、スキルは時間制', async () => {
  const weapon = WEAPONS.haruto_laptop;
  assert.ok(weapon.damage > 0 && weapon.speed > 0);
  const data = await readFile(new URL(weapon.image, root));
  assert.equal(data.readUInt32BE(16), 256);
  assert.equal(data.readUInt32BE(20), 256);
  assert.equal(data[25], 6);
  assert.ok(SKILLS.power_throw.duration > 0);
});

test('待機4コマは独立した512px透過PNGとして揃っている', async () => {
  const haruto = await readJson('assets/characters/haruto/character.json');
  assert.equal(haruto.sprite.origin.y, 488 / 512);
  assert.equal(haruto.sprite.preview, 'animations/idle_01.png');
  assert.equal(haruto.sprite.fallback, 'animations/idle_01.png');
  for (const [index, file] of haruto.sprite.animations.idle.frames.entries()) {
    assert.equal(file, `animations/idle_0${index + 1}.png`);
    const data = await readFile(new URL(`assets/characters/haruto/${file}`, root));
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(data.readUInt32BE(16), 512);
    assert.equal(data.readUInt32BE(20), 512);
    assert.equal(data[25], 6); // RGBA PNG: per-pixel alpha, not a flattened black background.
  }
});

test('正式設計図は元画像と同じバイナリで保管されている', async () => {
  const image = await readFile(new URL('docs/reference/haruto_design.png', root));
  assert.equal(createHash('sha256').update(image).digest('hex'), '6a06e43f9c9c93933d1e7280ddbd924d8b3e2d496376c530b47c91b32ffcf9fa');
});

test('待機原画も変更せずに資料として保存されている', async () => {
  const image = await readFile(new URL('docs/reference/haruto_idle_source.png', root));
  assert.equal(createHash('sha256').update(image).digest('hex'), 'c55f049d1eabe25d7bacc2733b955095e07618bd2143076fb61db91b610e7cf7');
});
