# OpenAI Codex CLI status line

This example configures the built-in terminal status line in OpenAI's Codex CLI. It does not configure the ChatGPT web app and needs no script hook.

## Merge the fragment

Open your existing user configuration, normally `~/.codex/config.toml`. If you have set `CODEX_HOME`, use `config.toml` inside that directory instead.

Back it up, then merge [config.example.toml](config.example.toml):

```toml
[tui]
status_line = ["model-with-reasoning", "context-used", "context-remaining", "context-window-size"]
```

If `[tui]` already exists, update or add `status_line` inside that table. Do not add a duplicate `[tui]` header or overwrite the whole configuration. Preserve its other settings.

The items show model with reasoning, context used, context remaining and context window size in that order. These indicators help you manage context, but do not promise an exact automatic compaction cutoff. Compact when needed for the task rather than using a hard-coded threshold.

The fragment itself requires no API tokens and makes no paid calls. It uses your existing Codex installation and access.

[Official OpenAI Codex configuration reference](https://developers.openai.com/codex/config-reference/), checked 19 October 2026. Examples are provided as is under the repository's MIT licence.
