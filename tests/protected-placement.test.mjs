import assert from "node:assert/strict";
import test from "node:test";
import { computePlacement } from "../app/protected-placement.js";
import { computeEdgeExtensionTiles, renderPlanToContext } from "../app/canvas-renderer.js";

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

test("background extend visibly insets the full foreground and requests edge mirroring", () => {
  const plan = computePlacement({ mode: "extend", region: null, targetWidth: 1200, targetHeight: 628, imageWidth: 900, imageHeight: 1600 });
  assert.ok(plan.foreground.x >= 1200 * .06 - 1e-7);
  assert.ok(plan.foreground.y >= 628 * .06 - 1e-7);
  assert.ok(plan.foreground.x + plan.foreground.width <= 1200 * .94 + 1e-7);
  assert.ok(plan.foreground.y + plan.foreground.height <= 628 * .94 + 1e-7);
  assert.equal(plan.background.type, "mirror");
});

test("mirrored edge bands cover the full target without repeating the source center", () => {
  const foreground = { x: 260, y: 60, width: 440, height: 508 };
  const tiles = computeEdgeExtensionTiles(foreground, 1200, 628, 900, 1600);
  const covers = (x, y) => tiles.some((tile) => x >= tile.x && x <= tile.x + tile.width && y >= tile.y && y <= tile.y + tile.height);
  assert.ok(covers(0, 0));
  assert.ok(covers(1200, 0));
  assert.ok(covers(0, 628));
  assert.ok(covers(1200, 628));
  assert.ok(tiles.every((tile) => tile.sourceX === 0 || tile.sourceY === 0 || tile.sourceX + tile.sourceWidth === 900 || tile.sourceY + tile.sourceHeight === 1600));
  assert.ok(tiles.every((tile) => !(tile.sourceX > 0 && tile.sourceX + tile.sourceWidth < 900 && tile.sourceY > 0 && tile.sourceY + tile.sourceHeight < 1600)));
  const right = tiles.filter((tile) => tile.kind === "right").sort((a, b) => a.x - b.x);
  assert.equal(right[0].flipX, true);
  assert.equal(right[1].flipX, false);
  close(right[0].x + right[0].width, right[1].x);
});

test("edge extension never blurs and draws the untouched foreground last", () => {
  const draws = [];
  const ctx = {
    filter: "blur(9px)",
    globalAlpha: .5,
    globalCompositeOperation: "multiply",
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    save() {}, restore() {}, clearRect() {}, fillRect() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, scale() {},
    drawImage(...args) { draws.push({ args, filter: this.filter, alpha: this.globalAlpha, composite: this.globalCompositeOperation }); },
  };
  const image = { width: 900, height: 1600 };
  const foreground = { x: 260, y: 60, width: 440, height: 508 };
  renderPlanToContext(ctx, image, 1200, 628, { foreground, background: { type: "mirror" } });
  assert.ok(draws.length > 1);
  assert.ok(draws.every((draw) => draw.filter === "none" && draw.alpha === 1 && draw.composite === "source-over"));
  assert.ok(draws.slice(0, -1).every((draw) => draw.args.length === 9));
  assert.deepEqual(draws.at(-1).args, [image, foreground.x, foreground.y, foreground.width, foreground.height]);
});

test("edge extension stays bounded for extreme custom aspect ratios", () => {
  const foreground = { x: 49940, y: 2, width: 120, height: 36 };
  const tiles = computeEdgeExtensionTiles(foreground, 100000, 40, 900, 1600);
  assert.ok(tiles.length > 0);
  assert.ok(tiles.length <= 624);
  assert.ok(tiles.every((tile) => Number.isFinite(tile.x) && Number.isFinite(tile.y) && tile.width > 0 && tile.height > 0));
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
