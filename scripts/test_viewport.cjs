'use strict';

const assert = require('node:assert/strict');
const V = require('../web/viewport-core.js');
let passed = 0;
const limits = { min: 0.12, max: 100 };
const wide = { left: 30, top: 80, width: 800, height: 400 };
const initial = [100, 200, 1600, 800];

function test(name, fn) {
  fn();
  passed++;
  console.log('PASS', name);
}
function close(actual, expected, message = '') {
  const tolerance = 1e-9 * Math.max(1, Math.abs(expected));
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}
function point(actual, expected, message = '') {
  close(actual.x, expected.x, `${message} x`);
  close(actual.y, expected.y, `${message} y`);
}
function box(actual, expected, message = '') {
  assert.equal(actual.length, 4);
  actual.forEach((value, index) => close(value, expected[index], `${message} [${index}]`));
}
const center = b => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });

test('Normalization fills the viewport without cropping or moving the center', () => {
  const source = [100, 200, 1000, 1000];
  const result = V.normalize(source, wide);
  box(result, [-400, 200, 2000, 1000]);
  point(center(result), center(source));
  close(V.scale(result, wide), V.scale(source, wide));
  box(V.normalize(result, wide), result, 'normalizing twice is stable');
});

test('Resize preserves world center and display scale across rotation and sidebar changes', () => {
  const portrait = { left: 0, top: 180, width: 360, height: 600 };
  const result = V.resize(initial, wide, portrait);
  box(result, [540, 0, 720, 1200]);
  point(center(result), center(initial));
  close(V.scale(result, portrait), 2);
  box(V.resize(result, portrait, wide), initial, 'rotation round trip');
  const sidebarOpen = { ...wide, width: 500 };
  const narrowed = V.resize(initial, wide, sidebarOpen);
  point(center(narrowed), center(initial));
  close(V.scale(narrowed, sidebarOpen), 2);
});

test('World coordinates include viewport offset and SVG letterboxing', () => {
  const source = [0, 0, 1000, 1000];
  point(V.world(source, wide, { x: 430, y: 280 }), { x: 500, y: 500 });
  point(V.world(source, wide, { x: 30, y: 80 }), { x: -500, y: 0 });
});

test('Zoom keeps the exact world point under an off-center pointer', () => {
  const pointer = { x: 190, y: 350 };
  const before = V.world(initial, wide, pointer);
  const result = V.anchored(initial, wide, pointer, pointer, 0.5, limits);
  point(V.world(result, wide, pointer), before);
  close(V.scale(result, wide), 1);
  assert.notDeepEqual(center(result), center(initial), 'off-center zoom must move the view center');
});

test('Pinch combines midpoint translation with scale and preserves the material under the midpoint', () => {
  const g = new V.Gesture();
  let current = initial;
  g.begin(1, 130, 180, 'touch', current, wide);
  g.begin(2, 330, 180, 'touch', current, wide);
  const originalAnchor = V.world(current, wide, { x: 230, y: 180 });
  current = g.move(1, 140, 220, limits);
  current = g.move(2, 540, 220, limits);
  close(V.scale(current, wide), 1);
  point(V.world(current, wide, { x: 340, y: 220 }), originalAnchor);
  assert.equal(g.moved, true);
});

test('One finger to two fingers and back continues from the current view without a jump', () => {
  const g = new V.Gesture();
  let current = initial;
  g.begin(1, 130, 180, 'touch', current, wide);
  current = g.move(1, 150, 200, limits);
  box(current, [60, 160, 1600, 800]);
  g.begin(2, 350, 200, 'touch', current, wide);
  box(g.move(2, 350, 200, limits), current, 'adding a finger');
  current = g.move(2, 450, 200, limits);
  const beforeLift = [...current];
  assert.deepEqual(g.end(2, current, wide), { active: true, moved: true });
  box(g.move(1, 150, 200, limits), beforeLift, 'lifting a finger');
  const oldScale = V.scale(beforeLift, wide);
  current = g.move(1, 162, 206, limits);
  box(current, [beforeLift[0] - 12 * oldScale, beforeLift[1] - 6 * oldScale, beforeLift[2], beforeLift[3]]);
  assert.deepEqual(g.end(1, current, wide), { active: false, moved: true });
});

test('Touch jitter below the threshold remains a tap, including a return to the starting point', () => {
  const g = new V.Gesture();
  g.begin(1, 100, 100, 'touch', initial, wide);
  assert.equal(g.move(1, 105, 104, limits), null);
  assert.equal(g.move(1, 100, 100, limits), null);
  assert.deepEqual(g.end(1, initial, wide), { active: false, moved: false });
  g.begin(2, 100, 100, 'touch', initial, wide);
  box(g.move(2, 109, 100, limits), [82, 200, 1600, 800]);
  assert.equal(g.moved, true);
});

test('Mouse movement uses its smaller threshold and untracked pointers cannot move the view', () => {
  const g = new V.Gesture();
  g.begin(7, 100, 100, 'mouse', initial, wide);
  assert.equal(g.move(8, 500, 500, limits), null);
  assert.equal(g.move(7, 104, 100, limits), null);
  box(g.move(7, 105, 100, limits), [90, 200, 1600, 800]);
});

test('A cancelled gesture leaves no stale pointers or movement state and can be reused', () => {
  const g = new V.Gesture();
  g.begin(1, 100, 100, 'touch', initial, wide);
  g.begin(2, 300, 100, 'touch', initial, wide);
  g.move(2, 500, 100, limits);
  g.cancel();
  assert.equal(g.points.size, 0);
  assert.equal(g.base, null);
  assert.equal(g.moved, false);
  assert.equal(g.move(1, 150, 100, limits), null);
  g.begin(3, 100, 100, 'touch', initial, wide);
  assert.equal(g.move(3, 102, 100, limits), null);
  assert.deepEqual(g.end(3, initial, wide), { active: false, moved: false });
});

test('Coincident fingers pan safely, then begin pinching without a scale spike', () => {
  const g = new V.Gesture();
  let current = initial;
  g.begin(1, 130, 180, 'touch', current, wide);
  g.begin(2, 130, 180, 'touch', current, wide);
  const originalAnchor = V.world(current, wide, { x: 130, y: 180 });
  current = g.move(2, 136, 180, limits);
  close(V.scale(current, wide), 2, 'near-coincident movement only pans');
  point(V.world(current, wide, { x: 133, y: 180 }), originalAnchor);
  current = g.move(2, 142, 180, limits);
  close(V.scale(current, wide), 2, 'crossing the threshold rebases without changing scale');
  point(V.world(current, wide, { x: 136, y: 180 }), originalAnchor);
  current = g.move(2, 154, 180, limits);
  close(V.scale(current, wide), 1, 'subsequent pinching changes scale');
  point(V.world(current, wide, { x: 142, y: 180 }), originalAnchor);
});

test('Collapsing a normal pinch never produces an infinite or invalid camera', () => {
  const g = new V.Gesture();
  g.begin(1, 130, 180, 'touch', initial, wide);
  g.begin(2, 330, 180, 'touch', initial, wide);
  const result = g.move(2, 130, 180, limits);
  result.forEach(value => assert(Number.isFinite(value)));
  assert(result[2] > 0 && result[3] > 0);
  assert(V.scale(result, wide) <= limits.max);
});

test('Zoom limits clamp scale while retaining the pointer anchor', () => {
  const pointer = { x: 230, y: 380 };
  const anchor = V.world(initial, wide, pointer);
  for (const [factor, expectedScale] of [[1e-8, limits.min], [1e8, limits.max]]) {
    const result = V.anchored(initial, wide, pointer, pointer, factor, limits);
    close(V.scale(result, wide), expectedScale);
    point(V.world(result, wide, pointer), anchor);
    const repeated = V.anchored(result, wide, pointer, pointer, factor, limits);
    box(repeated, result, 'repeated zoom at the limit');
  }
});

console.log(`${passed} viewport tests passed`);
