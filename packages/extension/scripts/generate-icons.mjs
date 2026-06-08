import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');
const outDirs = [
  path.join(packageRoot, 'icons'),
  path.join(packageRoot, 'public', 'icons'),
];
const teal = { r: 0, g: 201, b: 177, a: 255 };

for (const outDir of outDirs) {
  fs.mkdirSync(outDir, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (size * y + x) << 2;
      png.data[idx] = teal.r;
      png.data[idx + 1] = teal.g;
      png.data[idx + 2] = teal.b;
      png.data[idx + 3] = teal.a;
    }
  }
  const bytes = PNG.sync.write(png);
  for (const outDir of outDirs) {
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), bytes);
  }
}

console.log('Generated extension icons in icons/ and public/icons/');
