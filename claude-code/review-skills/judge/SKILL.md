---
name: judge
description: >-
  Independently triage review findings and decide what happens next. Use when
  judging a review report, auditing a judgement, or applying a judgement to a
  review loop or an automated workflow. Ask the owner to decide only for the
  six items on the stop list.
---

# Judge

Block acceptance on defects that real users or normal operators can hit. Record other confirmed findings on a hardening list. The reviewer finds problems, the judge decides which findings block acceptance, and the stop list determines when to ask the owner.

## 0. Independence

- The judge is independent of the builder, reviewer and briefer and has seen none of their working context.
- Use a different model family from the reviewer. If the judge and builder share a family, disclose it in the output. An auditor from a third family samples that judgement.
- Give the judge the artefacts and the question. If given rebuttals, the round number, budget spent or pressure to ship, ignore them and report that in one line.
- Record one judgement per SHA and pass.

If an independence requirement fails, output `next.action: HALT, reasonCodes: [judge_independence_violated]` and stop.

## 1. Stage A: per finding

1. Deduplicate by root cause. Give each finding a stable mechanism key (`area.mechanism`) and reuse keys from earlier tables. Report merges and splits.
2. Check each scenario independently. Find the trigger in the product and read the relevant path at the reviewed SHA.
3. Set likelihood and severity independently.

   | Likelihood | Evidence and trigger |
   |---|---|
   | L1 | Default path or configuration. Requires a trigger anchor and a trace or reproduction. |
   | L2 | A documented option, a standard edge case, a zone checklist item or an anonymous client on a public surface. Requires a trigger anchor and a trace or reproduction. |
   | L3 | Two independent normal conditions coincide, such as a timing window or a non-default configuration combined with an action. A legacy upgrade can also qualify. |
   | L4 | Requires a hostile same-user process, fault injection, power loss, a double fault or clock skew. |

   With no trigger anchor or with inferred evidence alone, the likelihood is at most L3.

   | Severity | Consequence |
   |---|---|
   | S1 | Incorrect money movement, data loss or corruption, exposure of private data or a secret, an irreversible send twice or to the wrong target, a real-store write under dry-run, or a security boundary crossed. |
   | S2 | A core feature breaks or silently returns a wrong result. |
   | S3 | Visible and recoverable failure. |
   | S4 | Cosmetic issue. |

4. Apply the base table.

   | | S1 | S2 | S3 | S4 |
   |---|---|---|---|---|
   | L1 | FIX | FIX | FIX | TICKET |
   | L2 | FIX | FIX | FIX if size S, otherwise TICKET | TICKET |
   | L3 | FIX if size S, otherwise TICKET | TICKET | TICKET | TICKET |
   | L4 | TICKET | TICKET | TICKET | TICKET |

5. Apply these overrides in order.

   1. **Risk zone.** In a MONEY, SPEND, AUTH, DATA, STORE or SENDS file, L3 S1 is FIX at any size. L3 S2 is FIX if size S.
   2. **Regression of an earlier fix.** Never TICKET at L1 or L2. If the earlier fix addressed an L3 or L4 item, mark REVERT.
   3. **Pre-existing and still outside the change's reach.** Mark TICKET for this unit. Flag an L1 or L2 S1 as `hotfix_unit`.
   4. **Design signal.** Mark DESIGN if the mechanism has already been fixed in two passes or if the fix is size L.
   5. **Claim mismatch.** For a documented claim the code fails to deliver at L3 or L4, narrow the claim. If the owner approved the claim, flag `stop_item: 5`.
   6. **Reproduction for high-impact fixes.** For an S1 FIX at L1 or L2, supply a reproduction or failing test. Drop to L3 if neither can be produced.

6. Mark NOT-REAL only with a guard that prevents the scenario (`file:line`), a missing trigger with where you looked, a quoted threat-model clause with its path, or the line the reviewer misread. The following are insufficient alone: unlikely, edge case, theoretical, narrow window, acceptable risk, unusual timing, or pre-existing without evidence of reachability.
7. Keep each reason under 200 characters and include at least one anchor a second reader can check in five minutes. Use a `file:line` reference at the SHA, a test name, a command with its output, or a quoted clause with its path.

### 1.1 Optional automated first pass

Where a workflow already provides an automated classifier, normalise the records first. Set zones from `review_zones`, cap likelihood at L3 without a trigger anchor, use the mechanism history for recurrence and use the last fix diff for regressions. The classifier returns probabilities for `fix_now`, `ticket`, `not_real` and `escalate`. It receives neither the round number nor the budget.

- A `fix_now` probability of at least 0.15 raises the finding to FIX.
- An `escalate` probability of at least 0.20 routes the finding to the judge.
- The classifier may assign TICKET on its own only outside zones, at S3 or S4, with a `ticket` probability of at least 0.90, a `fix_now` probability below 0.05 and an anchor attached by the rules.
- It may assign NOT-REAL on its own only in autonomous mode, under the same conditions, using a `not_real` probability of at least 0.90 and a threat-model clause or missing-trigger anchor.
- Route all remaining rows to the judge, including zone rows, S1 and S2 rows without FIX, rows whose highest probability is below 0.80, and rows with no anchor.

Record classifier probabilities for audit. The judge uses artefacts as evidence. These thresholds are placeholders pending calibration against a benchmark.

## 2. Stage B: next action

The briefer or workflow applies the first matching rule using the Stage A judgement. An automated decision step can use these rules to choose among its available options.

1. **HALT** if the kill switch has been set, a secret is found or a test has been weakened.
2. **ESCALATE** to the owner for a stop-list item. Present the options and the preferred one.
3. If the acceptance check has not run or is failing at this SHA, send it back to the builder to run or fix before review.
4. **PARK** when a hard budget is spent. Budgets may cover passes, tokens, spend, elapsed time or decision attempts.
5. If a detector fires, take the next unused response for the mechanism in this sequence: design, revert, switch model family, split, park.

   | Detector | Trigger and response |
   |---|---|
   | Repeat | A mechanism marked FIX last pass is marked FIX again. Redesign it. |
   | Regression | A FIX row comes from the last fix diff. Revert if that fix addressed a TICKET-class finding. Otherwise redesign it. If at least half the findings are regressions, revert the whole fix diff. |
   | Flat | The open FIX count has stopped falling for two passes. Split the work. |
   | Scope creep | The fix diff touches files that no FIX row named. Revert those hunks first. |

6. **FIX** if FIX or REVERT rows remain, then run a verification pass.
7. **ACCEPT** when only TICKET and NOT-REAL rows remain. Commit the TICKET rows to `HARDENING-LIST.md` in the same step.

A zone S1 FIX that exhausts the available responses triggers stop item 3.

If none of these rules matches and DESIGN rows remain, use the REDESIGN verdict from `review-levels` to reroute to design.

## 3. The six items that require an owner decision

1. **Irreversible or external action.** Merge to the default branch, deploy, write to or migrate a production database, send to anyone outside the team, publish, force-push, delete remote data or grant access.
2. **Spend or live money movement.** Spend beyond the run budget or global daily cap, or move any live money.
3. **Unresolved zone S1.** A zone S1 is marked TICKET, a second judge from another family disagrees with a NOT-REAL decision for a zone S1, or the available responses are exhausted for a zone S1 FIX.
4. **Missing prerequisite.** A required credential, access or service capability is missing.
5. **Change to an owner-approved decision.** This includes the threat model, acceptance criteria, a promise in the spec, a decision record, the licence or customer-facing wording. Narrowing an approved promise counts.
6. **Conflicting approved sources.** Two approved sources contradict each other and the choice changes behaviour. Quote both.

Only the owner can authorise a break-glass exception directly. Record the decision and its expiry for the specific occurrence or run.

## 4. Judgement output

```yaml
judgement:
  unit: <unit or run/step/attempt identifiers>
  sha: <40-character SHA>
  pass: <n>
  judge: {agent: <name>, family: <family>, model: <id>}
  reviewer: {family: <family>}
  builder: {family: <family>}
  findings:
    - id: <finding id>
      mechanism: <area.mechanism>
      zone: <zone or none>
      L: <L1 to L4>
      S: <S1 to S4>
      evidence: <reproduced, traced or inferred, with details>
      trigger: <anchor>
      origin: <introduced, made reachable or pre-existing>
      regression_of: <id or null>
      recurs: <yes or no>
      fix_size: <S, M or L>
      disposition: <FIX, REVERT, DESIGN, TICKET or NOT-REAL>
      decided_by: <rules, classifier or judge>
      reviewer_L_S: <reviewer's ratings>
      reason: <checkable reason>
      classifier: {fix_now: <p>, ticket: <p>, not_real: <p>, escalate: <p>, version: <id>} # when used
  merged: [<id> into <id>]
  counts: {fix: <n>, revert: <n>, design: <n>, ticket: <n>, not_real: <n>}
  flags: {hotfix_unit: [<ids>], stop_item: <1..6 or null>}
  next: # stage A leaves this empty and stage B fills it
    action: ACCEPT | FIX | REROUTE | PARK | ESCALATE | HALT
    rung: design | revert | switch_family | split | null
    stop_item: <1..6 or null>
    reasonCodes: [...]
    detectors: {repeat: <yes or no>, flat: <yes or no>, regression: <yes or no>, creep: <yes or no>}
    budget: {passes: <n>, tokens: <n>, spend: <amount>, elapsed_hours: <n>}
```

## 5. Brief for the Stage A judge

```text
JUDGE <unit> at <40-character SHA>, level <STANDARD|DEEP>, zones <review_zones output>.
You are independent of the builder, reviewer and briefer. Load the judge skill and do Stage A only.
Inputs:
- Review report <path>
- Diff <base>..<sha> and repository at <sha>
- Approved threat model <quote and path>
- Acceptance criteria <quote>
- Earlier judgement tables <paths>
Assess the artefacts on their own evidence. Leave next empty. Do not edit code or write files. Return the §4 block.
```

The briefer records the pass number with the returned judgement.

## 6. Applying the judgement

**Review loop.** The briefer launches an independent judge, applies Stage B and appends the full block to `<review-folder>/JUDGEMENTS.md`. The auditor from a third family re-judges every zone S1 marked TICKET or NOT-REAL, every merge and a 20% sample of the rest. Use the stricter judgement. A disagreement on a zone S1 triggers stop item 3. Ask the owner only about stop-list items. Include the rest in the regular digest.

**Automated workflow.** Run the independent judge after the reviewer's handoff. Store the judgement as a private artefact and apply Stage B with deterministic workflow rules. If a finding's anchors fail to resolve at the reviewed SHA, mark the row FIX. Keep the decision and reason codes in the workflow record with a private reference to the supporting rationale. If automated classification is enabled, use the model for raising findings and route unsupported judgements to the independent judge. Apply the stop list to review escalations. Send workflow decisions reserved for the owner or run in supervised mode to the owner as configured. Otherwise the decider uses Stage B to choose one of the step's options.

## 7. Calibration examples

| Case | L | S | Zone | Result |
|---|---|---|---|---|
| A dry-run import command creates a table during start-up. | L1 | S1 | STORE | FIX |
| A routine read failure is reported as success and the synchronisation checkpoint advances past records that were skipped. | L2 | S1 | STORE | FIX |
| A settings sync repeatedly overwrites an edit made between a read and a write. | L3 | S1 | STORE | DESIGN by changing how the sync handles user edits. |
| A retry change for a rare migration race makes ordinary restarts send duplicate notifications. | L1 | S1 | SENDS | FIX and revert the retry change if it served only the rare case. |
| A directory redirection requires a malicious process running under the same account. | L4 | S1 | STORE | NOT-REAL if the approved threat model excludes that actor. |
| Repeated validation failures have the same root cause across initial submission and recovery paths. | n/a | n/a | STORE | DESIGN around a shared validation point. |

Add an example when a TICKET or NOT-REAL finding later affects a user. Record what the judge got wrong.
