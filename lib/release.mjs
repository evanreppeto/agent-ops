export function ticketIds(...texts) {
  const seen = [];
  for (const t of texts) for (const m of String(t ?? "").matchAll(/\bbsr-(\d+)\b/gi)) {
    const id = `BSR-${m[1]}`;
    if (!seen.includes(id)) seen.push(id);
  }
  return seen;
}

export function releaseTitle(appKey, date) {
  return appKey === "arc" ? `Promote dev to main: ${date}` : `Release ${date}`;
}

export const releaseMarker = (devSha) => `<!-- release-agent dev=${devSha} -->`;
export const postReleaseMarker = (mainSha) => `<!-- post-release main=${mainSha} -->`;
export const hasMarker = (bodies, marker) => bodies.some((b) => String(b).includes(marker));

// The release's exact ticket set (after blocker/undo filtering), on its own line. The post-release
// check reads ONLY this line to decide which tickets shipped; ids anywhere else in the text are ignored.
const TICKET_ID = /^BSR-\d+$/;
const TICKETS_LINE = /^<!-- release-tickets((?: BSR-\d+)*) -->$/;
export const releaseTicketsLine = (ids) => ["<!-- release-tickets", ...ids.filter((id) => TICKET_ID.test(id)), "-->"].join(" ");

const lines = (text) => String(text ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());

export const hasReleaseTickets = (text) => lines(text).some((l) => TICKETS_LINE.test(l));

export function parseReleaseTickets(text) {
  const found = lines(text).filter((l) => TICKETS_LINE.test(l));
  if (!found.length) return [];
  const [, ids] = found[found.length - 1].match(TICKETS_LINE);
  return [...new Set(ids.split(" ").filter(Boolean))];
}

// The dev commit the release agent tested (last full-sha release-agent marker), or null.
export function parseReleaseDevSha(text) {
  const all = [...String(text ?? "").matchAll(/<!-- release-agent dev=([0-9a-f]{40}) -->/g)];
  return all.length ? all[all.length - 1][1] : null;
}

export function buildReleaseBody({ appName, date, devSha, prs, tickets, migrations, needsEvan, smoke }) {
  const lines = [
    `Promotes \`dev\` to \`main\` for ${appName} — ${date}. Prepared by the release agent; **Evan merges**.`,
    "",
    "**Merge with \"Create a merge commit\" — never squash.**",
    "",
    `### What ships (${prs.length} PR${prs.length === 1 ? "" : "s"})`,
    ...prs.map((p) => `- #${p.number} ${p.title}${p.tickets.length ? ` (${p.tickets.join(", ")})` : ""}`),
    "",
    "### Tickets",
    ...(tickets.length ? tickets.map((t) => `- [${t.id} ${t.title}](${t.url})`) : ["- none linked"]),
    "",
    `### Checks`,
    `- Dev smoke + regression tests: ${smoke.passed} passed, ${smoke.failed} failed (${smoke.specs} spec files), on dev commit \`${devSha.slice(0, 12)}\`.`,
    "",
    "### Migrations",
    ...(migrations.length ? migrations.map((m) => `- \`${m}\``) : ["- none"]),
    "",
    "### Needs Evan before merging",
    ...(needsEvan.length ? needsEvan.map((n) => `- [ ] ${n}`) : ["- nothing"]),
    "",
    releaseTicketsLine(tickets.map((t) => t.id)),
    releaseMarker(devSha),
  ];
  return lines.join("\n");
}
