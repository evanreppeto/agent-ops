import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isReusableAuth } from "../lib/auth-reuse.mjs";

const dir = mkdtempSync(join(tmpdir(), "qa-auth-"));
const SESSION = JSON.stringify({ cookies: [{ name: "sb", value: "x", domain: "dev.example", path: "/" }], origins: [] });
const EMPTY = JSON.stringify({ cookies: [], origins: [] });

function file(name, body, ageMs) {
  const p = join(dir, name);
  writeFileSync(p, body);
  const t = (Date.now() - ageMs) / 1000;
  utimesSync(p, t, t);
  return p;
}

test("a fresh, non-empty session file is reusable", () => {
  assert.equal(isReusableAuth(file("fresh.json", SESSION, 5 * 60_000)), true);
});

test("a session older than 30 minutes is not reusable", () => {
  assert.equal(isReusableAuth(file("old.json", SESSION, 31 * 60_000)), false);
});

test("an empty-state file is not reusable", () => {
  assert.equal(isReusableAuth(file("empty.json", EMPTY, 60_000)), false);
});

test("a missing or corrupt file is not reusable", () => {
  assert.equal(isReusableAuth(join(dir, "missing.json")), false);
  assert.equal(isReusableAuth(file("bad.json", "{not json", 60_000)), false);
});

test("origins-only state (localStorage session) counts as non-empty", () => {
  const body = JSON.stringify({ cookies: [], origins: [{ origin: "https://dev.example", localStorage: [{ name: "k", value: "v" }] }] });
  assert.equal(isReusableAuth(file("origins.json", body, 60_000)), true);
});
