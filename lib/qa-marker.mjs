const VERDICTS = new Set(["pass", "fail", "blocked"]);
const SHA_RE = /^[0-9a-f]{40}$/;
// Visible footer line `_qa-agent sha=<sha> verdict=<verdict>_`. Linear can strip HTML comments
// or rewrite the italics, so match the core text and ignore whatever surrounds it.
const MARKER_RE = /qa-agent sha=([0-9a-f]{40}) verdict=(pass|fail|blocked)(?![a-z])/g;

export function buildMarker({ sha, verdict }) {
  if (!VERDICTS.has(verdict)) throw new Error(`Bad verdict "${verdict}"`);
  if (typeof sha !== "string" || !SHA_RE.test(sha)) {
    throw new Error(`Bad sha "${sha}" — need the full 40-char lowercase merge commit sha`);
  }
  return `_qa-agent sha=${sha} verdict=${verdict}_`;
}

export function parseMarkers(commentBodies) {
  return commentBodies.flatMap((body) =>
    [...body.matchAll(MARKER_RE)].map(([, sha, verdict]) => ({ sha, verdict })),
  );
}

/** A ticket needs QA unless a report for this exact merge commit already exists. */
export function needsQa(commentBodies, mergeSha) {
  return !parseMarkers(commentBodies).some((m) => m.sha === mergeSha);
}
