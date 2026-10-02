import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDeployedSha } from "../lib/deploy-probe.mjs";
import { getApp } from "../lib/config.mjs";

test("bsr: reads the 12-char build id from the service worker", () => {
  const body = 'const CACHE = "bsr-2b6c724e4b47";\nself.addEventListener("install", () => {});';
  assert.equal(extractDeployedSha(getApp("bsr"), body), "2b6c724e4b47");
});

test("arc: reads the 40-char sha from the login page", () => {
  const sha = "78cd82f3ad708af58bc7a43eb562a509aa2d54c2";
  assert.equal(extractDeployedSha(getApp("arc"), `<script>self.__RELEASE="${sha}"</script>`), sha);
});

test("returns null when the page carries no sha (e.g. local 'dev' build)", () => {
  assert.equal(extractDeployedSha(getApp("bsr"), 'const CACHE = "bsr-dev";'), null);
});
