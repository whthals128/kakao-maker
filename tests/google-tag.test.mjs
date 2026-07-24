import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layout = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const focusMakerDocument = await readFile(
  new URL("../public/focus-maker-app/index.html", import.meta.url),
  "utf8",
);

test("the shared head contains one GA4 Google tag", () => {
  assert.match(layout, /const GA_MEASUREMENT_ID = "G-RNWYFT3RXE"/);
  assert.equal(
    layout.match(/googletagmanager\.com\/gtag\/js/g)?.length,
    1,
  );
  assert.equal(layout.match(/gtag\('config'/g)?.length, 1);
  assert.ok(layout.indexOf("<head>") < layout.indexOf("<body>"));
});

test("the embedded Focus Maker document does not duplicate the Google tag", () => {
  assert.doesNotMatch(focusMakerDocument, /googletagmanager\.com\/gtag\/js/);
  assert.doesNotMatch(focusMakerDocument, /G-RNWYFT3RXE/);
});
