import { mkdirSync, writeFileSync } from "node:fs";
import { listApps } from "./config.mjs";
import { login } from "./login.mjs";

const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

/** Logs into every app that has credentials; others get an empty session so their tests fail loudly at the login page. */
export default async function globalSetup() {
  mkdirSync(".auth", { recursive: true });
  for (const app of listApps()) {
    const out = `.auth/${app.key}.json`;
    const email = process.env[app.credsEnv.email];
    const password = process.env[app.credsEnv.password];
    if (!email || !password) {
      console.warn(`[qa] No ${app.credsEnv.email}/${app.credsEnv.password} — skipping login for ${app.key}`);
      writeFileSync(out, EMPTY_STATE);
      continue;
    }
    await login(app, { email, password }, out);
    console.log(`[qa] Logged into ${app.key}`);
  }
}
