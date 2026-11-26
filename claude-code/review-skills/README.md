# Review and judge skills

- [`review-levels`](review-levels/SKILL.md) sets the scope for standard and deep reviews, identifies risk zones from the diff and caps follow-up passes at verification.
- [`judge`](judge/SKILL.md) independently triages findings and gives the briefer rules for accepting, fixing, rerouting, parking, escalating or halting the work.

## Install

Run these commands from the repository root for the tool you use.

**Claude Code**

```bash
mkdir -p ~/.claude/skills
cp -R claude-code/review-skills/{judge,review-levels} ~/.claude/skills/
```

**Codex**

```bash
mkdir -p ~/.codex/skills
cp -R claude-code/review-skills/{judge,review-levels} ~/.codex/skills/
```

These examples were adapted from a working setup and are available under the [MIT licence](../../LICENSE).
