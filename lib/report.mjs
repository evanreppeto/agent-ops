import { buildMarker } from "./qa-marker.mjs";

const HEAD = {
  pass: { emoji: "✅", words: "QA passed" },
  fail: { emoji: "❌", words: "QA failed" },
  blocked: { emoji: "⚠️", words: "QA couldn't test" },
};

export function buildReport(r) {
  const head = HEAD[r.verdict];
  if (!head) throw new Error(`Bad verdict "${r.verdict}"`);
  const lines = [
    `## ${head.emoji} ${head.words} — ${r.ticketId}`,
    "",
    r.summary,
    "",
    `**App:** ${r.appName} (${r.devUrl}) · **PR:** ${r.prUrl} · **Commit:** \`${r.mergeSha.slice(0, 7)}\``,
  ];
  if (r.blockedReason) lines.push("", `**Why:** ${r.blockedReason}`);
  if (r.plan.length) {
    lines.push("", "### What I tested");
    r.plan.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  if (r.steps.length) {
    lines.push("", "### Steps");
    for (const s of r.steps) {
      lines.push("", `**${s.title}**`);
      if (s.note) lines.push(s.note);
      if (s.imageUrl) lines.push(`![${s.title}](${s.imageUrl})`);
    }
  }
  lines.push("");
  if (r.consoleErrors.length) {
    lines.push("**Console errors:**");
    r.consoleErrors.forEach((e) => lines.push(`- \`${e}\``));
  } else {
    lines.push("**Console errors:** none");
  }
  lines.push("", buildMarker({ sha: r.mergeSha, verdict: r.verdict }));
  return lines.join("\n");
}

export function buildSlackLine({ ticketId, title, verdict, ticketUrl, summary }) {
  const head = HEAD[verdict];
  if (!head) throw new Error(`Bad verdict "${verdict}"`);
  return `${head.emoji} *${ticketId}* ${title} — ${head.words}: ${summary} <${ticketUrl}|Open ticket>`;
}
