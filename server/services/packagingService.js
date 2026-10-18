import Jimp from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Packaging visual-consistency check.
//
// Phase 10: REAL image comparison (dHash + colour profile). No
// Math.random(), no hardcoded similarity — unchanged in Phase 12.
//
// Phase 12 fix: the Phase 10 version compared the ENTIRE uploaded image
// against the ENTIRE reference image with a naive aspect-ratio-warping
// resize. That made it far too sensitive to things that have nothing to
// do with whether the packaging itself matches:
//   - white/background margins around the product in the photo
//   - the photo being rotated/sideways (phone camera, gallery screenshot)
//   - different camera framing/crop/scale/zoom
//   - background clutter behind the product
// A genuine photo of genuine packaging, taken slightly differently from
// the reference shot, could score low for reasons that have nothing to do
// with counterfeiting.
//
// This version adds two REAL, deterministic preprocessing steps before
// the same hash/colour comparison:
//   1. trimToContent() — locates the product's bounding box against its
//      background (sampled from the image's own border, not a guess) and
//      crops to it, so background/margins stop diluting the signal.
//   2. letterbox() — resizes the trimmed content to fit (preserving
//      aspect ratio, never warping/stretching it) inside a fixed-size
//      canvas with neutral padding, so differently-cropped/zoomed photos
//      of the same box land in a comparable frame.
// The uploaded photo is additionally compared at all four cardinal
// rotations against the reference, and the best-scoring orientation wins
// — reference photos in this dataset are known-good front-panel shots, so
// only the (potentially sideways) uploaded photo needs this search.
//
// Still true: this is a genuine, explainable, deterministic comparison —
// not a trained ML model. It is not claimed to be one. It will not catch
// every subtle counterfeit; that limitation stays visible to the risk
// engine and the user rather than hidden behind an invented confidence.
//
// If no reference image exists for the matched medicine, this returns
// PACKAGING_NOT_AVAILABLE with similarity = null. Never fabricates a
// number to fill the gap — see riskEngine.js for how a missing signal is
// handled (excluded from the weighted score, not defaulted to a guess).
// ---------------------------------------------------------------------------

export const PACKAGING_SOURCE = {
  REAL: 'REAL',
  UNAVAILABLE: 'UNAVAILABLE', // no reference image existed to compare against
};

export const PACKAGING_STATUS = {
  MATCH: 'PACKAGING_MATCH',
  PARTIAL: 'PACKAGING_PARTIAL_MATCH',
  MISMATCH: 'PACKAGING_MISMATCH',
  NOT_AVAILABLE: 'PACKAGING_NOT_AVAILABLE',
};

const HASH_SIZE = 9; // dHash uses (HASH_SIZE) x (HASH_SIZE-1) grayscale grid
const GRID = 4; // colour histogram grid (GRID x GRID cells)

/**
 * Computes a 64-bit difference hash (dHash) of an image already loaded
 * into a Jimp instance. Robust to scaling/compression; two visually
 * similar images produce hashes with a small Hamming distance.
 * @param {Jimp} image
 * @returns {string} 64-character '0'/'1' string
 */
function dHash(image) {
  const clone = image.clone().grayscale().resize(HASH_SIZE, HASH_SIZE - 1, Jimp.RESIZE_BILINEAR);
  let bits = '';
  for (let y = 0; y < HASH_SIZE - 1; y++) {
    for (let x = 0; x < HASH_SIZE - 1; x++) {
      const left = Jimp.intToRGBA(clone.getPixelColor(x, y)).r;
      const right = Jimp.intToRGBA(clone.getPixelColor(x + 1, y)).r;
      bits += left < right ? '1' : '0';
    }
  }
  return bits;
}

/**
 * Hamming distance between two equal-length '0'/'1' strings. Exported for
 * unit testing independent of any image I/O.
 */
export function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/**
 * Coarse average-colour fingerprint: mean R,G,B per grid cell.
 * @param {Jimp} image
 * @returns {number[]} flat array of length GRID*GRID*3
 */
function colorProfile(image) {
  const clone = image.clone().resize(GRID * 8, GRID * 8, Jimp.RESIZE_BILINEAR);
  const cellSize = 8;
  const profile = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = 0; y < cellSize; y++) {
        for (let x = 0; x < cellSize; x++) {
          const { r: pr, g: pg, b: pb } = Jimp.intToRGBA(
            clone.getPixelColor(gx * cellSize + x, gy * cellSize + y)
          );
          r += pr;
          g += pg;
          b += pb;
          count++;
        }
      }
      profile.push(r / count, g / count, b / count);
    }
  }
  return profile;
}

/**
 * 0-100 similarity from two colour profiles (RMSE-based). Exported for
 * unit testing independent of any image I/O.
 */
export function colorSimilarity(a, b) {
  let sumSqDiff = 0;
  for (let i = 0; i < a.length; i++) {
    sumSqDiff += (a[i] - b[i]) ** 2;
  }
  const rmse = Math.sqrt(sumSqDiff / a.length);
  // rmse is in 0-255 space; convert to a 0-100 similarity (255 diff -> 0%)
  return Math.max(0, 100 - (rmse / 255) * 100);
}

// --- Phase 12: background trimming -----------------------------------------

const ANALYSIS_EDGE = 240; // small, fast downscale used only to locate the crop box
const BACKGROUND_DIFF_THRESHOLD = 24; // grayscale levels away from the sampled border to count as "content"
const MIN_CONTENT_FRACTION = 0.15; // below this, treat as a degenerate/unreliable crop and skip it
const MAX_CONTENT_FRACTION = 0.97; // above this, there's no real margin worth trimming
const CROP_PADDING = 0.04; // extra margin kept around the detected content box, so the crop never clips the package edge itself

/**
 * Finds the product's bounding box in `grayscalePixels` (a small analysis-
 * resolution grid) against its own border colour, and returns it as
 * fractional (0-1) coordinates, or null if no reliable crop was found.
 * Pure function over a plain pixel-reader callback — no Jimp/image I/O —
 * so the actual box-finding logic is unit-testable on synthetic data.
 *
 * @param {(x: number, y: number) => number} getGray pixel reader, 0-255
 * @param {number} w analysis grid width
 * @param {number} h analysis grid height
 * @returns {{x0: number, y0: number, x1: number, y1: number}|null}
 */
export function findContentBoxFraction(getGray, w, h) {
  const borderSamples = [];
  for (let x = 0; x < w; x++) {
    borderSamples.push(getGray(x, 0), getGray(x, h - 1));
  }
  for (let y = 0; y < h; y++) {
    borderSamples.push(getGray(0, y), getGray(w - 1, y));
  }
  const bg = borderSamples.reduce((sum, v) => sum + v, 0) / borderSamples.length;

  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.abs(getGray(x, y) - bg) > BACKGROUND_DIFF_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return null; // no pixel differs enough from the border — nothing to trim to

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  if (contentWidth < w * MIN_CONTENT_FRACTION || contentHeight < h * MIN_CONTENT_FRACTION) return null; // degenerate — likely noise, not a real subject
  if (contentWidth >= w * MAX_CONTENT_FRACTION && contentHeight >= h * MAX_CONTENT_FRACTION) return null; // already tightly framed — nothing meaningful to trim

  const x0 = Math.max(0, minX / w - CROP_PADDING);
  const y0 = Math.max(0, minY / h - CROP_PADDING);
  const x1 = Math.min(1, (maxX + 1) / w + CROP_PADDING);
  const y1 = Math.min(1, (maxY + 1) / h + CROP_PADDING);
  return { x0, y0, x1, y1 };
}

/**
 * Crops a Jimp image to its detected product region, trimming away
 * uniform background/margins. Returns an unmodified clone when no
 * reliable crop is found (busy background, or already tightly framed) —
 * never guesses a crop it isn't confident about.
 * @param {Jimp} image
 */
function trimToContent(image) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const longEdge = Math.max(width, height);
  const scale = Math.min(1, ANALYSIS_EDGE / longEdge);
  const aw = Math.max(2, Math.round(width * scale));
  const ah = Math.max(2, Math.round(height * scale));
  const analysis = image.clone().grayscale().resize(aw, ah, Jimp.RESIZE_BILINEAR);
  const getGray = (x, y) => Jimp.intToRGBA(analysis.getPixelColor(x, y)).r;

  const box = findContentBoxFraction(getGray, aw, ah);
  if (!box) return image.clone();

  const cropX = Math.round(box.x0 * width);
  const cropY = Math.round(box.y0 * height);
  const cropW = Math.max(1, Math.round((box.x1 - box.x0) * width));
  const cropH = Math.max(1, Math.round((box.y1 - box.y0) * height));
  return image.clone().crop(cropX, cropY, cropW, cropH);
}

// --- Phase 12: aspect-preserving letterbox ----------------------------------

const CANVAS_SIZE = 256;
const CANVAS_BACKGROUND = 0x808080ff; // neutral mid-grey padding; doesn't bias the dHash gradient toward either a light or dark box

/**
 * Resizes `image` to fit inside a fixed CANVAS_SIZE x CANVAS_SIZE square,
 * preserving its aspect ratio (never stretching/warping), centered on
 * neutral padding. Two photos of the same box taken with different
 * crop/zoom now land in directly comparable frames instead of one being
 * squashed relative to the other.
 * @param {Jimp} image
 */
function letterbox(image) {
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const scale = Math.min(CANVAS_SIZE / w, CANVAS_SIZE / h);
  const newW = Math.max(1, Math.round(w * scale));
  const newH = Math.max(1, Math.round(h * scale));
  const resized = image.clone().resize(newW, newH, Jimp.RESIZE_BILINEAR);
  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, CANVAS_BACKGROUND);
  canvas.composite(resized, Math.floor((CANVAS_SIZE - newW) / 2), Math.floor((CANVAS_SIZE - newH) / 2));
  return canvas;
}

/**
 * Resolves a Medicine.image reference (which may be a local relative path
 * or a full http(s) URL) to something Jimp.read() can load.
 * @param {string} imageRef
 */
export function resolveReferenceImagePath(imageRef) {
  if (!imageRef) return null;
  if (/^https?:\/\//i.test(imageRef)) return imageRef;
  // Treat as a path relative to server/reference-images/
  return path.join(__dirname, '..', 'reference-images', imageRef);
}

const ROTATIONS = [0, 90, 180, 270];

/**
 * Genuinely compares two real images on disk/URL. Never invents a result;
 * throws if either image can't be read, which the caller treats as
 * "comparison not possible" rather than a fabricated score.
 *
 * Reference photos in this dataset are known-good, correctly-oriented
 * front-panel shots, so only the UPLOADED photo's orientation is
 * searched — the case a real user photo genuinely varies on.
 *
 * @param {string} uploadedImagePath absolute path to the uploaded image
 * @param {string} referenceImagePath absolute path or URL to the reference image
 * @returns {Promise<{similarity: number, status: string, matchedOrientation: number}>}
 */
export async function compareImages(uploadedImagePath, referenceImagePath, thresholds = {}) {
  const [uploadedRaw, referenceRaw] = await Promise.all([
    Jimp.read(uploadedImagePath),
    Jimp.read(referenceImagePath),
  ]);

  const referenceCanvas = letterbox(trimToContent(referenceRaw));
  const refHash = dHash(referenceCanvas);
  const refColor = colorProfile(referenceCanvas);

  const uploadedTrimmed = trimToContent(uploadedRaw);

  let best = null;
  for (const angle of ROTATIONS) {
    const rotated = angle === 0 ? uploadedTrimmed : uploadedTrimmed.clone().rotate(angle, false);
    const canvas = letterbox(rotated);
    const hash = dHash(canvas);
    const color = colorProfile(canvas);
    const hashSimilarity = 100 - (hammingDistance(hash, refHash) / hash.length) * 100;
    const colorSim = colorSimilarity(color, refColor);
    // Weighted combination: structural/layout signal (hash) counts more
    // than raw colour average, since colour alone is too easily fooled by
    // lighting/white balance differences between two genuine photos.
    const combined = hashSimilarity * 0.65 + colorSim * 0.35;
    if (!best || combined > best.combined) best = { angle, combined };
  }

  const similarity = Math.round(best.combined * 10) / 10;
  const status =
    similarity >= (thresholds.match ?? 82)
      ? PACKAGING_STATUS.MATCH
      : similarity >= (thresholds.partial ?? 60)
        ? PACKAGING_STATUS.PARTIAL
        : PACKAGING_STATUS.MISMATCH;

  return { similarity, status, matchedOrientation: best.angle };
}

/**
 * @param {string} [uploadedImagePath] absolute path to the uploaded image
 * @param {string|null} [referenceImageRef] Medicine.image value for the
 *   matched medicine, if any (relative path under reference-images/, or a
 *   full URL). Pass null/undefined when no medicine was matched or the
 *   matched medicine has no reference image on file.
 * @returns {Promise<{similarity: number|null, status: string, source: string}>}
 */
export async function analyzePackaging(uploadedImagePath, referenceImageRef = null, thresholds = {}) {
  if (!uploadedImagePath || !referenceImageRef) {
    return { similarity: null, status: PACKAGING_STATUS.NOT_AVAILABLE, source: PACKAGING_SOURCE.UNAVAILABLE };
  }

  const referenceImagePath = resolveReferenceImagePath(referenceImageRef);

  try {
    const { similarity, status, matchedOrientation } = await compareImages(uploadedImagePath, referenceImagePath, thresholds);
    return { similarity, status, source: PACKAGING_SOURCE.REAL, matchedOrientation };
  } catch (err) {
    // Reference image missing/corrupt/unreachable — never fabricate a
    // score to fill the gap. Report the honest "can't compare" state.
    // eslint-disable-next-line no-console
    console.error('[Packaging] Comparison failed:', err.message);
    return { similarity: null, status: PACKAGING_STATUS.NOT_AVAILABLE, source: PACKAGING_SOURCE.UNAVAILABLE };
  }
}
