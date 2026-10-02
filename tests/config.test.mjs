import { test } from "node:test";
import assert from "node:assert/strict";
import { listApps, getApp, appForRepo } from "../lib/config.mjs";

test("listApps returns both apps with their key", () => {
  const keys = listApps().map((a) => a.key).sort();
  assert.deepEqual(keys, ["arc", "bsr"]);
});

test("getApp returns config with dev url and viewports", () => {
  const bsr = getApp("bsr");
  assert.equal(bsr.devUrl, "https://dev.bigshouldersmanager.com");
  assert.equal(bsr.viewports.length, 2);
});

test("getApp throws on unknown key", () => {
  assert.throws(() => getApp("nope"), /Unknown app "nope"/);
});

test("appForRepo matches case-insensitively and returns null when unknown", () => {
  assert.equal(appForRepo("EvanReppeto/Arc-Studio").key, "arc");
  assert.equal(appForRepo("someone/else"), null);
});
