---
name: review
description: >-
  Run an independent review end to end: brief the reviewer, triage the findings with a separate
  judge, and decide fix, ticket or stop. Use before launching a code, spec or package review and
  when its report returns. Covers standard and deep scope, risk zones from the diff, verification-only
  follow-up passes with caps, and a judge that decides what blocks.
---

# Review: the reviewer and the judge

One method in two parts. The reviewer finds and describes problems. A separate judge decides what happens to each. Keeping them apart stops the same agent from finding a problem and deciding whether it matters.

| Step | Who | File |
| --- | --- | --- |
| 1. Brief and run the review | Reviewer | [levels.md](levels.md): standard or deep scope, risk zones, brief templates, verification passes |
| 2. Triage each finding | Independent judge | [judge.md](judge.md): fix now, ticket or not real; accept, fix, reroute, park, escalate or halt |
| 3. Fix only what triage says | Builder | One scoped round, then one verification pass, then stop |

Load `levels.md` before briefing a reviewer. Load `judge.md` when a report comes back, in a fresh context that has not seen the builder's or reviewer's working.
