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
    releaseMarker(devSha),
  ];
  return lines.join("\n");
}
