# Agent skills

Skills that work with any coding agent. Each skill is one folder with a `SKILL.md` that every tool below reads in the same format. Tool-specific variations, when a skill needs one, live in a subfolder named after the tool (for example `judge/claude-code/`). Nothing is tool-specific yet.

| Skill | What it does |
| --- | --- |
| [`review`](review/SKILL.md) | The whole review method in one folder: [`levels.md`](review/levels.md) briefs the reviewer (scope, risk zones, capped passes), [`judge.md`](review/judge.md) triages the findings and decides what happens next. |

## Install

Run these from the repository root. Copy only the skills you want.

**Claude Code**

```bash
mkdir -p ~/.claude/skills
cp -R skills/review ~/.claude/skills/
```

**Codex**

```bash
mkdir -p ~/.codex/skills
cp -R skills/review ~/.codex/skills/
```

**Gemini CLI and other agents**

Copy the folders into the tool's skills directory, or point the agent at the `SKILL.md` file in its instructions.

These skills were adapted from a working setup and are available under the [MIT licence](../LICENSE).
