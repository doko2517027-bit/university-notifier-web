// Pixel-preserving extraction of the supplied RGBA reference strip. No generative redraw.
// Usage: node tools/prepare_haruto_idle.mjs <source.png> <output-directory> [animation-id]
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [source, outputDirectory, animationId = 'idle'] = process.argv.slice(2);
if (!source || !outputDirectory || !/^[a-z]+$/.test(animationId)) throw new Error('Usage: node tools/prepare_haruto_idle.mjs <source.png> <output-directory> [animation-id]');
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', source], { encoding: 'utf8' });
if (probe.status !== 0) throw new Error(probe.stderr);
const [sourceWidth, sourceHeight] = probe.stdout.trim().split(',').map(Number);
if (sourceWidth !== 2172 || sourceHeight !== 724) throw new Error(`Unexpected source size ${sourceWidth}x${sourceHeight}; inspect panel boundaries first`);
const panelWidth = sourceWidth / 4;
const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', source, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: sourceWidth * sourceHeight * 4 + 1024 });
if (decode.status !== 0) throw new Error(decode.stderr.toString());
const sourcePixels = decode.stdout;

function makeMask(frame) {
  const count = panelWidth * sourceHeight;
  const alpha = new Uint8Array(count);
  const visited = new Uint8Array(count);
  for (let y = 0; y < sourceHeight; y++) for (let x = 0; x < panelWidth; x++) {
    alpha[y * panelWidth + x] = sourcePixels[(y * sourceWidth + frame * panelWidth + x) * 4 + 3];
  }
  let largest = [];
  for (let i = 0; i < count; i++) {
    if (visited[i] || alpha[i] < 128) continue;
    const pixels = []; const stack = [i]; visited[i] = 1;
    while (stack.length) {
      const current = stack.pop(); pixels.push(current);
      const x = current % panelWidth; const y = Math.floor(current / panelWidth);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= panelWidth || ny < 0 || ny >= sourceHeight) continue;
        const next = ny * panelWidth + nx;
        if (visited[next] || alpha[next] < 128) continue;
        visited[next] = 1; stack.push(next);
      }
    }
    if (pixels.length > largest.length) largest = pixels;
  }
  if (largest.length < 75000) throw new Error(`Frame ${frame + 1}: main character silhouette not found`);
  // Retain alpha-antialiased contour pixels within two source pixels of the
  // opaque silhouette, but discard scattered red speckles and ground shadow.
  const keep = new Uint8Array(count);
  for (const i of largest) {
    const x = i % panelWidth; const y = Math.floor(i / panelWidth);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < panelWidth && ny >= 0 && ny < sourceHeight) keep[ny * panelWidth + nx] = 1;
    }
  }
  const clean = Buffer.alloc(count * 4);
  const box = { minX: panelWidth, minY: sourceHeight, maxX: -1, maxY: -1 };
  for (let i = 0; i < count; i++) {
    if (!keep[i] || !alpha[i]) continue;
    const x = i % panelWidth; const y = Math.floor(i / panelWidth);
    const original = (y * sourceWidth + frame * panelWidth + x) * 4;
    sourcePixels.copy(clean, i * 4, original, original + 4);
    if (alpha[i] >= 8) {
      box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
    }
  }
  return { clean, box, retainedOpaque: largest.length };
}

// Area resampling in premultiplied alpha avoids dark/white halos at the edges.
function renderFrame(frame, scale) {
  const { clean, box } = frame;
  const sourceW = box.maxX - box.minX + 1; const sourceH = box.maxY - box.minY + 1;
  const destW = Math.round(sourceW * scale); const destH = Math.round(sourceH * scale);
  const left = Math.round((512 - destW) / 2); const top = 488 - destH;
  const result = Buffer.alloc(512 * 512 * 4);
  for (let v = 0; v < destH; v++) for (let u = 0; u < destW; u++) {
    const sx0 = box.minX + u / scale; const sx1 = box.minX + (u + 1) / scale;
    const sy0 = box.minY + v / scale; const sy1 = box.minY + (v + 1) / scale;
    let weightSum = 0; let alphaSum = 0; let r = 0; let g = 0; let b = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const overlapX = Math.max(0, Math.min(sx + 1, sx1) - Math.max(sx, sx0));
      const overlapY = Math.max(0, Math.min(sy + 1, sy1) - Math.max(sy, sy0));
      const weight = overlapX * overlapY;
      weightSum += weight;
      if (sx < 0 || sx >= panelWidth || sy < 0 || sy >= sourceHeight) continue;
      const offset = (sy * panelWidth + sx) * 4;
      const weightedAlpha = clean[offset + 3] * weight;
      alphaSum += weightedAlpha;
      r += clean[offset] * weightedAlpha;
      g += clean[offset + 1] * weightedAlpha;
      b += clean[offset + 2] * weightedAlpha;
    }
    const target = ((top + v) * 512 + left + u) * 4;
    result[target + 3] = Math.round(alphaSum / weightSum);
    if (alphaSum > 0) {
      result[target] = Math.round(r / alphaSum);
      result[target + 1] = Math.round(g / alphaSum);
      result[target + 2] = Math.round(b / alphaSum);
    }
  }
  return { pixels: result, box, destW, destH, left, top };
}

const frames = Array.from({ length: 4 }, (_, index) => makeMask(index));
const maximumHeight = Math.max(...frames.map(({ box }) => box.maxY - box.minY + 1));
const scale = 440 / maximumHeight;
mkdirSync(outputDirectory, { recursive: true });
for (let index = 0; index < frames.length; index++) {
  const rendered = renderFrame(frames[index], scale);
  const output = join(outputDirectory, `${animationId}_0${index + 1}.png`);
  const encode = spawnSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '512x512', '-i', 'pipe:0', '-frames:v', '1', '-y', output], { input: rendered.pixels, maxBuffer: 1024 * 1024 });
  if (encode.status !== 0) throw new Error(encode.stderr.toString());
  console.log(JSON.stringify({ frame: index + 1, sourceBox: rendered.box, outputBox: { x: rendered.left, y: rendered.top, width: rendered.destW, height: rendered.destH }, opaquePixels: frames[index].retainedOpaque, output }));
}
