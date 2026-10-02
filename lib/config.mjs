import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync(new URL("../apps.json", import.meta.url), "utf8"));

/** @returns {Array<object>} every app, each with its `key` */
export function listApps() {
  return Object.entries(raw).map(([key, app]) => ({ key, ...app }));
}

export function getApp(key) {
  const app = raw[key];
  if (!app) throw new Error(`Unknown app "${key}"`);
  return { key, ...app };
}

/** Which app a GitHub repo ("owner/name") belongs to, or null. */
export function appForRepo(fullName) {
  const wanted = fullName.toLowerCase();
  return listApps().find((a) => a.repo.toLowerCase() === wanted) ?? null;
}
