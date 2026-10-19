# Claude Code status line

Shows the model, working directory, optional generic label and a coloured context bar. Adapted from a working local status line, with no telemetry, file writes or dependencies. Requires Node.js 18 or newer. Local previews and tests make no network or paid calls and need no API tokens.

## Try it locally

From the repository root:

```sh
node claude-code/status-line/statusline.cjs < claude-code/status-line/example-input.json
node --test claude-code/status-line/statusline.test.cjs
```

The synthetic fixture shows Claude, `/work/demo` and 35% context used. Colour support depends on your terminal.

## Set up on Unix, macOS or WSL

Run these commands yourself from the repository root to copy the script:

```sh
mkdir -p "$HOME/.claude"
cp claude-code/status-line/statusline.cjs "$HOME/.claude/statusline.cjs"
```

Back up your existing `~/.claude/settings.json`. Open it and **merge only the `statusLine` object** from [settings.example.json](settings.example.json), preserving all other settings. If it already has a `statusLine`, replace that object deliberately. Never overwrite the whole settings file with the example. If there is no settings file, the example is a valid starting object.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$HOME/.claude/statusline.cjs\""
  }
}
```

For an optional label, launch Claude Code from a shell with a generic name:

```sh
AGENT_NAME=demo claude
```

The script reads that optional variable. It does not require any agent configuration. Native Windows setup is outside the scope of this example; the commands and `$HOME` setting above target Unix shells, including WSL.

## Reading the display

The percentage is the official `context_window.used_percentage`, falling back to `100 - context_window.remaining_percentage` when the used value is unavailable or invalid. Only finite numeric values between 0 and 100 are accepted. Missing or invalid data displays `context unavailable`.

The bar uses the raw official percentage with no compaction buffer adjustment. Bar cells are a coarse visual approximation. Its colours are visual cues, not guaranteed automatic compaction thresholds. Compact when needed for your task rather than at a hard-coded percentage.

Malformed input is handled quietly. Input text is sanitised to prevent terminal control sequences from being displayed. The CLI stops waiting after 3 seconds and accepts at most 64 KiB of stdin. Each text field is limited to 200 Unicode code points.

[Official Claude Code status line documentation](https://code.claude.com/docs/en/statusline), checked 19 October 2026. Examples are provided as is under the repository's MIT licence.
