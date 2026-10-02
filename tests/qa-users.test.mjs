import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEnv, newPassword, assertSafeTarget } from "../lib/qa-users.mjs";

test("mergeEnv replaces existing keys and keeps other lines", () => {
  const before = "# note\nBSR_QA_EMAIL=old@x.com\nOTHER=1\n";
  const after = mergeEnv(before, { BSR_QA_EMAIL: "new@x.com", BSR_QA_PASSWORD: "pw" });
  assert.equal(after, "# note\nBSR_QA_EMAIL=new@x.com\nOTHER=1\nBSR_QA_PASSWORD=pw\n");
});

test("mergeEnv works on an empty file", () => {
  assert.equal(mergeEnv("", { A: "1" }), "A=1\n");
});

test("newPassword is long, url-safe, and different each time", () => {
  const a = newPassword();
  assert.match(a, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a, newPassword());
});

test("assertSafeTarget refuses BSR production", () => {
  assert.throws(() => assertSafeTarget("bsr", "https://tesgvrcgcyadownahujh.supabase.co"), /production/);
  assert.doesNotThrow(() => assertSafeTarget("bsr", "https://somedevref.supabase.co"));
});

test("assertSafeTarget only accepts Arc's known database", () => {
  assert.doesNotThrow(() => assertSafeTarget("arc", "https://qqbecyrhnowmooyjiztz.supabase.co"));
  assert.throws(() => assertSafeTarget("arc", "https://other.supabase.co"), /Arc/);
});

test("assertSafeTarget rejects a missing url", () => {
  assert.throws(() => assertSafeTarget("bsr", undefined), /missing/i);
});
