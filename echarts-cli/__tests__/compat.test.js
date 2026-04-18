const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPackagedFixture,
  runJsCli
} = require('./helpers/parity');

function parseJson(result) {
  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('bare echarts exits 0 with empty stdout and stderr', () => {
  const result = runJsCli([]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('list --kind bogus exits 0 with an empty result set', () => {
  const result = runJsCli(['list', '--kind', 'bogus', '--format', 'json']);
  const payload = parseJson(result);

  assert.deepEqual(payload, { items: [] });
});

test('unknown --format falls back to text output', () => {
  const baseline = runJsCli(['info', 'line']);
  const fallback = runJsCli(['info', 'line', '--format', 'bogus']);

  assert.equal(fallback.status, 0, fallback.stderr || `CLI exited with ${fallback.status}`);
  assert.equal(fallback.stderr, '');
  assert.equal(fallback.stdout, baseline.stdout);
});

test('unsupported --lang falls back to zh docs', () => {
  const result = runJsCli(['option', 'xAxis.type', '--lang', 'bogus', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.doc.lang, 'zh');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.equal(payload.entry.default, "'category'");
});

test('packaged data stays preferred even when env overrides point to missing roots', () => {
  const fixtureRoot = createPackagedFixture();
  const result = runJsCli(['option', 'line', '--format', 'json'], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_REPO_ROOT: pathMissing(),
      ECHARTS_CLI_WEBSITE_ROOT: pathMissing(),
      ECHARTS_CLI_EXAMPLES_ROOT: pathMissing()
    }
  });
  const payload = parseJson(result);

  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.series-line.json');
  assert.match(payload.doc.content, /# option\.series-line/);
});

function pathMissing() {
  return '/definitely/missing/echarts-cli-fixture-root';
}
