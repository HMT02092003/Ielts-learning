// npm run icons — render frontend/src/app/icon.svg (the BandUp logo) to the app icons:
//   frontend/public/icons/icon-192.png, icon-512.png (web manifest) and BandUp.ico (desktop shortcut).
// Uses @napi-rs/canvas from backend/node_modules. The outputs are committed; re-run after changing the logo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BACKEND, FRONTEND, ROOT } from './lib.mjs';

const { createCanvas, loadImage } = createRequire(path.join(BACKEND, 'package.json'))('@napi-rs/canvas');

const svg = readFileSync(path.join(FRONTEND, 'src', 'app', 'icon.svg'));
const logo = await loadImage(svg);

function png(size) {
  const canvas = createCanvas(size, size);
  canvas.getContext('2d').drawImage(logo, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}

/** ICO with PNG-compressed images (supported since Windows Vista). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); // 0 = 256
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2); // palette
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const iconsDir = path.join(FRONTEND, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });
for (const size of [192, 512]) writeFileSync(path.join(iconsDir, `icon-${size}.png`), png(size));
writeFileSync(
  path.join(ROOT, 'BandUp.ico'),
  ico([16, 24, 32, 48, 64, 256].map((size) => ({ size, data: png(size) }))),
);
console.log('Đã tạo frontend/public/icons/icon-192.png, icon-512.png và BandUp.ico');
