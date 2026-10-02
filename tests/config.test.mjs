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

test("every app has smoke routes and a console baseline list", () => {
  for (const app of listApps()) {
    assert.ok(Array.isArray(app.smokeRoutes) && app.smokeRoutes.length >= 4, `${app.key} smokeRoutes`);
    assert.ok(app.smokeRoutes.every((r) => r.startsWith("/")), `${app.key} routes are paths`);
    assert.ok(Array.isArray(app.consoleBaseline), `${app.key} consoleBaseline`);
  }
});

test("bsr console baseline matches the realtime websocket error on dev and on prod", async () => {
  const { withoutBaseline } = await import("../lib/console-baseline.mjs");
  const base = getApp("bsr").consoleBaseline;
  const dev = "WebSocket connection to 'wss://jbarlcajqpbzbhvbxaci.supabase.co/realtime/v1/websocket?apikey=x' failed";
  const prod = "WebSocket connection to 'wss://tesgvrcgcyadownahujh.supabase.co/realtime/v1/websocket?apikey=x' failed";
  assert.deepEqual(withoutBaseline([dev, prod, "TypeError: boom"], base), ["TypeError: boom"]);
});
