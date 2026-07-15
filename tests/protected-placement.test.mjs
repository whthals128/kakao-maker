import assert from "node:assert/strict";
import test from "node:test";
import { computePlacement } from "../app/protected-placement.js";

const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test("original fit keeps the whole source and fixes the protected center", () => {
  const plan = computePlacement({
    mode: "preserve",
    region: { x: .68, y: .18, width: .22, height: .5 },
    targetWidth: 1080,
    targetHeight: 1350,
    imageWidth: 1600,
    imageHeight: 900,
  });
  assert.ok(plan.foreground.x >= -1e-7);
  assert.ok(plan.foreground.y >= -1e-7);
  assert.ok(plan.foreground.x + plan.foreground.width <= 1080 + 1e-7);
  assert.ok(plan.foreground.y + plan.foreground.height <= 1350 + 1e-7);
  close((plan.protectedBounds.left + plan.protectedBounds.right) / 2, 540);
  close((plan.protectedBounds.top + plan.protectedBounds.bottom) / 2, 675);
});

test("background extend visibly insets the full foreground and overscans the blur", () => {
  const plan = computePlacement({ mode: "extend", region: null, targetWidth: 1200, targetHeight: 628, imageWidth: 900, imageHeight: 1600 });
  assert.ok(plan.foreground.x >= 1200 * .06 - 1e-7);
  assert.ok(plan.foreground.y >= 628 * .06 - 1e-7);
  assert.ok(plan.foreground.x + plan.foreground.width <= 1200 * .94 + 1e-7);
  assert.ok(plan.foreground.y + plan.foreground.height <= 628 * .94 + 1e-7);
  assert.ok(plan.background.x < 0);
  assert.ok(plan.background.y < 0);
  assert.ok(plan.background.x + plan.background.width > 1200);
  assert.ok(plan.background.y + plan.background.height > 628);
});

test("crop remains a real cover crop and centers the protected region", () => {
  const plan = computePlacement({
    mode: "crop",
    region: { x: .4, y: .3, width: .2, height: .4 },
    targetWidth: 1200,
    targetHeight: 628,
    imageWidth: 1600,
    imageHeight: 900,
  });
  close(plan.foreground.width / 1600, .75);
  assert.ok(plan.foreground.width >= 1200 - 1e-7);
  assert.ok(plan.foreground.height >= 628 - 1e-7);
  close((plan.protectedBounds.left + plan.protectedBounds.right) / 2, 600);
  close((plan.protectedBounds.top + plan.protectedBounds.bottom) / 2, 314);
  assert.equal(plan.background, null);
  assert.equal(plan.fallback, null);
});

test("crop vertical control moves monotonically without exposing canvas or protected area", () => {
  const input = { mode: "crop", region: { x: .4, y: .3, width: .2, height: .4 }, targetWidth: 1200, targetHeight: 628, imageWidth: 1600, imageHeight: 900 };
  const top = computePlacement({ ...input, verticalOffset: -1 });
  const center = computePlacement({ ...input, verticalOffset: 0 });
  const bottom = computePlacement({ ...input, verticalOffset: 1 });
  assert.ok(top.foreground.y < center.foreground.y && center.foreground.y < bottom.foreground.y);
  for (const plan of [top, center, bottom]) {
    assert.ok(plan.foreground.y <= 1e-7);
    assert.ok(plan.foreground.y + plan.foreground.height >= 628 - 1e-7);
    assert.ok(plan.protectedBounds.top >= -1e-7);
    assert.ok(plan.protectedBounds.bottom <= 628 + 1e-7);
  }
});

test("an impossible protected crop explicitly falls back to extension", () => {
  const plan = computePlacement({
    mode: "crop",
    region: { x: 0, y: 0, width: 1, height: 1 },
    targetWidth: 970,
    targetHeight: 90,
    imageWidth: 900,
    imageHeight: 1600,
  });
  assert.equal(plan.fallback, "extend");
  assert.ok(plan.background);
  assert.ok(plan.foreground.x >= -1e-7);
  assert.ok(plan.foreground.y >= -1e-7);
  assert.ok(plan.foreground.x + plan.foreground.width <= 970 + 1e-7);
  assert.ok(plan.foreground.y + plan.foreground.height <= 90 + 1e-7);
});
