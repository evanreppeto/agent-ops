#!/usr/bin/env node
// Prints open + recently merged PRs (with comment bodies) for every app in apps.json, as JSON.
// Usage: node scripts/collect-prs.mjs > /tmp/prs.json
// GitHub REST only (gh api); every argument is fixed or comes from apps.json / integers.
import { execFileSync } from "node:child_process";
import { listApps } from "../lib/config.mjs";

const run = (args) => execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 256 << 20 });
const all = (path) => JSON.parse(run(["--paginate", "--slurp", path])).flat();

const apps = listApps().map((app) => {
  const open = all(`repos/${app.repo}/pulls?state=open&per_page=100`).map((p) => ({
    number: p.number,
    title: p.title,
    url: p.html_url,
    draft: p.draft,
    base: p.base.ref,
    headSha: p.head.sha,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    labels: p.labels.map((l) => l.name),
    comments: all(`repos/${app.repo}/issues/${p.number}/comments?per_page=100`).map((c) => c.body),
  }));
  const merged = JSON.parse(run([`repos/${app.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`]))
    .filter((p) => p.merged_at)
    .map((p) => ({ number: p.number, title: p.title, url: p.html_url, base: p.base.ref, mergedAt: p.merged_at }));
  return { key: app.key, short: app.short, name: app.name, repo: app.repo, open, merged };
});

process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), apps }, null, 2));
