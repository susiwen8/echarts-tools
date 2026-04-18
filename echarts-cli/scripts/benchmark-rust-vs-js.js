#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const { resolveBinary } = require('./rust-tools');
const { assertCliParity, runJsCli, runRustCli } = require('../__tests__/helpers/parity');

const repoRoot = path.resolve(__dirname, '..');
const warmupRuns = Number(process.env.ECHARTS_BENCH_WARMUP || 5);
const measuredRuns = Number(process.env.ECHARTS_BENCH_RUNS || 20);
const cargo = resolveBinary('cargo');

const cases = [
  { name: 'list-json', args: ['list', '--format', 'json'], mode: 'json' },
  { name: 'info-line-json', args: ['info', 'line', '--format', 'json'], mode: 'json' },
  { name: 'example-line-detail-json', args: ['example', 'line', 'line-simple.ts', '--format', 'json'], mode: 'json' },
  { name: 'option-axislabel-tree', args: ['option', 'xAxis.axisLabel', '--tree'], mode: 'exact' },
  { name: 'option-line-xaxis-label-json', args: ['option', 'line', 'xAxis', 'label', '--format', 'json'], mode: 'json' },
  { name: 'option-line-xaxis-grep', args: ['option', 'line.xAxis', '--grep'], mode: 'exact' }
];

function run(command, args, options = {}) {
  const start = process.hrtime.bigint();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
  const end = process.hrtime.bigint();
  return {
    ...result,
    elapsedMs: Number(end - start) / 1e6
  };
}

function checksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  return {
    runs: sorted.length,
    minMs: sorted[0],
    medianMs: median,
    p95Ms: p95,
    maxMs: sorted[sorted.length - 1],
    meanMs: mean
  };
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[index];
}

function ensureReleaseBuild() {
  const result = run(cargo, ['build', '--release', '--quiet', '--bin', 'echarts', '--bin', 'echarts-build-data'], {
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'cargo build --release failed');
  }
}

function rustReleasePath() {
  return path.join(repoRoot, 'target', 'release', process.platform === 'win32' ? 'echarts.exe' : 'echarts');
}

function benchmarkCommand(name, args, mode) {
  assertCliParity({ args, oracleRunner: runJsCli, candidateRunner: runRustCli, label: `${name} parity`, mode });

  const jsCommand = [process.execPath, [path.join(repoRoot, 'bin', 'echarts.js'), ...args]];
  const rustCommand = [rustReleasePath(), args];

  for (let i = 0; i < warmupRuns; i += 1) {
    run(jsCommand[0], jsCommand[1]);
    run(rustCommand[0], rustCommand[1]);
  }

  const jsSamples = [];
  const rustSamples = [];
  let jsResult;
  let rustResult;

  for (let i = 0; i < measuredRuns; i += 1) {
    jsResult = run(jsCommand[0], jsCommand[1]);
    rustResult = run(rustCommand[0], rustCommand[1]);
    if (jsResult.status !== 0 || rustResult.status !== 0) {
      throw new Error(`${name}: benchmark command failed`);
    }
    jsSamples.push(jsResult.elapsedMs);
    rustSamples.push(rustResult.elapsedMs);
  }

  return {
    name,
    args,
    mode,
    outputBytes: Buffer.byteLength(rustResult.stdout || '', 'utf8'),
    outputChecksum: checksum(rustResult.stdout || ''),
    js: stats(jsSamples),
    rust: stats(rustSamples),
    speedupVsJs: stats(jsSamples).medianMs / stats(rustSamples).medianMs
  };
}

function main() {
  ensureReleaseBuild();

  const gitSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).stdout.trim() || 'nogit';
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const outDir = path.join(repoRoot, 'benchmarks', 'js-vs-rust', `${timestamp}-${gitSha}`);
  fs.mkdirSync(outDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha,
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cargo,
      warmupRuns,
      measuredRuns,
      scope: 'CLI-only benchmark'
    },
    cases: cases.map(testCase => benchmarkCommand(testCase.name, testCase.args, testCase.mode))
  };

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = ['# JS vs Rust Benchmark', '', `- Generated: ${report.generatedAt}`, `- Git SHA: ${gitSha}`, `- Warmup runs: ${warmupRuns}`, `- Measured runs: ${measuredRuns}`, '', '| Case | JS median (ms) | Rust median (ms) | Speedup |', '| --- | ---: | ---: | ---: |'];
  lines.splice(6, 0, '- Note: preliminary benchmark snapshot; use together with parity/acceptance evidence, not as a standalone migration verdict.');
  for (const entry of report.cases) {
    lines.push(`| ${entry.name} | ${entry.js.medianMs.toFixed(2)} | ${entry.rust.medianMs.toFixed(2)} | ${entry.speedupVsJs.toFixed(2)}x |`);
  }
  fs.writeFileSync(path.join(outDir, 'summary.md'), `${lines.join('\n')}\n`);

  process.stdout.write(`${path.relative(repoRoot, outDir)}\n`);
}

main();
