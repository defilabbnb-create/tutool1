import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  scrollToNotifySection,
  UpgradeEntry,
} from "../../components/upgrade-entry";

test("UpgradeEntry renders limit variant copy", () => {
  const html = renderToStaticMarkup(createElement(UpgradeEntry, { variant: "limit" }));

  assert.match(html, /Need to compress more than 10 images\?/);
  assert.match(html, /Join the waitlist for larger batch mode\./);
});

test("UpgradeEntry renders post-success variant copy", () => {
  const html = renderToStaticMarkup(
    createElement(UpgradeEntry, { variant: "post-success" })
  );

  assert.match(html, /Compressing many images\?/);
  assert.match(html, /We’re building faster batch processing and API access\./);
});

test("UpgradeEntry renders repeat-user variant copy", () => {
  const html = renderToStaticMarkup(
    createElement(UpgradeEntry, { variant: "repeat-user" })
  );

  assert.match(html, /Working with lots of images\?/);
  assert.match(html, /Get notified when larger batch limits are available\./);
});

test("scrollToNotifySection scrolls to the notify form when present", () => {
  let scrolled = false;
  const originalDocument = globalThis.document;

  globalThis.document = {
    getElementById(id: string) {
      assert.equal(id, "notify-section");
      return {
        scrollIntoView(options?: { behavior?: string }) {
          scrolled = options?.behavior === "smooth";
        },
      } as unknown as Element;
    },
  } as Document;

  scrollToNotifySection();
  assert.equal(scrolled, true);

  globalThis.document = originalDocument;
});
