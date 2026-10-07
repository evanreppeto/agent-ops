#!/usr/bin/env node
// Prints open + recently merged PRs (with comment bodies) for every app in apps.json, as JSON.
// Usage: node scripts/collect-prs.mjs > /tmp/prs.json
// GitHub REST only (gh api); every argument is fixed or comes from apps.json / integers.
import { execFileSync } from "node:child_process";
import { listApps } from "../lib/config.mjs";
import { waitingFromCommits, shippedFromMain } from "../lib/waiting.mjs";

const MAX_WAITING_PAGES = 3; // 100 commits a page → newest ~300 commits on main...dev

const run = (args) => execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 256 << 20 });
const all = (path) => JSON.parse(run(["--paginate", "--slurp", path])).flat();

const apps = listApps().map((app) => {
  const open = all(`repos/${app.repo}/pulls?state=open&per_page=100`).map((p) => ({
    number: p.number,
    title: p.title,
    url: p.html_url,
    draft: p.draft,
    base: p.base.ref,
    headRef: p.head.ref,
    headSha: p.head.sha,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    labels: p.labels.map((l) => l.name),
    comments: all(`repos/${app.repo}/issues/${p.number}/comments?per_page=100`).map((c) => c.body),
  }));
  const merged = JSON.parse(run([`repos/${app.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`]))
    .filter((p) => p.merged_at)
    .map((p) => ({ number: p.number, title: p.title, url: p.html_url, base: p.base.ref, mergedAt: p.merged_at }));
  // Commits on dev that main doesn't have. The compare API lists oldest first, so read the LAST pages
  // (the newest commits) and stop after MAX_WAITING_PAGES; the board says when older ones were skipped.
  const compare = (page) =>
    JSON.parse(run([`repos/${app.repo}/compare/main...dev?per_page=100&page=${page}`, "--jq", "{total: .total_commits, messages: [.commits[] | {message: .commit.message, sha: .sha, parents: [.parents[].sha]}]}"]));
  const first = compare(1);
  const lastPage = Math.max(1, Math.ceil(first.total / 100));
  const pages = lastPage <= MAX_WAITING_PAGES ? [first.messages] : [];
  for (let page = 2; page <= lastPage; page++) if (page > lastPage - MAX_WAITING_PAGES) pages.push(compare(page).messages);
  const commits = pages.flat();
  // A partial promotion (held work, apps.json `hold`) cherry-picks onto main, so those PRs stay on
  // main...dev; the "(cherry picked from commit …)" lines on main say which have actually shipped.
  const shipped = shippedFromMain(JSON.parse(run([`repos/${app.repo}/commits?sha=main&per_page=100`, "--jq", "[.[].commit.message]"])));
  const waiting = waitingFromCommits(commits.reverse(), app.repo, { shipped, hold: app.hold });
  const waitingTruncated = lastPage > MAX_WAITING_PAGES;
  const promo = open
    .filter((p) => p.base === "main" && p.headRef.startsWith("claude/promote-"))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const promotionPr = promo ? { number: promo.number, url: promo.url } : null;
  return { key: app.key, short: app.short, name: app.name, repo: app.repo, open, merged, waiting, waitingTruncated, promotionPr, holdLabel: app.hold?.label ?? null };
});

process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), apps }, null, 2));
