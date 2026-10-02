import { mkdirSync, writeFileSync } from "node:fs";
import { listApps } from "./config.mjs";
import { login } from "./login.mjs";
import { AUTH_DIR, authFile } from "./paths.mjs";
import { isReusableAuth } from "./auth-reuse.mjs";

const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

/**
 * Logs into every app that has credentials, reusing a session saved less than 30 minutes ago
 * (fewer Supabase sign-ins, fewer Arc "new sign-in" emails). Apps without credentials get an
 * empty session so their tests fail loudly at the login page — unless a fresh session from
 * earlier in this run is already on disk (the other app's creds are unset on purpose with `env -u`).
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  for (const app of listApps()) {
    const out = authFile(app.key);
    const email = process.env[app.credsEnv.email];
    const password = process.env[app.credsEnv.password];
    const reusable = isReusableAuth(out);
    if (!email || !password) {
      console.warn(`[qa] No ${app.credsEnv.email}/${app.credsEnv.password} — skipping login for ${app.key}`);
      if (!reusable) writeFileSync(out, EMPTY_STATE);
      continue;
    }
    if (reusable) {
      console.log(`[qa] Reusing ${app.key} session from the last 30 minutes`);
      continue;
    }
    await login(app, { email, password }, out);
    console.log(`[qa] Logged into ${app.key}`);
  }
}
