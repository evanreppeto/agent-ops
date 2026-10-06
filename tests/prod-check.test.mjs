import { test } from "node:test";
import assert from "node:assert/strict";
import { prodCheckPaths, judgeResponse } from "../lib/prod-check.mjs";

test("prodCheckPaths dedupes login and deploy-probe paths", () => {
  const a = { login: { path: "/login" }, deployProbe: { path: "/login" } };
  assert.deepEqual(prodCheckPaths(a), ["/login"]);
  const b = { login: { path: "/auth/login" }, deployProbe: { path: "/sw.js" } };
  assert.deepEqual(prodCheckPaths(b), ["/auth/login", "/sw.js"]);
});

test("judgeResponse passes a healthy page", () => {
  assert.deepEqual(judgeResponse({ status: 200, body: "<html>Sign in</html>" }), { ok: true });
  assert.deepEqual(judgeResponse({ status: 302, body: "" }), { ok: true });
});

test("judgeResponse fails on status 0 and >= 400", () => {
  assert.deepEqual(judgeResponse({ status: 0, body: "" }), { ok: false, reason: "HTTP 0" });
  assert.deepEqual(judgeResponse({ status: 502, body: "ok" }), { ok: false, reason: "HTTP 502" });
  assert.deepEqual(judgeResponse({ status: 404, body: "" }), { ok: false, reason: "HTTP 404" });
  assert.equal(judgeResponse({ status: Number.NaN, body: "" }).ok, false);
});

test("judgeResponse fails on error text in a 200 body, case-insensitively", () => {
  for (const body of ["Something went wrong", "Application Error: a client-side exception", "Internal Server Error"]) {
    assert.deepEqual(judgeResponse({ status: 200, body }), { ok: false, reason: "error text on page" });
  }
});
