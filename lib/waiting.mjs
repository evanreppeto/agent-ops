// Turns the commits on `main...dev` into the PRs waiting to be promoted. Pure: no I/O.

const SYNC = /sync main into dev|merge branch 'main'|merge branch "main"|merge remote-tracking branch 'origin\/main'/i;

/**
 * commits: newest first, each a full commit message string.
 * Returns [{ number, title, url }] newest first, deduped by PR number.
 */
export function waitingFromCommits(commits, repo) {
  const seen = new Set();
  const out = [];
  for (const message of commits) {
    const [subject = "", second = ""] = String(message).split("\n").map((l) => l.trim()).filter((l, i) => i === 0 || l);
    if (SYNC.test(subject) || SYNC.test(second)) continue;
    let number;
    let title;
    const merge = subject.match(/^Merge pull request #(\d+) from /i);
    const squash = subject.match(/^(.*?)\s*\(#(\d+)\)$/);
    if (merge) {
      number = Number(merge[1]);
      title = second || `PR #${number}`;
    } else if (squash) {
      number = Number(squash[2]);
      title = squash[1] || `PR #${number}`;
    } else continue;
    if (seen.has(number)) continue;
    seen.add(number);
    out.push({ number, title, url: `https://github.com/${repo}/pull/${number}` });
  }
  return out;
}
