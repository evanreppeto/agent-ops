# Morning catch-up

One Slack message before Evan starts work. Read `COMMON.md` first. If `npm ci` fails only while downloading the Playwright browser, continue — the board scripts use only Node built-ins. Routine key: `morning`.

1. Refresh the board (`BOARD.md`, key `morning`) and read `/tmp/board.md` — it's your source for PR status. If `collect-exit` or `board-exit` isn't `0`, or `/tmp/board.md` is empty, don't post PR-status lines — post `⚠️ Morning: board unavailable — <first error line>` instead (still include the waiting-to-ship and feedback lines if those reads worked).
2. Per app: `gh api repos/<repo>/compare/main...dev --jq .ahead_by; echo "gh-exit=$?"` → commits waiting to ship. Also the date of the newest commit on main: `gh api "repos/<repo>/commits?sha=main&per_page=1" --jq '.[0].commit.committer.date'; echo "gh-exit=$?"`. A non-zero `gh-exit` is a failed read: show `unknown` for that number, never 0.
3. Feedback queue: for each app with `feedback` in `apps.json`, count Linear issues in team `feedback.team` carrying the label id `feedback.labelId` (only that label — `user-feedback` is something else) whose state is Triage, Backlog or Todo; page through all results.
4. Pick **one** suggestion, first match wins:
   1. the oldest "Needs you" item → `Review <app short> #<n> — <reason>`;
   2. the oldest "Stuck" PR → `Unstick <app short> #<n> — <reason>`;
   3. an app with commits waiting on dev and nothing shipped for 3+ days → "ship <app> (<N> commits waiting)";
   4. the oldest Feedback issue → `Fix feedback <ISSUE-ID> <url>`;
   5. "Nothing urgent — pick from the roadmap."
5. Post to `C0C6A1G03JS` (not in DRY_RUN):

```
☀️ Morning — <weekday, Mon D>
• Needs you: <count> <list "Arc #12 — reason" items, max 5, or "nothing">
• Failing / being fixed: <count>
• Stuck > 2 days: <count>
• Merged in the last 24h: <count>
• Waiting to ship: Arc <N> commits · BSR <N> commits
• Feedback queue: <N>
Next: <suggestion>
Board: https://github.com/evanreppeto/agent-ops/issues/1
```

6. Print the same message as the summary.
