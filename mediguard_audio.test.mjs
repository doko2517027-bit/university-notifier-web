import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { AUDIO_SLOTS, DEFAULT_AUDIO } from './mediguard_audio_slots.mjs';

test('画面と操作の33種類を個別に設定でき、標準音声が実在する',async()=>{
  assert.equal(AUDIO_SLOTS.length,33);
  assert.equal(new Set(AUDIO_SLOTS.map(x=>x.id)).size,33);
  for(const slot of Object.values(DEFAULT_AUDIO))if(!slot.url.startsWith('https:'))await access(new URL(slot.url,import.meta.url));
});
test('音声ファイルを再生し、ゲーム内で電子音を合成しない',async()=>{
  const source=await readFile(new URL('./mediguard_audio.js',import.meta.url),'utf8');
  assert.match(source,/new Audio\(slot.url\)/);
  assert.doesNotMatch(source,/createOscillator|AudioContext/);
  assert.match(source,/document.hidden/);
  assert.match(source,/activeEffects.size>14/);
});
test('管理画面にアップロード・試聴・音量・保存の操作がある',async()=>{
  const source=await readFile(new URL('./mediguard_admin.js',import.meta.url),'utf8');
  assert.match(source,/audio controls/);
  assert.match(source,/25\*1024\*1024/);
  assert.match(source,/saveAudio/);
  assert.match(source,/caremate\/mediguard\/audio/);
});
