import { spawnSync } from 'node:child_process';

const source = process.argv[2];
if (!source) throw new Error('Usage: node tools/inspect_idle_alpha.mjs <source.png>');
const dimensions = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', source], { encoding: 'utf8' });
if (dimensions.status !== 0) throw new Error(dimensions.stderr);
const [width, height] = dimensions.stdout.trim().split(',').map(Number);
const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', source, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: width * height * 4 + 1024 });
if (decode.status !== 0) throw new Error(decode.stderr.toString());
const pixels = decode.stdout;
const panelWidth = width / 4;
if (!Number.isInteger(panelWidth)) throw new Error('Four equal panels expected');

function components(frame, threshold) {
  const seen = new Uint8Array(panelWidth * height);
  const parts = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < panelWidth; x++) {
    const i = y * panelWidth + x;
    if (seen[i] || pixels[(y * width + frame * panelWidth + x) * 4 + 3] < threshold) continue;
    const stack = [i]; seen[i] = 1;
    const box = { count: 0, minX: x, maxX: x, minY: y, maxY: y };
    while (stack.length) {
      const current = stack.pop();
      const cx = current % panelWidth; const cy = Math.floor(current / panelWidth);
      box.count++; box.minX = Math.min(box.minX, cx); box.maxX = Math.max(box.maxX, cx);
      box.minY = Math.min(box.minY, cy); box.maxY = Math.max(box.maxY, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx; const ny = cy + dy;
        if (nx < 0 || nx >= panelWidth || ny < 0 || ny >= height) continue;
        const ni = ny * panelWidth + nx;
        if (seen[ni] || pixels[(ny * width + frame * panelWidth + nx) * 4 + 3] < threshold) continue;
        seen[ni] = 1; stack.push(ni);
      }
    }
    parts.push(box);
  }
  return parts.sort((a, b) => b.count - a.count).slice(0, 5);
}

for (let frame = 0; frame < 4; frame++) {
  for (const threshold of [16, 32, 64, 128, 224]) {
    console.log(JSON.stringify({ frame: frame + 1, threshold, largest: components(frame, threshold) }));
  }
}
