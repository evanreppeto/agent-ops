#!/usr/bin/env node
// Creates (or resets the password of) the QA login on BSR dev and on Arc's Test Workspace,
// then writes the four *_QA_* values into agent-ops/.env. Passwords are never printed.
//
// Run it yourself from the agent-ops folder:
//   node scripts/create-qa-users.mjs            # both apps
//   node scripts/create-qa-users.mjs --app arc  # one app
//
// It reads BSR_DEV_SUPABASE_URL, BSR_DEV_SERVICE_ROLE_KEY, ARC_SUPABASE_URL, ARC_SERVICE_ROLE_KEY
// from the environment, or from agent-ops/.setup.env (git-ignored), which it deletes after a
// successful run so the service keys don't linger on disk.
//
// Values come from Vercel → project → Settings → Environment Variables:
//   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (BSR: the dev/Preview values).
import { existsSync, readFileSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getApp } from "../lib/config.mjs";
import { REPO_ROOT } from "../lib/paths.mjs";
import { mergeEnv, newPassword, assertSafeTarget } from "../lib/qa-users.mjs";

const FULL_NAME = "QA Agent";

function adminClient(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function findUserByEmail(sb, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

/** Create the auth user, or reset its password if it already exists. */
async function upsertAuthUser(sb, email, password, metadata) {
  const existing = await findUserByEmail(sb, email);
  if (existing) {
    const { data, error } = await sb.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, ...metadata },
    });
    if (error) throw error;
    return { user: data.user, created: false };
  }
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (error) throw error;
  return { user: data.user, created: true };
}

function must({ error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

async function setupBsr(sb, email, password) {
  const { user, created } = await upsertAuthUser(sb, email, password, { full_name: FULL_NAME, role: "admin", approved: true });
  must(
    await sb.from("user_profiles").upsert({
      id: user.id,
      email,
      full_name: FULL_NAME,
      role: "admin",
      approved: true,
      is_portal_client: false,
      can_view_financials: true,
      must_change_password: false,
    }),
    "user_profiles upsert",
  );
  return created;
}

/** Add an active membership row unless one exists; reactivate it if it does. */
async function ensureMembership(sb, table, match, insertRow) {
  const { data, error } = await sb.from(table).select("id").match(match);
  if (error) throw new Error(`${table} lookup: ${error.message}`);
  if (data.length) {
    must(await sb.from(table).update({ status: "active" }).match(match), `${table} reactivate`);
  } else {
    must(await sb.from(table).insert({ ...match, ...insertRow, status: "active", joined_at: new Date().toISOString() }), `${table} insert`);
  }
}

async function setupArc(sb, email, password, app) {
  const { data: workspaces, error } = await sb
    .from("workspaces")
    .select("id, org_id, name")
    .eq("slug", app.testWorkspaceSlug)
    .eq("name", app.testWorkspace);
  if (error) throw new Error(`workspace lookup: ${error.message}`);
  if (workspaces.length !== 1) {
    throw new Error(`Expected exactly one workspace named "${app.testWorkspace}" (slug ${app.testWorkspaceSlug}), found ${workspaces.length}.`);
  }
  const ws = workspaces[0];

  const { user, created } = await upsertAuthUser(sb, email, password, { full_name: FULL_NAME });
  must(await sb.from("profiles").upsert({ id: user.id, email, full_name: FULL_NAME }), "profiles upsert");
  await ensureMembership(sb, "organization_memberships", { org_id: ws.org_id, user_id: user.id }, { role: "member" });
  await ensureMembership(sb, "workspace_memberships", { org_id: ws.org_id, workspace_id: ws.id, user_id: user.id }, { role: "admin" });

  // The QA account must only ever see the test workspace.
  const { data: others, error: othersError } = await sb
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("workspace_id", ws.id);
  if (othersError) throw new Error(`membership check: ${othersError.message}`);
  if (others.length) throw new Error(`QA user is active in ${others.length} other workspace(s) — remove those memberships before using it.`);
  return created;
}

const SETUP = {
  bsr: { urlEnv: "BSR_DEV_SUPABASE_URL", keyEnv: "BSR_DEV_SERVICE_ROLE_KEY", run: setupBsr },
  arc: { urlEnv: "ARC_SUPABASE_URL", keyEnv: "ARC_SERVICE_ROLE_KEY", run: setupArc },
};

const SETUP_ENV = join(REPO_ROOT, ".setup.env");

async function main() {
  if (existsSync(SETUP_ENV)) process.loadEnvFile(SETUP_ENV);
  const flag = process.argv.indexOf("--app");
  const keys = flag === -1 ? ["bsr", "arc"] : [process.argv[flag + 1]];
  for (const key of keys) if (!SETUP[key]) throw new Error(`Unknown app "${key}" (use bsr or arc)`);

  const updates = {};
  for (const key of keys) {
    const app = getApp(key);
    const { urlEnv, keyEnv, run } = SETUP[key];
    const url = process.env[urlEnv];
    const serviceKey = process.env[keyEnv];
    assertSafeTarget(key, url);
    if (!serviceKey) throw new Error(`${keyEnv} is missing`);

    const password = newPassword();
    const created = await run(adminClient(url, serviceKey), app.qaEmail, password, app);
    console.log(`${app.name}: QA user ${app.qaEmail} ${created ? "created" : "already existed — password reset"} on ${new URL(url).host}`);
    updates[app.credsEnv.email] = app.qaEmail;
    updates[app.credsEnv.password] = password;
  }

  const envPath = join(REPO_ROOT, ".env");
  const before = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  writeFileSync(envPath, mergeEnv(before, updates), { mode: 0o600 });
  chmodSync(envPath, 0o600);
  console.log(`Saved ${Object.keys(updates).join(", ")} to ${envPath} (values not shown).`);
  if (existsSync(SETUP_ENV)) {
    rmSync(SETUP_ENV);
    console.log(`Deleted ${SETUP_ENV} (service keys no longer on disk).`);
  }
}

main().catch((err) => {
  console.error(`Stopped: ${err.message}`);
  process.exit(1);
});
