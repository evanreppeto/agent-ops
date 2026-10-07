// Builds the live PR board from collected PR data (scripts/collect-prs.mjs). Pure: no I/O.
import { readPrCheck, fixAttempts } from "./pr-check.mjs";

export const ROUTINES = ["pr-check", "feedback-fixer", "release", "ship-check", "morning"];

const SECTIONS = [
  ["needs_you", "Stuck / needs a look"],
  ["failing", "Failing / being fixed"],
  ["checking", "Checking"],
  ["passed", "Passed, waiting to merge"],
  ["stale", "Stuck > {days} days"],
];
const PAUSE_LABELS = ["hold", "do-not-merge", "wip"];
const DAY = 86400e3;

/** Which board section a PR belongs in, and why. */
export function classify(pr, { now, staleDays, maxFixAttempts }) {
  const labels = pr.labels ?? [];
  const comments = pr.comments ?? [];
  const check = readPrCheck(comments, pr.headSha);
  const tries = fixAttempts(comments);
  const age = now - Date.parse(pr.createdAt);
  let section;
  let reason;
  if (labels.some((l) => PAUSE_LABELS.includes(l)) || /^\[?wip\b/i.test(pr.title)) {
    [section, reason] = ["needs_you", "on hold — remove the label; it resumes on the next push or at 7:30am"];
  } else if (pr.base !== "dev") {
    [section, reason] = ["needs_you", `targets ${pr.base} — only Release merges into main`];
  } else if (labels.includes("needs-human")) {
    [section, reason] = ["needs_you", check.reason ?? "marked needs-human"];
  } else if (check.state === "fail" && tries >= maxFixAttempts) {
    [section, reason] = ["needs_you", `still failing after ${tries} fix attempts`];
  } else if (check.state === "fail") {
    [section, reason] = ["failing", `fix attempt ${tries}/${maxFixAttempts}`];
  } else if (check.state === "pass") {
    [section, reason] = ["passed", check.reason ?? "passed, merge pending"];
  } else if (check.state === "running") {
    [section, reason] = ["checking", "check running"];
  } else {
    [section, reason] = ["checking", "waiting for first check"];
  }
  if (section !== "needs_you" && age > staleDays * DAY) section = "stale";
  return { section, reason, ageDays: Math.floor(age / DAY) };
}

const clean = (t) => String(t ?? "").replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 90);

export function buildBoard(data, opts) {
  const rows = Object.fromEntries(SECTIONS.map(([key]) => [key, []]));
  for (const app of data.apps) {
    for (const pr of app.open) {
      const c = classify(pr, opts);
      rows[c.section].push({ app: app.short, number: pr.number, title: clean(pr.title), url: pr.url, reason: clean(c.reason), ageDays: c.ageDays });
    }
  }
  for (const list of Object.values(rows)) list.sort((a, b) => b.ageDays - a.ageDays);
  const merged = data.apps.flatMap((app) =>
    app.merged
      .filter((m) => opts.now - Date.parse(m.mergedAt) < DAY)
      .map((m) => ({ app: app.short, number: m.number, title: clean(m.title), url: m.url, base: m.base })),
  );
  const waiting = data.apps.map((app) => ({
    app: app.short,
    prs: (app.waiting ?? []).map((w) => ({ number: w.number, title: clean(w.title), url: w.url, held: Boolean(w.held) })),
    holdLabel: app.holdLabel ?? null,
    truncated: Boolean(app.waitingTruncated),
    promotionPr: app.promotionPr ?? null,
  }));
  return { rows, merged, waiting };
}

const WAITING_LIST_MAX = 15;

function renderWaiting(waiting) {
  const total = waiting.reduce((n, w) => n + w.prs.length, 0);
  const out = [`## Waiting to ship (${total})`];
  for (const w of waiting) {
    const ready = w.promotionPr ? ` — Ready to ship: [#${w.promotionPr.number}](${w.promotionPr.url}) — click Merge (Create a merge commit)` : "";
    if (!w.prs.length) {
      out.push(`- ${w.app}: nothing waiting${ready}`);
      continue;
    }
    const held = w.prs.filter((p) => p.held).length;
    const heldNote = held ? ` (${held} held: ${w.holdLabel ?? "on hold"} — Release leaves them out)` : "";
    out.push(`- ${w.app}: ${w.prs.length} PR${w.prs.length === 1 ? "" : "s"} on dev, not in main${heldNote}${ready}`);
    out.push(...w.prs.slice(0, WAITING_LIST_MAX).map((p) => `  - [#${p.number} ${p.title}](${p.url})${p.held ? " — held" : ""}`));
    if (w.prs.length > WAITING_LIST_MAX) out.push(`  - … and ${w.prs.length - WAITING_LIST_MAX} more`);
    if (w.truncated) out.push("  - … older commits not scanned");
  }
  out.push("");
  return out;
}

const fmtTime = (ms, timeZone) =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(ms).replace(/\u202f/g, " ");

export function renderBoard(board, { staleDays, timezone, now, by }) {
  const out = ["# PR board", ""];
  for (const [key, label] of SECTIONS) {
    const list = board.rows[key];
    out.push(`## ${label.replace("{days}", staleDays)} (${list.length})`);
    out.push(...(list.length ? list.map((r) => `- ${r.app} [#${r.number} ${r.title}](${r.url}) — ${r.reason} · ${r.ageDays}d`) : ["- none"]));
    out.push("");
    if (key === "passed") out.push(...renderWaiting(board.waiting ?? []));
  }
  out.push(`## Merged in the last 24h (${board.merged.length})`);
  out.push(...(board.merged.length ? board.merged.map((m) => `- ${m.app} [#${m.number} ${m.title}](${m.url}) → ${m.base}`) : ["- none"]));
  out.push("", `_Last updated ${fmtTime(now, timezone)} ET by ${by}_`);
  return out.join("\n");
}
