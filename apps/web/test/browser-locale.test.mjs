import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBrowserLocale } from "../src/lib/browser-locale.mjs";

test("matches supported browser preferences in order, including regional variants", () => {
  assert.equal(resolveBrowserLocale(["en-US", "zh-CN"]), "en");
  assert.equal(resolveBrowserLocale(["zh-TW", "en-GB"]), "zh");
  assert.equal(resolveBrowserLocale(["fr-FR", "en-GB"]), "en");
  assert.equal(resolveBrowserLocale([" EN-au "]), "en");
});

test("falls back to Chinese when browser preferences are missing or unsupported", () => {
  for (const preferences of [
    undefined,
    null,
    [],
    ["fr-FR", "ja-JP"],
    ["", null, 12],
  ]) {
    assert.equal(resolveBrowserLocale(preferences), "zh");
  }
});
