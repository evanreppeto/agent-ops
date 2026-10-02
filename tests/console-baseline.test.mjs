import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutBaseline } from "../lib/console-baseline.mjs";

test("withoutBaseline drops errors that equal or contain a baseline entry", () => {
  const errors = ["Failed to load resource: 404 /favicon.ico", "TypeError: x is undefined", "Warning: hydration"];
  assert.deepEqual(withoutBaseline(errors, ["favicon.ico", "Warning: hydration"]), ["TypeError: x is undefined"]);
});

test("withoutBaseline with no baseline returns every error", () => {
  assert.deepEqual(withoutBaseline(["a", "b"]), ["a", "b"]);
  assert.deepEqual(withoutBaseline(["a", "b"], []), ["a", "b"]);
});

test("blank baseline entries never hide errors", () => {
  assert.deepEqual(withoutBaseline(["TypeError: boom"], ["", "   "]), ["TypeError: boom"]);
});

test("withoutBaseline does not mutate its input", () => {
  const errors = ["a", "b"];
  withoutBaseline(errors, ["a"]);
  assert.deepEqual(errors, ["a", "b"]);
});
