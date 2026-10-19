# Status line examples

Scope: publishable local examples for Claude Code and OpenAI Codex CLI, adapted from a working local setup. Keep installation manual and preserve existing settings. MIT licensed and provided as is.

Claude Code: standalone Node.js renderer for model, directory, optional generic label and coloured official context usage. No telemetry, files, dependencies or compaction buffer adjustment. Reject invalid percentages and sanitise terminal controls. Bound stdin waiting.

Codex: a TOML fragment selecting model with reasoning, context used, context remaining and context window size through the built-in status line.

Test plan: Node CLI and renderer tests covering synthetic input, malformed and empty JSON, null, invalid or missing percentages, terminal controls and stdin timeout. Parse example JSON and TOML. Review all files for public suitability.

Follow-ups: add future episode examples in separate tool/topic directories. Leave final content commit and publication to the maintainer.
