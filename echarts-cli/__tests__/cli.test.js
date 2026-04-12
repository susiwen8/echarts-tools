const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');

const binPath = path.resolve(__dirname, '..', 'bin', 'echarts.js');

function runCli(args) {
  return spawnSync(process.execPath, [binPath, ...args], {
    encoding: 'utf8'
  });
}

function parseJson(result) {
  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('list returns charts and components in json format', () => {
  const result = runCli(['list', '--format', 'json']);
  const payload = parseJson(result);

  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.some(item => item.name === 'line' && item.kind === 'chart'));
  assert.ok(payload.items.some(item => item.name === 'tooltip' && item.kind === 'component'));
});

test('info resolves chart metadata and related examples', () => {
  const result = runCli(['info', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.name, 'line');
  assert.equal(payload.kind, 'chart');
  assert.equal(payload.optionType, 'LineSeriesOption');
  assert.equal(payload.topLevelKey, 'series[]');
  assert.ok(payload.examples.some(example => example.id === 'line' && example.file === 'line.html'));
});

test('example lists matching html examples', () => {
  const result = runCli(['example', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.ok(Array.isArray(payload.examples));
  assert.ok(payload.examples.some(example => example.id === 'line' && example.file === 'line.html'));
});

test('option returns option metadata for a series', () => {
  const result = runCli(['option', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.name, 'line');
  assert.equal(payload.kind, 'chart');
  assert.equal(payload.optionType, 'LineSeriesOption');
  assert.equal(payload.topLevelKey, 'series[]');
  assert.equal(payload.optionPath, 'series[].type = "line"');
});
