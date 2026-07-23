import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const focusMakerHtml = await readFile(
  new URL("../public/focus-maker-app/index.html", import.meta.url),
  "utf8",
);

test("focus maker uses one 252 by 229 product placement and clipping area", () => {
  assert.match(focusMakerHtml, /\.product-zone\{top:92px;height:229px\}/);
  assert.match(focusMakerHtml, /\.p-product\{top:92px;width:252px;height:229px\}/);
  assert.match(
    focusMakerHtml,
    /PRODUCT=\{x:24,y:92,width:252,height:229\}/,
  );
  assert.match(focusMakerHtml, /상품 이미지 최대 배치·잘림 영역/);
});

test("focus maker keeps the required 40px bottom margin", () => {
  assert.match(focusMakerHtml, /\.g-bottom\{top:424px\}/);
  assert.match(
    focusMakerHtml,
    /TEXT=\{x:24,y:345,width:252,height:79\}/,
  );
  assert.equal(464 - (345 + 79), 40);
});
