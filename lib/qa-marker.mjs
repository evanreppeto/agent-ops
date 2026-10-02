const VERDICTS = new Set(["pass", "fail", "blocked"]);
const MARKER_RE = /<!-- qa-agent sha=([0-9a-f]+) verdict=(pass|fail|blocked) -->/g;

export function buildMarker({ sha, verdict }) {
  if (!VERDICTS.has(verdict)) throw new Error(`Bad verdict "${verdict}"`);
  return `<!-- qa-agent sha=${sha} verdict=${verdict} -->`;
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
