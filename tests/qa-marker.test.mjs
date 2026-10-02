import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarker, parseMarkers, needsQa } from "../lib/qa-marker.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "0123456789abcdef0123456789abcdef01234567";
const SHA_C = "c".repeat(40);

test("buildMarker produces a visible plain-markdown footer line", () => {
  assert.equal(buildMarker({ sha: SHA_B, verdict: "pass" }), `_qa-agent sha=${SHA_B} verdict=pass_`);
});

test("buildMarker rejects unknown verdicts", () => {
  assert.throws(() => buildMarker({ sha: SHA_A, verdict: "maybe" }), /verdict/);
});

test("buildMarker requires a full 40-char lowercase hex sha", () => {
  for (const sha of ["abc1234", SHA_A.toUpperCase(), `${SHA_A}0`, "g".repeat(40), "", undefined]) {
    assert.throws(() => buildMarker({ sha, verdict: "pass" }), /sha/, `should reject ${sha}`);
  }
});

test("parseMarkers finds markers across comments", () => {
  const found = parseMarkers([
    "hello",
    `report\n\n_qa-agent sha=${SHA_A} verdict=fail_`,
    `_qa-agent sha=${SHA_B} verdict=pass_`,
  ]);
  assert.deepEqual(found, [
    { sha: SHA_A, verdict: "fail" },
    { sha: SHA_B, verdict: "pass" },
  ]);
});

test("parseMarkers tolerates surrounding whitespace, missing or doubled underscores", () => {
  const found = parseMarkers([
    `  _qa-agent sha=${SHA_A} verdict=blocked_  `,
    `qa-agent sha=${SHA_B} verdict=pass`,
    `__qa-agent sha=${SHA_C} verdict=fail__`,
    `*qa-agent sha=${SHA_A} verdict=pass*`,
  ]);
  assert.deepEqual(found, [
    { sha: SHA_A, verdict: "blocked" },
    { sha: SHA_B, verdict: "pass" },
    { sha: SHA_C, verdict: "fail" },
    { sha: SHA_A, verdict: "pass" },
  ]);
});

test("parseMarkers ignores short shas", () => {
  assert.deepEqual(parseMarkers(["_qa-agent sha=abc123 verdict=pass_"]), []);
});

test("parseMarkers round-trips buildMarker output", () => {
  assert.deepEqual(parseMarkers([buildMarker({ sha: SHA_C, verdict: "blocked" })]), [{ sha: SHA_C, verdict: "blocked" }]);
});

test("needsQa is false only when this exact sha was already tested", () => {
  const comments = [`_qa-agent sha=${SHA_A} verdict=fail_`];
  assert.equal(needsQa(comments, SHA_A), false);
  assert.equal(needsQa(comments, SHA_C), true);
  assert.equal(needsQa([], SHA_A), true);
});
