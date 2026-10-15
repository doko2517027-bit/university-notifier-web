// Read-only sprite audit. Run from throwbattle: node tools/audit_haruto_frames.mjs
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const character = JSON.parse(readFileSync('assets/characters/haruto/character.json', 'utf8'));
const size = 512;
let bad = 0;
for (const [action, animation] of Object.entries(character.sprite.animations)) {
  for (const file of animation.frames) {
    const path = join('assets/characters/haruto', file);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: size * size * 4 + 1024 });
    if (decoded.status !== 0 || decoded.stdout.length !== size * size * 4) throw new Error(`${file}: RGBA 512x512 decode failed`);
    const bytes = decoded.stdout;
    let minX = size; let minY = size; let maxX = -1; let maxY = -1; let solid = 0; let faint = 0; let edge = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const alpha = bytes[(y * size + x) * 4 + 3];
      if (!alpha) continue;
      if (alpha >= 128) { solid++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      else faint++;
      if (x < 12 || x >= 500 || y < 12 || y >= 500) edge++;
    }
    const footError = Math.abs(maxY - 488);
    const flags = [edge ? 'EDGE' : '', footError > 8 ? 'FOOT' : '', solid < 12000 ? 'SPARSE' : ''].filter(Boolean);
    if (flags.length) bad++;
    console.log(`${file.padEnd(29)} box=${String(minX).padStart(3)}:${String(minY).padStart(3)}-${String(maxX).padStart(3)}:${String(maxY).padStart(3)} solid=${solid} faint=${faint} edge=${edge} ${flags.join(',')}`);
  }
}
console.log(`Flagged frames: ${bad}`);
