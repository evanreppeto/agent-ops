import { buildMarker } from "./qa-marker.mjs";

const HEAD = {
  pass: { emoji: "✅", words: "QA passed" },
  fail: { emoji: "❌", words: "QA failed" },
  blocked: { emoji: "⚠️", words: "QA couldn't test" },
};

/** Console errors go inside `code spans`: no backticks, one line each. */
function cleanConsoleError(e) {
  return String(e).replace(/`/g, "'").replace(/\r\n|\r|\n/g, " ");
}

/** A code fence longer than any backtick run inside `src`. */
function fenceFor(src) {
  const longest = Math.max(0, ...(src.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

export function buildReport(r) {
  const head = HEAD[r.verdict];
  if (!head) throw new Error(`Bad verdict "${r.verdict}"`);
  const plan = r.plan ?? [];
  const steps = r.steps ?? [];
  const consoleErrors = r.consoleErrors ?? [];
  const lines = [
    `## ${head.emoji} ${head.words} — ${r.ticketId}`,
    "",
    r.summary,
    "",
    `**App:** ${r.appName} (${r.devUrl}) · **PR:** ${r.prUrl} · **Commit:** \`${r.mergeSha.slice(0, 7)}\``,
  ];
  if (r.blockedReason) lines.push("", `**Why:** ${r.blockedReason}`);
  if (plan.length) {
    lines.push("", "### What I tested");
    plan.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  if (steps.length) {
    lines.push("", "### Steps");
    for (const s of steps) {
      lines.push("", `**${s.title}**`);
      if (s.note) lines.push(s.note);
      if (s.imageUrl) lines.push(`![${s.title}](${s.imageUrl})`);
    }
  }
  lines.push("");
  if (consoleErrors.length) {
    lines.push("**Console errors:**");
    consoleErrors.forEach((e) => lines.push(`- \`${cleanConsoleError(e)}\``));
  } else {
    lines.push("**Console errors:** none");
  }
  if (r.specSource) {
    const src = String(r.specSource).trimEnd();
    const fence = fenceFor(src);
    lines.push("", "### Test source", "", `${fence}js`, src, fence);
  }
  lines.push("", buildMarker({ sha: r.mergeSha, verdict: r.verdict }));
  return lines.join("\n");
}

/** Slack treats <...> as links/mentions and & as an entity start, so escape them in free text. */
function slackEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildSlackLine({ ticketId, title, verdict, ticketUrl, summary }) {
  const head = HEAD[verdict];
  if (!head) throw new Error(`Bad verdict "${verdict}"`);
  return `${head.emoji} *${ticketId}* ${slackEscape(title)} — ${head.words}: ${slackEscape(summary)} <${ticketUrl}|Open ticket>`;
}
