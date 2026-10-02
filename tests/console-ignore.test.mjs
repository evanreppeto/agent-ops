import { test } from "node:test";
import assert from "node:assert/strict";
import { isIgnoredConsoleError } from "../lib/console-ignore.mjs";
import { getApp } from "../lib/config.mjs";

const NOT_FOUND = "Failed to load resource: the server responded with a status of 404 (Not Found)";

test("bsr ignores a missing profile picture", () => {
  assert.equal(isIgnoredConsoleError(getApp("bsr"), NOT_FOUND, "https://dev.bigshouldersmanager.com/avatars/abc/1.jpg"), true);
});

test("bsr still reports other missing resources", () => {
  assert.equal(isIgnoredConsoleError(getApp("bsr"), NOT_FOUND, "https://dev.bigshouldersmanager.com/api/projects"), false);
});

test("non-resource errors from an avatar url are still reported", () => {
  assert.equal(isIgnoredConsoleError(getApp("bsr"), "TypeError: x is undefined", "https://dev.bigshouldersmanager.com/avatars/abc/1.jpg"), false);
});

test("arc has no ignore list", () => {
  assert.equal(isIgnoredConsoleError(getApp("arc"), NOT_FOUND, "https://dev.arc-studio.ai/avatars/a.jpg"), false);
});
