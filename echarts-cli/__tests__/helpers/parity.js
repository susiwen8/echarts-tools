const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const { resolveBinary } = require('../../scripts/rust-tools');

const repoRoot = path.resolve(__dirname, '..', '..');
const jsBinPath = path.join(repoRoot, 'bin', 'echarts.js');
const rustManifestPath = path.join(repoRoot, 'Cargo.toml');
const rustBinPath = path.join(
  repoRoot,
  'target',
  'debug',
  process.platform === 'win32' ? 'echarts.exe' : 'echarts'
);
const rustBuildDataBinPath = path.join(
  repoRoot,
  'target',
  'debug',
  process.platform === 'win32' ? 'echarts-build-data.exe' : 'echarts-build-data'
);

let rustBuildResult = null;
let rustBuildDataResult = null;

function normalizeEnv(extraEnv) {
  return {
    ...process.env,
    ...(extraEnv || {})
  };
}

function spawnResult(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
    env: normalizeEnv(options.env)
  });
}

function runNodeScript(scriptPath, args = [], options = {}) {
  return spawnResult(process.execPath, [scriptPath, ...args], options);
}

function runJsCli(args, options = {}) {
  return runNodeScript(jsBinPath, args, options);
}

function ensureRustBinary() {
  if (rustBuildResult) {
    return rustBuildResult;
  }

  assert.ok(fs.existsSync(rustManifestPath), `Missing Cargo manifest at ${rustManifestPath}`);
  fs.mkdirSync(path.dirname(rustBinPath), { recursive: true });
  const cargoBinary = resolveBinary('cargo');

  const cargoVersion = spawnResult(cargoBinary, ['--version'], { cwd: repoRoot });
  assert.equal(
    cargoVersion.status,
    0,
    [
      'Cargo is not ready for building the Rust CLI.',
      cargoVersion.stderr || cargoVersion.stdout || 'cargo probe failed without output'
    ].join('\n')
  );

  const cargoBuild = spawnResult(cargoBinary, ['build', '--quiet', '--bin', 'echarts'], {
    cwd: repoRoot,
    timeout: 120000
  });

  assert.equal(
    cargoBuild.status,
    0,
    [
      'cargo build failed.',
      cargoBuild.stderr || cargoBuild.stdout || 'cargo build failed without output'
    ].join('\n')
  );
  assert.ok(fs.existsSync(rustBinPath), `Missing Rust CLI binary at ${rustBinPath}`);

  rustBuildResult = {
    mode: 'cargo',
    ...cargoBuild
  };
  return rustBuildResult;
}

function runRustCli(args, options = {}) {
  ensureRustBinary();
  return spawnResult(rustBinPath, args, options);
}

function ensureRustBuildDataBinary() {
  if (rustBuildDataResult) {
    return rustBuildDataResult;
  }

  assert.ok(fs.existsSync(rustManifestPath), `Missing Cargo manifest at ${rustManifestPath}`);
  fs.mkdirSync(path.dirname(rustBuildDataBinPath), { recursive: true });
  const cargoBinary = resolveBinary('cargo');

  const cargoVersion = spawnResult(cargoBinary, ['--version'], { cwd: repoRoot });
  assert.equal(
    cargoVersion.status,
    0,
    [
      'Cargo is not ready for building the Rust build-data binary.',
      cargoVersion.stderr || cargoVersion.stdout || 'cargo probe failed without output'
    ].join('\n')
  );

  const cargoBuild = spawnResult(cargoBinary, ['build', '--quiet', '--bin', 'echarts-build-data'], {
    cwd: repoRoot,
    timeout: 120000
  });

  assert.equal(
    cargoBuild.status,
    0,
    [
      'cargo build for echarts-build-data failed.',
      cargoBuild.stderr || cargoBuild.stdout || 'cargo build failed without output'
    ].join('\n')
  );
  assert.ok(fs.existsSync(rustBuildDataBinPath), `Missing Rust build-data binary at ${rustBuildDataBinPath}`);

  rustBuildDataResult = {
    mode: 'cargo',
    ...cargoBuild
  };
  return rustBuildDataResult;
}

function runRustBuildData(args = [], options = {}) {
  ensureRustBuildDataBinary();
  return spawnResult(rustBuildDataBinPath, args, options);
}

function formatCaseLabel(args, options = {}) {
  const argv = args.length ? args.join(' ') : '(no args)';
  return `${argv}${options.cwd ? ` [cwd=${options.cwd}]` : ''}`;
}

function parseJsonOutput(result, caseLabel, role) {
  try {
    return JSON.parse(result.stdout);
  }
  catch (error) {
    assert.fail(
      [
        `${role} stdout was not valid JSON for ${caseLabel}`,
        error.message,
        result.stdout
      ].join('\n')
    );
  }
}

function assertCliParity({
  args,
  oracleRunner = runJsCli,
  candidateRunner = runRustCli,
  oracleOptions,
  candidateOptions,
  label,
  mode = 'exact'
}) {
  const caseLabel = label || formatCaseLabel(args, candidateOptions || oracleOptions || {});
  const oracle = oracleRunner(args, oracleOptions);
  const candidate = candidateRunner(args, candidateOptions);

  assert.equal(candidate.status, oracle.status, `Exit code mismatch for ${caseLabel}`);
  assert.equal(candidate.stderr, oracle.stderr, `stderr mismatch for ${caseLabel}`);

  if (mode === 'json') {
    assert.deepEqual(
      parseJsonOutput(candidate, caseLabel, 'Candidate'),
      parseJsonOutput(oracle, caseLabel, 'Oracle'),
      `JSON payload mismatch for ${caseLabel}`
    );
    return;
  }

  assert.equal(
    candidate.stdout,
    oracle.stdout,
    [
      `stdout mismatch for ${caseLabel}`,
      '--- oracle ---',
      oracle.stdout,
      '--- candidate ---',
      candidate.stdout
    ].join('\n')
  );
}

function createPackagedFixture({
  entries = ['bin', 'src', 'data', 'package.json'],
  includeNodeModules = true
} = {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echarts-cli-parity-'));

  for (const name of entries) {
    const source = path.join(repoRoot, name);
    const target = path.join(fixtureRoot, name);
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      fs.cpSync(source, target, { recursive: true });
    } else {
      fs.copyFileSync(source, target);
    }
  }

  if (includeNodeModules) {
    fs.cpSync(path.join(repoRoot, 'node_modules'), path.join(fixtureRoot, 'node_modules'), {
      recursive: true
    });
  }

  return fixtureRoot;
}

module.exports = {
  assertCliParity,
  createPackagedFixture,
  ensureRustBinary,
  jsBinPath,
  repoRoot,
  runJsCli,
  runNodeScript,
  runRustCli,
  runRustBuildData,
  rustBinPath,
  rustBuildDataBinPath,
  rustManifestPath,
  ensureRustBuildDataBinary,
  spawnResult
};
