import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import Jimp from 'jimp';
import { decodeQrDetailed, decodeQrFromImage } from '../services/qrDecoder.js';

// These tests decode REAL pixels: QR images generated here with a QR encoder (so the
// expected payload is known), degraded like a phone photo, plus a real packaging photo.
const dir = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-test-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function qrOnBackground({ payload, modulePx, name, blur = 0, invert = false, rotate = 0 }) {
  const qrPng = await QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', margin: 4, scale: 10, color: invert ? { dark: '#ffffff', light: '#000000' } : undefined });
  const qr = await Jimp.read(qrPng);
  const modules = qr.bitmap.width / 10;
  const size = Math.round(modules * modulePx);
  qr.resize(size, size, Jimp.RESIZE_BICUBIC);
  if (rotate) qr.rotate(rotate, true);
  const canvas = new Jimp(720, 900, 0xd9c7a5ff); // plain tan "box" background
  canvas.composite(qr, 120, 300);
  if (blur) canvas.blur(blur);
  const file = path.join(tmp, name);
  await canvas.quality(75).writeAsync(file);
  return file;
}

describe('qrDecoder: real decoding', () => {
  test('decodes a real photo of packaging (shared manufacturer QR, ~50px wide in a 720x1600 frame)', async () => {
    const r = await decodeQrDetailed(path.join(dir, 'fixtures', 'zoxfer-xt-plus-box-with-qr.jpg'));
    assert.equal(r.code, 'https://zoxvinabiotech.com/');
    assert.ok(r.attempts >= 1);
  });

  test('a normal-size QR decodes to its exact payload', async () => {
    const payload = 'https://example.test/verify?batch=ABC-123&sig=Qx9Z';
    const file = await qrOnBackground({ payload, modulePx: 6, name: 'big.jpg' });
    assert.equal(await decodeQrFromImage(file), payload);
  });

  test('a SMALL, slightly blurred QR (the failure case of the old single-pass decoder) decodes', async () => {
    const payload = 'https://example.test/small?id=42';
    const file = await qrOnBackground({ payload, modulePx: 2.6, blur: 1, name: 'small.jpg' });
    const r = await decodeQrDetailed(file);
    assert.equal(r.code, payload, `strategy=${r.strategy} attempts=${r.attempts}`);
  });

  test('a rotated QR decodes', async () => {
    const payload = 'RAW-PAYLOAD-0001';
    const file = await qrOnBackground({ payload, modulePx: 5, rotate: 12, name: 'rot.jpg' });
    assert.equal(await decodeQrFromImage(file), payload);
  });

  test('a light-on-dark (inverted) QR decodes', async () => {
    const payload = 'https://example.test/inverted';
    const file = await qrOnBackground({ payload, modulePx: 6, invert: true, name: 'inv.png' });
    assert.equal(await decodeQrFromImage(file), payload);
  });

  test('payload case is preserved exactly (no normalization in the decoder)', async () => {
    const payload = 'https://Example.test/Path?Token=aBcD';
    const file = await qrOnBackground({ payload, modulePx: 6, name: 'case.jpg' });
    assert.equal(await decodeQrFromImage(file), payload);
  });
});

describe('qrDecoder: never invents a payload', () => {
  test('a packaging photo with no QR returns null (QR_NOT_DETECTED upstream)', async () => {
    const r = await decodeQrDetailed(path.join(dir, 'fixtures', 'box-without-qr.jpg'), { timeBudgetMs: 3000 });
    assert.equal(r.code, null);
    assert.equal(r.error, null);
  });

  test('a blank image returns null', async () => {
    const file = path.join(tmp, 'blank.png');
    await new Jimp(400, 400, 0xffffffff).writeAsync(file);
    assert.equal(await decodeQrFromImage(file, { timeBudgetMs: 2000 }), null);
  });

  test('random noise returns null', async () => {
    const img = new Jimp(300, 300);
    img.scan(0, 0, 300, 300, function noise(x, y, idx) { const v = Math.random() < 0.5 ? 0 : 255; this.bitmap.data[idx] = this.bitmap.data[idx + 1] = this.bitmap.data[idx + 2] = v; this.bitmap.data[idx + 3] = 255; });
    const file = path.join(tmp, 'noise.png');
    await img.writeAsync(file);
    assert.equal(await decodeQrFromImage(file, { timeBudgetMs: 2000 }), null);
  });

  test('a corrupt file reports a read error instead of crashing or inventing a code', async () => {
    const file = path.join(tmp, 'corrupt.jpg');
    fs.writeFileSync(file, Buffer.from('this is not an image'));
    const r = await decodeQrDetailed(file);
    assert.equal(r.code, null);
    assert.match(r.error, /could not be read/i);
    await assert.rejects(decodeQrFromImage(file), /could not be read/i);
  });

  test('a missing file reports a read error', async () => {
    const r = await decodeQrDetailed(path.join(tmp, 'nope.png'));
    assert.equal(r.code, null);
    assert.ok(r.error);
  });
});

before(() => {});
