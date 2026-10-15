import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Match } from '../js/core/Match.js';
import { RULES } from '../js/data.js';
import { isThrobPilotIdentity } from '../js/integrations/pilotAccess.mjs';

const marker = JSON.parse(readFileSync(new URL('../assets/characters/training_dummy/character.json', import.meta.url)));

test('pilot access needs matching auth uid, token claim and profile', () => {
  const identity = {
    uid: 'caremate-2510044', tokenStudentNumber: '2510044',
    profileStudentNumber: '2510044', profileExists: true,
  };
  assert.equal(isThrobPilotIdentity(identity), true);
  assert.equal(isThrobPilotIdentity({ ...identity, uid: 'caremate-2510001' }), false);
  assert.equal(isThrobPilotIdentity({ ...identity, tokenStudentNumber: '2510001' }), false);
  assert.equal(isThrobPilotIdentity({ ...identity, profileExists: false }), false);
});

test('system-only marker jumps high enough to land on an upper platform', () => {
  assert.equal(marker.systemOnly, true);
  const match = new Match({ character: marker, difficulty: 'easy' });
  match.player.x = 400;
  match.player.y = 700;
  match.player.grounded = true;
  let apex = match.player.y;
  let landedUpper = false;
  for (let i = 0; i < 100; i++) {
    match.updateFighter(match.player, { jump: i === 0 }, 0.016);
    apex = Math.min(apex, match.player.y);
    if (match.player.grounded && match.player.y === 505) { landedUpper = true; break; }
  }
  assert.ok(apex < 505, `jump apex ${apex} should clear the upper ledge`);
  assert.equal(landedUpper, true);
});

test('system-only match still handles throws, stock loss and respawn', () => {
  const match = new Match({ character: marker });
  match.throwWeapon(match.player, false);
  assert.equal(match.projectiles.length, 1);
  match.kill(match.player, 'pit');
  assert.equal(match.player.stocks, RULES.stocks - 1);
  match.player.respawnLeft = 0.01;
  match.updateFighter(match.player, {}, 0.02);
  assert.equal(match.player.alive, true);
  assert.equal(match.player.invulnerable, RULES.invincibleSeconds);
});
