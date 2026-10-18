import jsQR from 'jsqr';
import Jimp from 'jimp';

// ---------------------------------------------------------------------------
// Real QR decoding: jsQR against real image pixels (file read through Jimp).
//
// WHY THIS EXISTS (root cause of "QR is not detected"):
// The previous decoder made ONE jsQR pass over the image at its native
// resolution (rescaling only when the long edge was <300px or >1600px). Real
// medicine-box photos in this project are phone screenshots (720x1600) in which
// the printed QR is only ~50px wide, i.e. ~2px per module. At that module size
// jsQR's own binarization / finder-pattern search fails, so a genuine, readable
// QR was reported as "not detected". Measured on the project's own photos: the
// same file decodes after unsharp-masking, and (non-monotonically) at 2x upscale,
// but NOT as-is — so a single fixed pass is not enough.
//
// This decoder searches in stages (cheapest / most likely first) and stops at the
// first genuine decode:
//   A. the whole image at a few scales x a few preprocessors
//   B. overlapping TILES cut from the ORIGINAL pixels and scaled up (also removes
//      clutter that confuses the finder-pattern search over a busy photo);
//      flat tiles (no contrast => cannot contain a QR) are skipped for speed
// Preprocessors: grayscale, percentile contrast stretch, unsharp sharpen, Otsu
// binarization. Inverted (light-on-dark) codes are handled by jsQR itself via
// `inversionAttempts: 'attemptBoth'`.
//
// All pixel work is done on plain typed arrays (Jimp's per-pixel helpers were
// ~10x slower and made "no QR in this photo" cost >10s).
//
// What it NEVER does: invent a payload. It returns exactly what jsQR decoded
// from real pixels, or null.
// ---------------------------------------------------------------------------

const MAX_WORKING_EDGE = 1600; // whole-image passes on huge camera photos use a reduced copy
const MAX_SCALED_PIXELS = 6_000_000; // never build a whole-image bitmap larger than this
const TILE_TARGET_EDGE = 900; // tiles are resampled so their long edge ~= this
const MIN_TILE_STDDEV = 22; // below this a tile has no real black/white structure
const DEFAULT_TIME_BUDGET_MS = Number(process.env.QR_DECODE_BUDGET_MS) || 4500;

const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

// --- grayscale image helpers -------------------------------------------------
// A "grey" is { w, h, d } with d a Uint8ClampedArray(w*h).

function bitmapToGrey({ data, width, height }) {
  const d = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < d.length; i += 4, p += 1) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const a = data[i + 3];
    // Composite transparent pixels onto white (what a viewer would see).
    d[p] = a === 255 ? luma : (luma * a + 255 * (255 - a)) / 255;
  }
  return { w: width, h: height, d };
}

function greyToRgba({ w, h, d }) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0, i = 0; p < d.length; p += 1, i += 4) {
    out[i] = d[p]; out[i + 1] = d[p]; out[i + 2] = d[p]; out[i + 3] = 255;
  }
  return out;
}

function cropGrey(g, x, y, w, h) {
  const d = new Uint8ClampedArray(w * h);
  for (let row = 0; row < h; row += 1) {
    const start = (y + row) * g.w + x;
    d.set(g.d.subarray(start, start + w), row * w);
  }
  return { w, h, d };
}

// Area-average when shrinking, bilinear when enlarging.
function resizeGrey(g, dw, dh) {
  if (dw === g.w && dh === g.h) return g;
  const out = new Uint8ClampedArray(dw * dh);
  const xr = g.w / dw; const yr = g.h / dh;
  if (xr > 1 || yr > 1) {
    for (let y = 0; y < dh; y += 1) {
      const y0 = Math.floor(y * yr); const y1 = Math.max(y0 + 1, Math.min(g.h, Math.ceil((y + 1) * yr)));
      for (let x = 0; x < dw; x += 1) {
        const x0 = Math.floor(x * xr); const x1 = Math.max(x0 + 1, Math.min(g.w, Math.ceil((x + 1) * xr)));
        let sum = 0;
        for (let yy = y0; yy < y1; yy += 1) { const base = yy * g.w; for (let xx = x0; xx < x1; xx += 1) sum += g.d[base + xx]; }
        out[y * dw + x] = sum / ((y1 - y0) * (x1 - x0));
      }
    }
  } else {
    for (let y = 0; y < dh; y += 1) {
      const sy = Math.min(g.h - 1, Math.max(0, (y + 0.5) * yr - 0.5));
      const y0 = Math.floor(sy); const y1 = Math.min(g.h - 1, y0 + 1); const fy = sy - y0;
      for (let x = 0; x < dw; x += 1) {
        const sx = Math.min(g.w - 1, Math.max(0, (x + 0.5) * xr - 0.5));
        const x0 = Math.floor(sx); const x1 = Math.min(g.w - 1, x0 + 1); const fx = sx - x0;
        const top = g.d[y0 * g.w + x0] * (1 - fx) + g.d[y0 * g.w + x1] * fx;
        const bot = g.d[y1 * g.w + x0] * (1 - fx) + g.d[y1 * g.w + x1] * fx;
        out[y * dw + x] = top * (1 - fy) + bot * fy;
      }
    }
  }
  return { w: dw, h: dh, d: out };
}

function stdDev(g, step = 3) {
  let sum = 0; let sumSq = 0; let n = 0;
  for (let i = 0; i < g.d.length; i += step) { const v = g.d[i]; sum += v; sumSq += v * v; n += 1; }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

// Linear stretch between the 1st and 99th percentile.
function normalizeGrey(g) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.d.length; i += 1) hist[g.d[i]] += 1;
  const lowCut = g.d.length * 0.01; const highCut = g.d.length * 0.99;
  let acc = 0; let lo = 0; let hi = 255;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= lowCut) { lo = v; break; } }
  acc = 0;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= highCut) { hi = v; break; } }
  if (hi - lo < 8) return g;
  const out = new Uint8ClampedArray(g.d.length);
  const scale = 255 / (hi - lo);
  for (let i = 0; i < out.length; i += 1) out[i] = (g.d[i] - lo) * scale;
  return { w: g.w, h: g.h, d: out };
}

// 3x3 unsharp kernel [0,-1,0; -1,5,-1; 0,-1,0] with clamped borders.
function sharpenGrey(g) {
  const { w, h, d } = g;
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y += 1) {
    const ym = Math.max(0, y - 1) * w; const yc = y * w; const yp = Math.min(h - 1, y + 1) * w;
    for (let x = 0; x < w; x += 1) {
      const xm = Math.max(0, x - 1); const xp = Math.min(w - 1, x + 1);
      out[yc + x] = 5 * d[yc + x] - d[ym + x] - d[yp + x] - d[yc + xm] - d[yc + xp];
    }
  }
  return { w, h, d: out };
}

function otsuBinarize(g) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.d.length; i += 1) hist[g.d[i]] += 1;
  const total = g.d.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * hist[t];
  let sumB = 0; let wB = 0; let best = -1; let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB; const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  const out = new Uint8ClampedArray(g.d.length);
  for (let i = 0; i < out.length; i += 1) out[i] = g.d[i] > threshold ? 255 : 0;
  return { w: g.w, h: g.h, d: out };
}

const PREPROCESSORS = {
  grey: (g) => g,
  normalized: normalizeGrey,
  sharpen: (g) => sharpenGrey(g),
  sharpenNormalized: (g) => sharpenGrey(normalizeGrey(g)),
  otsu: (g) => otsuBinarize(normalizeGrey(g)),
};

function runJsQr(g) {
  if (!g.w || !g.h || g.d.length !== g.w * g.h) return null;
  const result = jsQR(greyToRgba(g), g.w, g.h, { inversionAttempts: 'attemptBoth' });
  return result && typeof result.data === 'string' && result.data.length ? result.data : null;
}

// --- candidate generation (lazy; most useful / cheapest first) -----------------

function* wholeImageCandidates() {
  // Scale is relative to the (capped) working image.
  const plan = [
    // Chosen from the benchmark: every one of these won at least once; passes that
    // never won (percentile-stretch alone, 3x) were dropped because 3x is the most
    // expensive pass and only slowed down photos that contain no QR at all.
    [1, ['grey', 'sharpen', 'otsu']],
    [2, ['grey', 'sharpen', 'otsu']],
    [1.5, ['sharpen']],
  ];
  for (const [scale, preps] of plan) for (const prep of preps) yield { label: `whole@${scale}x/${prep}`, scale, prep, region: null };
}

function* tileCandidates(width, height) {
  // One grid only: half-short-edge tiles with 50% overlap, sharpened. Measured on
  // a synthetic benchmark (see tests/qrDecoder.test.js), this grid recovered the
  // smallest QRs that whole-image passes miss; a finer second grid added cost
  // on every no-QR photo without recovering anything extra.
  const short = Math.min(width, height);
  const size = Math.max(160, Math.round(short * 0.5));
  const stride = Math.max(1, Math.round(size / 2));
  const xs = new Set(); const ys = new Set();
  for (let x = 0; x < width - size + stride; x += stride) xs.add(Math.min(x, Math.max(0, width - size)));
  for (let y = 0; y < height - size + stride; y += stride) ys.add(Math.min(y, Math.max(0, height - size)));
  for (const y of ys) {
    for (const x of xs) {
      const w = Math.min(size, width - x); const h = Math.min(size, height - y);
      yield { label: `tile(${x},${y},${w}x${h})/sharpen`, prep: 'sharpen', region: { x, y, w, h } };
    }
  }
}

/**
 * Decodes a QR code from an image file on disk. Returns a diagnostic object;
 * `code` is the exact jsQR payload, or null when nothing could be decoded.
 *
 * @param {string} imagePath absolute path to the image file
 * @param {{ timeBudgetMs?: number, onAttempt?: (info: object) => void }} [options]
 * @returns {Promise<{code: string|null, strategy: string|null, attempts: number, width: number|null, height: number|null, durationMs: number, timedOut: boolean, error: string|null}>}
 */
export async function decodeQrDetailed(imagePath, { timeBudgetMs = DEFAULT_TIME_BUDGET_MS, onAttempt } = {}) {
  const started = Date.now();
  const out = { code: null, strategy: null, attempts: 0, width: null, height: null, durationMs: 0, timedOut: false, error: null };
  const finish = () => { out.durationMs = Date.now() - started; return out; };

  let original;
  try {
    const image = await Jimp.read(imagePath); // Jimp applies EXIF orientation on read
    original = bitmapToGrey(image.bitmap);
  } catch (err) {
    out.error = `Image could not be read: ${err.message}`;
    return finish();
  }

  out.width = original.w; out.height = original.h;
  if (original.w < 20 || original.h < 20) {
    out.error = `Image dimensions are not valid for QR decoding (${original.w}x${original.h}).`;
    return finish();
  }

  // Whole-image passes use a reduced copy of very large photos; tiles use the original.
  const longEdge = Math.max(original.w, original.h);
  const working = longEdge > MAX_WORKING_EDGE
    ? resizeGrey(original, Math.round(original.w * MAX_WORKING_EDGE / longEdge), Math.round(original.h * MAX_WORKING_EDGE / longEdge))
    : original;
  const scaledCache = new Map();

  const attempt = (candidate, grey) => {
    out.attempts += 1;
    let code = null;
    try {
      code = runJsQr(PREPROCESSORS[candidate.prep](grey));
    } catch (err) {
      // One bad variant must not abort the others.
      if (onAttempt) onAttempt({ label: candidate.label, error: err.message });
      return null;
    }
    if (onAttempt) onAttempt({ label: candidate.label, decoded: Boolean(code) });
    return code;
  };

  // ---- Stage A: whole image ---------------------------------------------------
  for (const candidate of wholeImageCandidates()) {
    if (Date.now() - started > timeBudgetMs) { out.timedOut = true; return finish(); }
    const w = Math.round(working.w * candidate.scale); const h = Math.round(working.h * candidate.scale);
    if (w * h > MAX_SCALED_PIXELS) continue;
    if (!scaledCache.has(candidate.scale)) { scaledCache.clear(); scaledCache.set(candidate.scale, resizeGrey(working, w, h)); }
    const code = attempt(candidate, scaledCache.get(candidate.scale));
    if (code) { out.code = code; out.strategy = candidate.label; return finish(); }
    await yieldToEventLoop();
  }
  scaledCache.clear();

  // ---- Stage B: tiles from the original pixels -----------------------------------
  for (const candidate of tileCandidates(original.w, original.h)) {
    if (Date.now() - started > timeBudgetMs) { out.timedOut = true; return finish(); }
    const { x, y, w, h } = candidate.region;
    let tile = cropGrey(original, x, y, w, h);
    if (stdDev(tile) < MIN_TILE_STDDEV) continue; // flat region: cannot contain a QR
    const factor = TILE_TARGET_EDGE / Math.max(w, h);
    if (Math.abs(factor - 1) > 0.05) tile = resizeGrey(tile, Math.round(w * factor), Math.round(h * factor));
    const code = attempt(candidate, tile);
    if (code) { out.code = code; out.strategy = candidate.label; return finish(); }
    if (out.attempts % 3 === 0) await yieldToEventLoop(); // don't starve the API while scanning
  }
  return finish();
}

/**
 * Backwards-compatible entry point: the decoded payload string, or null.
 * Throws only if the image cannot be read at all.
 */
export async function decodeQrFromImage(imagePath, options) {
  const result = await decodeQrDetailed(imagePath, options);
  if (result.error && !result.code) throw new Error(result.error);
  return result.code;
}
