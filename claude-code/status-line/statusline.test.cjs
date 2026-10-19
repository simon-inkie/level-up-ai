'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { stripVTControlCharacters } = require('node:util');
const { render } = require('./statusline.cjs');

const script = join(__dirname, 'statusline.cjs');
const fixture = readFileSync(join(__dirname, 'example-input.json'), 'utf8');
const plain = stripVTControlCharacters;

function cli(input, agent = '') {
  const result = spawnSync(process.execPath, [script], {
    input, encoding: 'utf8', env: { AGENT_NAME: agent }, timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  return result.stdout;
}

function contextCli(context_window) {
  return plain(cli(JSON.stringify({ context_window })));
}

test('CLI renders the synthetic fixture with raw official usage and colours', () => {
  const output = cli(fixture);
  assert.equal(plain(output), 'Claude │ /work/demo │ ███░░░░░░░ 35%');
  assert.match(output, /\x1b\[32m/);
});

test('optional generic agent label is supplied by the caller', () => {
  assert.match(plain(cli(fixture, 'demo')), /^demo │ Claude │/);
  assert.doesNotMatch(plain(cli(fixture)), /^demo │/);
});

test('official used percentage wins; remaining is only a valid fallback', () => {
  assert.match(contextCli({ used_percentage: 35, remaining_percentage: 5 }), / 35%$/);
  assert.match(contextCli({ remaining_percentage: 65 }), / 35%$/);
  assert.match(contextCli({ used_percentage: -1, remaining_percentage: 65 }), / 35%$/);
  assert.match(contextCli({ used_percentage: 35.25 }), / 35\.25%$/);
  assert.match(contextCli({ used_percentage: 0 }), /░{10} 0%$/);
  assert.match(contextCli({ used_percentage: 100 }), /█{10} 100%$/);
  assert.match(contextCli({ remaining_percentage: 100 }), / 0%$/);
  assert.match(contextCli({ remaining_percentage: 0 }), / 100%$/);
});

test('invalid percentages never become usage estimates', () => {
  for (const value of [-1, 101, null, '35', true, [], {}, 'NaN', 'Infinity']) {
    assert.match(contextCli({ used_percentage: value }), /context unavailable$/);
    assert.match(contextCli({ remaining_percentage: value }), /context unavailable$/);
  }
  for (const field of ['used_percentage', 'remaining_percentage']) {
    for (const value of ['1e309', '-1e309']) {
      assert.match(plain(cli(`{"context_window":{"${field}":${value}}}`)), /context unavailable$/);
    }
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.match(render({ context_window: { used_percentage: value } }), /context unavailable$/);
  }
});

test('malformed, empty, null and unavailable input all degrade safely', () => {
  for (const input of ['', ' ', '{broken', 'null', '{}', '[]', 'true', '7',
    '{"context_window":null}', '{"context_window":{"context_window_size":200000}}']) {
    assert.equal(plain(cli(input)), 'Claude │ directory unavailable │ context unavailable');
  }
});

test('model id is a fallback and non-string labels are ignored', () => {
  assert.match(plain(cli('{"model":{"id":"Claude"}}')), /^Claude │/);
  assert.equal(plain(cli('{"model":{"display_name":{}},"workspace":{"current_dir":7}}')),
    'Claude │ directory unavailable │ context unavailable');
});

test('terminal escapes, controls and bidi formatting are removed from every label', () => {
  const hostile = '\x1b[2J\x1b]0;injected-title\x07\x1b]8;;https://example.com\x1b\\'
    + '\x1bPpayload\x1b\\\x9b31m\x00\x07\n\r\t\b\u202e\u2066\u2028\u2029demo';
  const output = cli(JSON.stringify({
    model: { display_name: hostile },
    workspace: { current_dir: hostile },
    context_window: { used_percentage: 35 },
  }), hostile.replace(/\x00/g, ''));
  assert.equal(plain(output), 'demo │ demo │ demo │ ███░░░░░░░ 35%');
  assert.doesNotMatch(output.replace(/\x1b\[(?:0|1|31|32|33|36)m/g, ''),
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u);
  assert.match(plain(cli('{"model":{"id":"\\u001b[2Jdemo"}}')), /^demo │/);
  for (const control of ['\x1b]0;unfinished', '\x1bPunfinished', '\x9dtitle\x9c', '\x90data\x9c']) {
    assert.equal(plain(render({ model: { display_name: `demo${control}` } })),
      'demo │ directory unavailable │ context unavailable');
  }
});

test('display fields and stdin input have finite bounds', () => {
  assert.match(plain(cli(JSON.stringify({ model: { display_name: 'a'.repeat(1000) } }))),
    /^a{200} │/);
  assert.equal(plain(cli(' '.repeat(64 * 1024 + 1))),
    'Claude │ directory unavailable │ context unavailable');
});

test('CLI finishes within a bounded time when stdin remains open', { timeout: 6000 }, async () => {
  const started = Date.now();
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { env: { AGENT_NAME: '' } });
    let stdout = '';
    let stderr = '';
    const deadline = setTimeout(() => { child.kill(); reject(new Error('CLI did not time out')); }, 5000);
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.stdin.write('{');
    child.on('close', code => {
      clearTimeout(deadline);
      resolve({ code, stdout, stderr });
    });
  });
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.match(plain(result.stdout), /context unavailable$/);
  assert.ok(Date.now() - started < 5000);
});
