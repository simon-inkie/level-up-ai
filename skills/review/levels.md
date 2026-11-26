# Review levels

Block acceptance on defects that real users or normal operators can hit. Ticket other confirmed findings for hardening. Require tests for core features and for changes that put money or other high-impact operations at risk.

## 0. Why reviews keep going

1. Repeating a full review on every pass directs the next reviewer towards progressively rarer scenarios.
2. Fixing a rare scenario can expand the diff and introduce regressions on normal paths.
3. Giving the reviewer the verdict conflates whether a finding is real with whether it should block acceptance.

Use the risk zones to scope coverage, send findings to an independent judge and use subsequent passes to verify fixes.

## 1. Two levels

| | Standard (default) | Deep |
|---|---|---|
| Question | Does it work for real users and operators, including ordinary failures? | Does it hold against the wider threat model written for this release? |
| Edge cases | Check §2.1 everywhere and the checklists in §3 on zone files. | Also apply the fault model in §2.2 within the approved threat model. |
| Passes | One full review and up to two verification passes. | One full review and up to two verification passes. A second full sweep requires the owner's approval. |
| Who invokes it | Default for independent reviews. | The owner at any time, or the briefer on a trigger in §1.1 named in the brief's first line. |

A small diff gets a small standard review. Both levels use the same pass cap and apply the same risk zones. The approved threat model bounds a deep review.

### 1.1 Deep triggers for the briefer

- First public release of a package or subsystem, such as publishing a package, opening a repository to the public or releasing a source archive. Use deep once at the release gate. Review development slices in private CI at standard.
- A new security boundary, such as authentication, sessions, OAuth, API keys, a permission gate or a sandbox.
- A new internet-facing endpoint that moves money or changes entitlements, such as a payment webhook, checkout or an entitlement change.
- A migration or backfill that rewrites or deletes existing customer rows and cannot be undone by a down migration.
- A follow-up to a production incident in that area.

## 2. What each level covers

### 2.1 Standard edge cases

1. Golden path end to end with default configuration.
2. Empty or first-run state, missing optional configuration, or an absent file or row.
3. Ordinary bad input from a normal user, including empty or very long input, Unicode, spaces in paths and the wrong type.
4. A dependency fails once through a network error, a 4xx or 5xx response, a timeout, a refusal or an unreadable file. Surface the failure and preserve prior state. Treat empty or partial output caused by the failure as a failure.
5. The user repeats an action by double-clicking, retrying, rerunning a command or refreshing mid-flow. Prevent double charges, double sends and duplicate writes.
6. Two normal instances run at once, such as two tabs, a second application instance, a stray runner or a scheduled job overlapping a manual run.
7. The process crashes or is killed once mid-operation and then restarts. State is recoverable and nothing is silently lost.
8. Upgrade from the previous version's data or configuration, including existing users and files.
9. Core-feature tests exist and would fail if the feature broke.
10. Errors propagate as failures throughout the changed path.

Leave these out of standard unless a zone checklist names them: a malicious process running as the same user, filesystem swap races needing such a process, power loss, double faults, fsync ordering, clock skew, signal interleavings, exotic mounts, resource exhaustion and mutation testing every test.

### 2.2 Deep fault model

Apply only the cases admitted by the threat model. Check crashes at every write boundary, power loss where the spec claims durability, hostile input on every public surface, package contents, dependency licences, secrets in every artefact and concurrency between every pair of writers the product ships. For local tools, a hostile process running under the same account remains out of scope at either level.

### 2.3 Threat model

Each subsystem has a threat model paragraph which the owner approves once for reuse in every brief. Draft it with someone independent of the builder. The default for local development tools covers crashes, an accidental second instance, buggy callers, and ordinary editors and automations saving files. On a public surface, an anonymous internet client counts as a normal actor.

## 3. Risk zones

Run this on the exact SHAs under review and paste the output verbatim into the brief. The path and changed-line patterns deliberately err on the side of flagging files for a closer look.

```bash
review_zones() (  # usage: review_zones <repo> <base-sha> <head-sha>
  local repo="$1" base="$2" head="$3" files
  files=$(git -C "$repo" -c core.quotePath=false diff --name-only "$base...$head") || return 1
  printf 'review_zones %s %s...%s\n' "$repo" "$base" "$head"

  _zone() {
    local name="$1" path_pattern="$2" line_pattern="$3" file hits
    # Match paths without case sensitivity and changed lines with case sensitivity.
    hits=$(
      while IFS= read -r file; do
        [ -n "$file" ] || continue
        if printf '%s\n' "$file" | grep -iE "$path_pattern" >/dev/null ||
           git -C "$repo" --literal-pathspecs diff --no-color -U0 "$base...$head" -- "$file" |
             sed -n '/^@@/,$p' | grep -E '^[+-]' | grep -E "$line_pattern" >/dev/null; then
          printf '%s\n' "$file"
        fi
      done <<< "$files" | sort -u |
        grep -vE '(^|/)\.notes/|\.mdx?$|(\.test|\.spec|_test)\.[a-z]+$|(^|/)(__tests__|tests?)/'
    ) || return 0
    printf 'ZONE %s\n' "$name"
    printf '%s\n' "$hits" | sed 's/^/  /'
  }

  _zone MONEY 'billing|payment|checkout|subscri|invoice|payout|credit|refund|trial|entitle|quota' \
    'unit_amount|currency|[Pp]ayment_?[Ii]ntent|[Cc]heckout|[Ii]nvoice|[Rr]efund|[Pp]ayout|trial_end|payment_transactions|billing_events|refund_requests|usage_record'
  _zone SPEND 'paid[-_]?api|model[-_]?api|tts|image[-_]?gen|generate' \
    'generateContent|generateImage|images\.generate|textToSpeech|callPaidApi|requestModel'
  _zone AUTH 'auth|oauth|session|login|sign-?in|permission|polic|role|middleware|api[-_]?key|well-known|admin|token|settings(\.local)?\.json|/hooks/' \
    'getUser|requireUser|requireAuth|auth\.(getUser|getSession|admin)|[Jj][Ww][Tt]|[Bb]earer|[Aa]uthorization|service_role|SERVICE_ROLE|SECURITY DEFINER|GRANT |REVOKE |CREATE POLICY|ALTER POLICY|ROW LEVEL SECURITY|BYPASSRLS|superadmin|isAdmin|tenant_id|tenant_roles|api_credentials'
  _zone DATA 'export|publish|public/|contact|newsletter|email|notify|telemetry|error[-_]?report|package\.json|\.npmignore|manifest' \
    'console\.(log|info|warn|error)\(|logger\.|captureException|[Pp]assword|[Ss]ecret|private_|process\.env\.[A-Z_]*(KEY|TOKEN|SECRET)|process\.argv|chmod|/tmp/|customer_records|contact_details|\bemail\b|\bphone\b'
  _zone STORE 'migrations/|\.sql$|backfill|migrat|seed|cron|worker|queue|vector|embed|storage|settings' \
    'INSERT INTO|UPDATE [A-Za-z_."]+ SET|DELETE FROM|DROP (TABLE|COLUMN|INDEX|FUNCTION|POLICY)|TRUNCATE|ALTER TABLE|\.(insert|update|upsert|delete|rpc)\(|[Uu]psert|[Cc]reateCollection|DRY_RUN|[Dd]ryRun|dry-run|NODE_ENV|_LIVE\b|renameSync|unlinkSync|rm -rf|writeFileSync|statement_timeout'
  _zone SENDS 'social|publish|email|notify|webhook|terminal|socket|runner|launcher' \
    'sendEmail|postMessage|postComment|createPullRequest|mergePullRequest|[Ww]ebhook|method: *.POST|send-keys|process\.kill|\.kill\(|SIGTERM|SIGKILL'
)
```

- Apply thorough coverage to every file listed under a zone.
- The briefer may strike a file only with a one-line reason in the brief, for example, “the matched word `update` appears only in a comment”. Keep the file in the zone otherwise. The reviewer can add any zone file the script missed.
- The table names in the patterns are examples, such as `payment_transactions`, `api_credentials` and `customer_records`. Use the project's sensitive tables and add new ones as migrations introduce them.

### 3.1 Coverage in a zone

Apply §2.1 everywhere, starting with the golden path. In each zone file, trace every changed path end to end and include rare but plausible timing and configuration (L3). Check that each guard the zone relies on has a test that fails when the guard is removed, such as a signature, idempotency, authorisation or dry-run check. Limit mutation checks to zone guards. Apply the relevant checklists below.

| Zone | Checklist |
|---|---|
| MONEY | Use minor units, explicit currency and no floating-point rounding. Require an idempotency key on each payment-provider write and verify webhook signatures. Handle duplicate or out-of-order webhooks safely. Check entitlements and plans server-side, cover trial, cancellation, upgrade and downgrade transitions, and keep test and live keys separate. |
| SPEND | Bound each paid API call. Check loops, retries and fan-out. Apply a per-run or per-user cap where users can trigger calls. |
| AUTH | Check the caller server-side for every new route, action, RPC and MCP tool. Scope tenants with row-level security or an explicit tenant filter. Revoke public access to `SECURITY DEFINER` functions. Keep service-role keys off clients and tokens out of logs. Permission gates fail closed. |
| DATA | Keep personal data, secrets and private text out of logs, command arguments, environment variables, error reports, temporary or world-readable files, public output and packaged archives. Scope exports to the tenant and verify that deletion removes the data. |
| STORE | Test that dry-run writes nothing, including on import or module load. Ship migrations before dependent code and keep them within the database connection pool's configured timeout. Make backfills idempotent and resumable. Preserve prior state when an operation fails part-way. Preserve newer content in user-authored files such as notes and settings. |
| SENDS | Send at most once on retry or restart and never send under dry-run or test. Check the recipient, pane or process. Route input only to its intended pane or socket and terminate only processes started by the tool. |

## 4. Step A: review

The reviewer describes every finding with a scenario, likelihood and severity. The triage step assigns dispositions and issues the verdict.

| Likelihood | Frequency under the approved threat model |
|---|---|
| L1 | Every or most normal uses, or the default configuration. |
| L2 | Common enough to occur within a month of normal use. Includes the cases in §2.1, the zone checklists and an anonymous client on a public surface. |
| L3 | Rare but legitimate timing or configuration, such as a narrow race between normal processes, a timed editor save, a legacy upgrade path or an unusual filesystem. |
| L4 | Requires a hostile same-user process, fault injection, power loss, a double fault or clock skew. |

| Severity | Consequence |
|---|---|
| S1 | Money charged or paid wrongly, data lost or corrupted, private data or a secret exposed, an irreversible send twice or to the wrong target, a real-store write under dry-run, or a security boundary crossed. |
| S2 | A core feature breaks or silently returns a wrong result, including reporting success on failure. |
| S3 | Degraded but visible and recoverable, such as a clear error followed by a successful retry. |
| S4 | Cosmetic, inventory, wording or metadata mismatch. |

### 4.1 Brief for standard, pass 1

```text
REVIEW <unit> at <HEAD sha>, base <BASE sha>. Level STANDARD. Pass 1 of at most 3. Passes 2 and 3 are verification only.
Find and describe problems. Give no acceptance verdict or Blocker or Hardening labels.

THREAT MODEL: <paste the approved paragraph for this subsystem>
COVER EVERYWHERE: <paste §2.1, items 1 to 10>
RISK ZONES: <paste review_zones output verbatim, then list any struck files with reasons>
For zone files, trace each changed path end to end. Include rare but plausible timing and check each guard has a test that fails when the guard is removed.
ZONE CHECKLISTS: <paste the §3.1 rows for the fired zones>
Add any zone file the detector missed and mention it in the report.

OUT OF SCOPE: Hostile same-user processes, filesystem swap races, power loss, double faults, fsync ordering, clock skew, signal interleavings and mutation testing outside zone guards, except as specified by the zone checklists. If noticed, give an out-of-scope issue one line under "Noticed, not pursued".
SCOPE: The diff and code it calls directly. Put problems in untouched code under "Pre-existing", one line each, unless this diff makes them newly reachable.

FOR EVERY FINDING:
ID: R1-<n>
Title:
Location: file:line
Zone: <zone or none>
Scenario: actor, a trigger that exists today (name the route, button, command, schedule or API call), what goes wrong, and what the user sees or loses
Evidence: reproduced | traced | inferred, and how
Likelihood: L1 to L4, one line of reasoning
Severity: S1 to S4, one line of reasoning
Origin: introduced by this diff | pre-existing, made reachable | pre-existing
Fix: one line, size S (local, under about 30 lines) | M | L (design change)

<paste the §4 likelihood and severity scales>
OUTPUT: findings, "Noticed, not pursued", "Pre-existing" and at most five lines on what you checked. Do not write files.
```

### 4.2 Brief for deep, pass 1

Use §4.1 with `Level DEEP (trigger: <§1.1 trigger>)`. Replace `OUT OF SCOPE` with the deep fault model from §2.2 bounded by the approved threat model. Retain the exclusion for a hostile same-user process in a local tool. For a public release, explicitly ask for a check of package contents, licences and every shipped artefact for secrets.

### 4.3 Brief for verification, pass 2 or 3

```text
REVIEW <unit> at <NEW sha>. The previous pass reviewed <OLD sha>. Level <STANDARD|DEEP>. Pass <n> of at most 3. VERIFICATION ONLY.
Attached: triage table from pass <n-1>. The fix diff is OLD..NEW.
1. For each FIX row, report FIXED | PARTLY | NOT FIXED. Give a file:line, test name or reproduction.
2. Review the fix diff OLD..NEW for regressions, with the same edge cases and zone rules. Cite any change that no FIX row asked for as scope creep.
3. For NOT-REAL rows, give a reproduction if you can reproduce the finding. Leave the row alone otherwise.
4. Skip unchanged code. Report a new finding outside the fix diff only if it is L1 or L2 and S1 or S2. Explain why pass 1 missed it. Give anything else one line under "Noticed, not pursued".

Use the pass 1 finding format with IDs R<n>-<k>. Give no ACCEPT or REJECT verdict. Do not write files.
```

## 5. Step B: independent triage

Use a fresh independent judge who has seen none of the builder's, reviewer's or briefer's working context. Give the judge the report, the diff, the repository at the reviewed SHA, the approved threat model and prior triage tables. Withhold rebuttals, opinions and justifications. When using the paired `judge` skill, apply its Stage A for the findings and Stage B for the next action. Its six-item stop list determines which decisions go to the owner.

### 5.1 Base table outside zones

| | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| L1 | FIX | FIX | FIX | TICKET |
| L2 | FIX | FIX | FIX if size S, otherwise TICKET | TICKET |
| L3 | FIX if size S, otherwise TICKET | TICKET | TICKET | TICKET |
| L4 | TICKET | TICKET | TICKET | TICKET |

NOT-REAL overrides any cell with proof under §5.3.

### 5.2 Modifiers

Apply in order.

1. **Zone.** In a zone file, L3 S1 is FIX regardless of fix size. L3 S2 is FIX if size S.
2. **Regression of an earlier fix.** Never TICKET at L1 or L2. If an earlier fix for a TICKET-class L3 or L4 finding caused the regression, revert that fix.
3. **Pre-existing and still outside the change's reach.** Mark TICKET for this unit. Flag an L1 or L2 S1 for a separate same-day hotfix and send it to the tech lead.
4. **Design signal.** If the same mechanism produced a finding in two rounds or the fix is size L, mark DESIGN. The briefer chooses whether to simplify the mechanism or narrow the guarantee and raises any scope change for a decision. Use a design change before attempting a third patch on the same mechanism.
5. **Claim mismatch.** If the code fails to deliver a documented claim at L3 or L4, prefer documenting the limitation to adding code. Mark FIX with action `narrow claim`. Changing an owner-approved claim goes to the owner.
6. **Scoped fixes.** Change only what the FIX rows require. Leave TICKET rows for hardening.

### 5.3 Checkable reasons

Give a reason a second reader can check in five minutes for every TICKET at L1 or L2, every NOT-REAL and every change to the reviewer's likelihood or severity. Use a `file:line` reference, a test name, a quoted threat-model or spec clause, or the command and result of a failed reproduction attempt.

- **NOT-REAL** requires a guard that prevents the scenario (`file:line`), a missing trigger with where you looked, a quoted clause that puts it outside the approved threat model, or the line the reviewer misread.
- The following are insufficient alone: unlikely, edge case, theoretical, narrow window, acceptable risk, unusual timing, or pre-existing without evidence of whether the diff makes it reachable.
- An inferred L3 or L4 scenario without a reproduction or trace is TICKET.

### 5.4 Brief for triage

```text
TRIAGE <unit> at <sha>, level <STANDARD|DEEP>, zones <list>.
You are independent of the builder and reviewer. Decide which findings to FIX, TICKET for hardening or mark NOT-REAL.
Inputs: review report <path>, diff <base>..<sha>, repository at <sha>, approved threat model <quote and path>, prior triage tables <paths>.
1. Deduplicate by mechanism. Merge findings with the same root cause and retain the highest likelihood and severity.
2. Find each trigger in the product and read its code path at the reviewed SHA. Set L and S yourself and explain any disagreement.
3. Apply the base table, then the modifiers in order: zone, regression, pre-existing, design signal, claim mismatch and scoped fixes.
4. Give a reason a second reader can check in five minutes. NOT-REAL needs a guard, missing trigger, quoted threat-model clause or misread line.
5. Return the format in §5.5. Do not edit code or write files.
```

### 5.5 Triage output format

```text
TRIAGE <unit> @ <sha> pass <n> level <STANDARD|DEEP> zones <MONEY,STORE,...>

| ID | Title | Zone | L | S | Origin | Recurs | Fix size | Disposition | Action | Reason (checkable) |
|----|-------|------|---|---|--------|--------|----------|-------------|--------|--------------------|
| R1-1 | Dry-run creates a table | STORE | L1 | S1 | new | no | S | FIX | patch | import.js:42 creates the table before checking dry-run |
| R1-2 | Legacy settings fail on an optional path | none | L3 | S2 | new | no | M | TICKET | hardening list | config.js:80 requires both legacy settings and the optional import format |
| R1-3 | Configuration changes during a read | none | L4 | S2 | new | no | M | NOT-REAL | none | threat-model.md:12 excludes a malicious same-user process |

Disagreements with reviewer: R1-2 reviewer L2, triage L3: trigger needs <condition>, see <file:line>.
Merged: R1-5 into R1-1 (same root cause).
Counts: FIX <n> | TICKET <n> | NOT-REAL <n> | DESIGN <n> (previous pass FIX <n>)
Escalation items: <unresolved zone S1 findings, pre-existing L1/L2 S1 hotfixes, scope-changing DESIGN rows, or "none">
Verdict: ACCEPT | FIX-THEN-VERIFY | REDESIGN | ESCALATE
```

Use ACCEPT when FIX and DESIGN are empty and there are no escalation items. Use FIX-THEN-VERIFY when FIX rows exist and a pass remains. Use REDESIGN when DESIGN rows exist. Use ESCALATE at the pass cap with FIX rows left or when there are escalation items. Apply the judge's stop list before asking the owner to decide.

### 5.6 Calibration examples

| Finding | L | S | Zone | Disposition |
|---|---|---|---|---|
| A dry-run import creates a table during start-up. | L1 | S1 | STORE | FIX |
| A routine read error returns success and moves the synchronisation checkpoint past skipped records. | L2 | S1 | STORE | FIX |
| A sync job repeatedly overwrites a settings edit made between reading and writing the file. | L3 | S1 | STORE | DESIGN to preserve user edits, or narrow the guarantee. |
| A fix for a rare migration race makes an ordinary restart resend a notification. | L1 | S1 | SENDS | FIX. Revert the earlier fix if it addressed a TICKET-class case. |
| An optional format fails only when importing legacy settings, with a medium-sized fix. | L3 | S2 | none | TICKET |
| A recent fix breaks packaging on the normal build path. | L1 | S2 | none | FIX |
| Redirecting a local database path mid-open requires a malicious process running under the same account. | L4 | S1 | STORE | NOT-REAL if the approved threat model excludes that actor. |
| A rare race leaves a completed operation visibly overdue and the user can retry it. | L3 | S3 | none | TICKET |

### 5.7 Remote reviews

Send findings from a bot or a human on a pull or merge request through the same triage step. The builder gives the briefer every raw discussion thread and waits for an independent judgement before fixing, ticketing or acknowledging a finding. Read the threads even when the latest review reports no actionable comments or the reviewer marked threads resolved. Put the judge's table on the request before merging.

## 6. Passes and stop rules

- **Pass 1.** Full review at the chosen level, then triage.
- **Pass 2.** Verify the fix diff under §4.3, then triage.
- **Pass 3.** Verification only. Run it if pass 2 leaves open a FIX row it was asked to verify or finds a regression.
- **Pass cap.** If FIX rows remain after pass 3, stop and escalate with the open rows and a preferred action. The tech lead handles escalation within the review workflow. Use the judge's stop list for any decision that goes to the owner.
- **Early stop.** Redesign or escalate when the FIX count fails to fall from one pass to the next, or at least half of a pass's new FIX rows are regressions from the previous pass's fixes.
- Every fresh reviewer on the same SHA counts as a pass.
- Deep uses the same cap. A second full deep sweep requires the owner's approval.

## 7. After the verdict

- **ACCEPT.** Append every TICKET row to `HARDENING-LIST.md` as `- [ ] <unit> <ID> L<x>/S<y> <zone> <title> (<report path>)` and commit the list in the same step. Acceptance follows the commit.
- **Escalation.** Raise the listed escalation items or an ESCALATE verdict. A clean ACCEPT needs no escalation.
- **Calibration.** When a TICKET or NOT-REAL finding later affects a user, add it to §5.6 and record what triage got wrong.

## 8. Checks by role

| Role | Temptation | Check |
|---|---|---|
| Reviewer | Invent a plausible scenario | Name a trigger that exists in the product and state the evidence level. An inferred L3 or L4 is TICKET. |
| Reviewer | Adjust ratings to obtain a verdict | The reviewer reports findings and triage sets L and S independently. |
| Triage | Rubber-stamp or dismiss a finding | Require checkable evidence for NOT-REAL. Verification may reproduce the finding. Apply the stop list to unresolved zone S1 findings. |
| Briefer | Shrink scope to get acceptance | Paste `review_zones` output on named SHAs verbatim. Give a reason for every struck file and use the owner-approved threat model. |
| Briefer | Rerun with fresh reviewers until one accepts | Count every pass on the same SHA towards the cap. |
| Builder | Fix TICKET rows in passing | Limit fixes to the FIX rows. Verification flags unrequested changes. |
| Anyone | Split or merge issues to move counts | Deduplicate by mechanism and report merges. |
