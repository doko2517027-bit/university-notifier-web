// Extract four separate RGBA figures from a generated animation strip.
// Unlike fixed-width cropping this follows connected silhouettes, including
// hands or shoes crossing a nominal quarter boundary.
// Usage: node tools/extract_animation_strip.mjs <source.png> <output-dir> <action>
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [source, outputDirectory, action] = process.argv.slice(2);
if (!source || !outputDirectory || !/^[a-z]+$/.test(action || '')) throw new Error('Usage: node tools/extract_animation_strip.mjs <source.png> <output-dir> <action>');
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', source], { encoding: 'utf8' });
if (probe.status !== 0) throw new Error(probe.stderr);
const [width, height] = probe.stdout.trim().split(',').map(Number);
const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', source, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: width * height * 4 + 1024 });
if (decode.status !== 0) throw new Error(decode.stderr.toString());
const pixels = decode.stdout;
const count = width * height;
const visited = new Uint8Array(count);
const parts = [];
for (let i = 0; i < count; i++) {
  if (visited[i] || pixels[i * 4 + 3] < 128) continue;
  const stack = [i]; const indices = []; visited[i] = 1;
  const box = { minX: width, minY: height, maxX: -1, maxY: -1 };
  while (stack.length) {
    const current = stack.pop(); indices.push(current);
    const x = current % width; const y = Math.floor(current / width);
    box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const next = ny * width + nx;
      if (visited[next] || pixels[next * 4 + 3] < 128) continue;
      visited[next] = 1; stack.push(next);
    }
  }
  if (indices.length >= 50000) parts.push({ indices, box });
}
if (parts.length !== 4) throw new Error(`Expected 4 distinct figures, found ${parts.length}. Do not use a sheet with touching/fragmented characters.`);
parts.sort((a, b) => a.box.minX - b.box.minX);
const maxSourceHeight = Math.max(...parts.map(({ box }) => box.maxY - box.minY + 1));
const scale = 440 / maxSourceHeight;
mkdirSync(outputDirectory, { recursive: true });
for (let frame = 0; frame < parts.length; frame++) {
  const { indices, box } = parts[frame];
  if (box.minX <= 1 || box.maxX >= width - 2 || box.minY <= 1 || box.maxY >= height - 2) throw new Error(`${action} ${frame + 1}: source figure touches image boundary`);
  const keep = new Uint8Array(count);
  for (const i of indices) {
    const x = i % width; const y = Math.floor(i / width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) keep[ny * width + nx] = 1;
    }
  }
  const minX = Math.max(0, box.minX - 2); const maxX = Math.min(width - 1, box.maxX + 2);
  const minY = Math.max(0, box.minY - 2); const maxY = Math.min(height - 1, box.maxY + 2);
  const outputWidth = Math.round((maxX - minX + 1) * scale);
  const outputHeight = Math.round((maxY - minY + 1) * scale);
  if (outputWidth > 480 || outputHeight > 480) throw new Error(`${action} ${frame + 1}: figure does not fit 512px canvas`);
  const left = Math.round((512 - outputWidth) / 2); const top = 488 - outputHeight;
  const output = Buffer.alloc(512 * 512 * 4);
  for (let v = 0; v < outputHeight; v++) for (let u = 0; u < outputWidth; u++) {
    const sx0 = minX + u / scale; const sx1 = minX + (u + 1) / scale;
    const sy0 = minY + v / scale; const sy1 = minY + (v + 1) / scale;
    let weightSum = 0; let alphaSum = 0; let r = 0; let g = 0; let b = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const weight = Math.max(0, Math.min(sx + 1, sx1) - Math.max(sx, sx0)) * Math.max(0, Math.min(sy + 1, sy1) - Math.max(sy, sy0));
      weightSum += weight;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      const offset = (sy * width + sx) * 4;
      if (!keep[sy * width + sx]) continue;
      const weightedAlpha = pixels[offset + 3] * weight;
      alphaSum += weightedAlpha;
      r += pixels[offset] * weightedAlpha; g += pixels[offset + 1] * weightedAlpha; b += pixels[offset + 2] * weightedAlpha;
    }
    const target = ((top + v) * 512 + left + u) * 4;
    output[target + 3] = Math.round(alphaSum / weightSum);
    if (alphaSum) {
      output[target] = Math.round(r / alphaSum);
      output[target + 1] = Math.round(g / alphaSum);
      output[target + 2] = Math.round(b / alphaSum);
    }
  }
  const destination = join(outputDirectory, `${action}_${String(frame + 1).padStart(2, '0')}.png`);
  const encode = spawnSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '512x512', '-i', 'pipe:0', '-frames:v', '1', '-y', destination], { input: output, maxBuffer: 1024 * 1024 });
  if (encode.status !== 0) throw new Error(encode.stderr.toString());
  console.log(JSON.stringify({ action, frame: frame + 1, box, opaquePixels: indices.length, outputBox: { x: left, y: top, width: outputWidth, height: outputHeight }, destination }));
}
