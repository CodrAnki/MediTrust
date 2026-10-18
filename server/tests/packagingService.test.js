import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hammingDistance, colorSimilarity, findContentBoxFraction } from '../services/packagingService.js';

describe('packagingService.hammingDistance', () => {
  test('identical strings -> 0', () => assert.equal(hammingDistance('1010', '1010'), 0));
  test('completely different strings -> full length', () => assert.equal(hammingDistance('0000', '1111'), 4));
  test('partial difference counted correctly', () => assert.equal(hammingDistance('1100', '1001'), 2));
});

describe('packagingService.colorSimilarity', () => {
  test('identical profiles -> 100', () => assert.equal(colorSimilarity([10, 20, 30], [10, 20, 30]), 100));
  test('maximally different profiles -> 0', () => assert.equal(colorSimilarity([0, 0, 0], [255, 255, 255]), 0));
  test('closer profiles score higher than more different ones', () => {
    const close = colorSimilarity([100, 100, 100], [110, 105, 108]);
    const far = colorSimilarity([100, 100, 100], [200, 50, 220]);
    assert.ok(close > far);
  });
});

describe('packagingService.findContentBoxFraction (item 4: background/margin trimming)', () => {
  function grid(rows) {
    return { getGray: (x, y) => rows[y][x], w: rows[0].length, h: rows.length };
  }

  test('a centered product against a uniform white margin is correctly boxed', () => {
    const W = 10; const H = 10; const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => 255));
    for (let y = 3; y <= 6; y++) for (let x = 3; x <= 6; x++) rows[y][x] = 20; // dark product region
    const { getGray, w, h } = grid(rows);
    const box = findContentBoxFraction(getGray, w, h);
    assert.ok(box, 'expected a detected content box');
    // box should tightly bracket the 3..6 region (with small padding), not the whole 0..9 frame
    assert.ok(box.x0 > 0 && box.x0 < 0.35);
    assert.ok(box.x1 < 1 && box.x1 > 0.55);
  });

  test('a photo with no uniform margin (content fills the frame) returns null — never guesses a bad crop', () => {
    const W = 10; const H = 10;
    const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x + y) % 2 === 0 ? 20 : 230));
    const { getGray, w, h } = grid(rows);
    const box = findContentBoxFraction(getGray, w, h);
    assert.equal(box, null);
  });

  test('a uniformly blank/background-only image (nothing differs) returns null', () => {
    const W = 8; const H = 8; const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => 200));
    const { getGray, w, h } = grid(rows);
    const box = findContentBoxFraction(getGray, w, h);
    assert.equal(box, null);
  });

  test('a tiny speck of noise (below the minimum content fraction) is treated as degenerate, not a real crop', () => {
    const W = 20; const H = 20; const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => 255));
    rows[10][10] = 0; // single stray dark pixel
    const { getGray, w, h } = grid(rows);
    const box = findContentBoxFraction(getGray, w, h);
    assert.equal(box, null);
  });
});
