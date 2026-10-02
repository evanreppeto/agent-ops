import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarker, parseMarkers, needsQa } from "../lib/qa-marker.mjs";

test("buildMarker produces a hidden html comment", () => {
  assert.equal(buildMarker({ sha: "abc123", verdict: "pass" }), "<!-- qa-agent sha=abc123 verdict=pass -->");
});

test("buildMarker rejects unknown verdicts", () => {
  assert.throws(() => buildMarker({ sha: "abc", verdict: "maybe" }), /verdict/);
});

test("parseMarkers finds markers across comments", () => {
  const found = parseMarkers([
    "hello",
    "report\n<!-- qa-agent sha=aaa111 verdict=fail -->",
    "<!-- qa-agent sha=bbb222 verdict=pass -->",
  ]);
  assert.deepEqual(found, [
    { sha: "aaa111", verdict: "fail" },
    { sha: "bbb222", verdict: "pass" },
  ]);
});

test("needsQa is false only when this exact sha was already tested", () => {
  const comments = ["<!-- qa-agent sha=aaa111 verdict=fail -->"];
  assert.equal(needsQa(comments, "aaa111"), false);
  assert.equal(needsQa(comments, "ccc333"), true);
  assert.equal(needsQa([], "aaa111"), true);
});
