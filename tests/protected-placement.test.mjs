import assert from "node:assert/strict";
import test from "node:test";
import { computeProtectedPlacement } from "../app/protected-placement.js";

const targets = [
  [1080, 1920], [1200, 628], [970, 90], [160, 600], [300, 50], [1200, 1200],
];
const regions = [
  { x: 0, y: 0, width: .35, height: .9 },
  { x: .65, y: .1, width: .35, height: .9 },
  { x: .25, y: .35, width: .5, height: .3 },
  { x: .9, y: .9, width: .1, height: .1 },
  { x: 0, y: 0, width: 1, height: 1 },
];

test("the entire protected rectangle remains inside every extreme ad ratio", () => {
  for (const [targetWidth, targetHeight] of targets) {
    for (const region of regions) {
      const placement = computeProtectedPlacement({ region, targetWidth, targetHeight, imageWidth: 1600, imageHeight: 900 });
      const bounds = placement.protectedBounds;
      assert.ok(bounds.left >= placement.insetX - 1e-7);
      assert.ok(bounds.top >= placement.insetY - 1e-7);
      assert.ok(bounds.right <= targetWidth - placement.insetX + 1e-7);
      assert.ok(bounds.bottom <= targetHeight - placement.insetY + 1e-7);
    }
  }
});

test("portrait source selections are protected too", () => {
  const placement = computeProtectedPlacement({
    region: { x: .58, y: .15, width: .38, height: .7 },
    targetWidth: 970,
    targetHeight: 90,
    imageWidth: 900,
    imageHeight: 1600,
  });
  assert.ok(placement.protectedBounds.left >= placement.insetX - 1e-7);
  assert.ok(placement.protectedBounds.right <= 970 - placement.insetX + 1e-7);
  assert.ok(placement.protectedBounds.top >= placement.insetY - 1e-7);
  assert.ok(placement.protectedBounds.bottom <= 90 - placement.insetY + 1e-7);
});
