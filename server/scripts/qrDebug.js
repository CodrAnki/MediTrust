// Debug helper: shows exactly what the QR decoder sees and does for one image.
//   npm run qr:debug -- path/to/photo.jpg
import path from 'node:path';
import Jimp from 'jimp';
import { decodeQrDetailed } from '../services/qrDecoder.js';

const file = process.argv[2];
if (!file) { console.error('Usage: npm run qr:debug -- <image-file>'); process.exit(1); }
const abs = path.resolve(file);

try {
  const img = await Jimp.read(abs);
  console.log(`file:       ${abs}\nsize:       ${img.bitmap.width}x${img.bitmap.height}  (${img.getMIME()})`);
} catch (err) {
  console.error(`Image could not be read by Jimp: ${err.message}`);
  process.exit(2);
}

const tried = [];
const result = await decodeQrDetailed(abs, { onAttempt: (a) => tried.push(a) });
console.log(`attempts:   ${result.attempts} in ${result.durationMs}ms${result.timedOut ? ' (time budget reached)' : ''}`);
if (process.env.QR_DEBUG) tried.forEach((t) => console.log(`  - ${t.label}${t.error ? ` ERROR ${t.error}` : t.decoded ? ' DECODED' : ''}`));
if (result.code) console.log(`result:     DECODED via ${result.strategy}\npayload:    ${result.code}`);
else console.log('result:     QR_NOT_DETECTED (no QR could be decoded from the image pixels)');
