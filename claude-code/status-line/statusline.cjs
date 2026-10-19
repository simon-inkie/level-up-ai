#!/usr/bin/env node
'use strict';

const { stripVTControlCharacters } = require('node:util');

const MAX_INPUT_BYTES = 64 * 1024;
const STDIN_TIMEOUT_MS = 3000;

function safeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  // Remove terminal string commands as a whole, including unfinished ones.
  const withoutStrings = value.replace(
    /(?:\x1b[\]P^_X]|[\x90\x98\x9d\x9e\x9f])[\s\S]*?(?:\x07|\x1b\\|\x9c|$)/g, '',
  );
  const clean = stripVTControlCharacters(withoutStrings)
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .trim();
  return Array.from(clean).slice(0, 200).join('') || fallback;
}

function validPercentage(value) {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 100;
}

function render(data, agentName = '') {
  const model = safeText(data?.model?.display_name)
    || safeText(data?.model?.id, 'Claude');
  const directory = safeText(data?.workspace?.current_dir, 'directory unavailable');
  const agent = safeText(agentName);
  const segments = [];
  if (agent) segments.push(`\x1b[36m${agent}\x1b[0m`);
  segments.push(`\x1b[1m${model}\x1b[0m`, directory);

  const context = data?.context_window;
  const used = validPercentage(context?.used_percentage)
    ? context.used_percentage
    : validPercentage(context?.remaining_percentage)
      ? 100 - context.remaining_percentage
      : null;

  if (used === null) {
    segments.push('context unavailable');
  } else {
    const filled = Math.floor(used / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    // Colours are visual cues, independent of any compaction setting.
    const colour = used < 50 ? 32 : used < 80 ? 33 : 31;
    segments.push(`\x1b[${colour}m${bar} ${used}%\x1b[0m`);
  }
  return segments.join(' │ ');
}

function main() {
  const chunks = [];
  let bytes = 0;
  let finished = false;
  const timer = setTimeout(() => finish(null), STDIN_TIMEOUT_MS);

  function finish(data) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    process.stdin.destroy();
    process.stdout.write(render(data, process.env.AGENT_NAME));
  }

  process.stdin.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_INPUT_BYTES) {
      finish(null);
      return;
    }
    chunks.push(chunk);
  });
  process.stdin.on('end', () => {
    if (finished) return;
    try {
      finish(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      finish(null);
    }
  });
  process.stdin.on('error', () => finish(null));
  process.stdout.on('error', () => {
    clearTimeout(timer);
    process.stdin.destroy();
  });
}

module.exports = { render };
if (require.main === module) main();
