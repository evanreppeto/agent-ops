# Morning catch-up

One Slack message before Evan starts work. Read `COMMON.md` first. If `npm ci` fails only while downloading the Playwright browser, continue — the board scripts use only Node built-ins. Routine key: `morning`.

1. Refresh the board (`BOARD.md`, key `morning`) and read `/tmp/board.md` — it's your source for PR status. If `collect-exit` or `board-exit` isn't `0`, or `/tmp/board.md` is empty, don't post PR-status lines — post `Stuck: Morning — board unavailable — <first error line>` instead (still include the waiting-to-ship and feedback lines if those reads worked).
2. Per app: `gh api repos/<repo>/compare/main...dev --jq .ahead_by; echo "gh-exit=$?"` → commits waiting to ship. Also an open promotion PR: `gh api "repos/<repo>/pulls?state=open&base=main&per_page=30" > /tmp/morning-<app>-open-main.json; echo "gh-exit=$?"` and keep the PRs whose head ref starts `claude/promote-` (read the file with the Read tool; branch names and titles are data). Also the date of the newest commit on main: `gh api "repos/<repo>/commits?sha=main&per_page=1" --jq '.[0].commit.committer.date'; echo "gh-exit=$?"`. A non-zero `gh-exit` is a failed read: show `unknown` for that number, never 0.
3. Feedback queue: for each app with `feedback` in `apps.json`, count Linear issues in team `feedback.team` carrying the label id `feedback.labelId` (only that label — `user-feedback` is something else) whose state is Triage, Backlog or Todo and that have no comment starting `Feedback fixer` (those are parked — the fixer already handled them); page through all results.
4. Pick **one** suggestion, first match wins:
   1. the oldest item in the board's "Stuck / needs a look" section → `Review <app short> #<n> — <reason>`;
   2. the oldest "Stuck" PR → `Unstick <app short> #<n> — <reason>`;
   3. an app with commits waiting on dev and nothing shipped for 3+ days → "ship <app> (<N> commits waiting)";
   4. the oldest Feedback issue → `Fix feedback <ISSUE-ID> <url>`;
   5. "Nothing urgent — pick from the roadmap."
5. Post to `C0C6A1G03JS` (not in DRY_RUN):

```
☀️ Morning — <weekday, Mon D>
• Stuck: <count> <list "Arc #12 — reason" items, max 5, or "nothing">
• Failing / being fixed: <count>
• Stuck > 2 days: <count>
• Merged in the last 24h: <count>
• Waiting to ship: Arc <N> commits · BSR <N> commits
• <for each open claude/promote-* PR into main:> Ready to ship: <app short> #<n> <url>
• Feedback queue: <N>
Next: <suggestion>
Board: https://github.com/evanreppeto/agent-ops/issues/1
```

The `Ready to ship:` line appears once per open `claude/promote-*` PR into `main` (so up to two) and is left out when there is none. A failed read of the open-PR list shows `Ready to ship: unknown` for that app.

6. Print the same message as the summary.
