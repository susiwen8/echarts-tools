#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts', 'platform-packages.json'), 'utf8'));
const hostTarget = `${process.platform}-${process.arch}`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveRequestedTargets(args) {
  if (args.length === 0) {
    return [resolveTarget(hostTarget)];
  }
  if (args.length === 1 && args[0] === 'all') {
    return config;
  }
  return args.map(resolveTarget);
}

function resolveTarget(targetArg) {
  const target = config.find(entry => entry.target === targetArg);
  if (!target) {
    fail(`Unknown target '${targetArg}'. Known targets: ${config.map(entry => entry.target).join(', ')}`);
  }
  return target;
}

function binaryNameFor(target) {
  return target.os[0] === 'win32' ? 'echarts.exe' : 'echarts';
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    fail(result.stderr || result.stdout || `${command} failed`);
  }
  return result;
}

function verifyTarget(target) {
  const stageRoot = path.join(repoRoot, 'dist', 'npm', target.package_name);
  if (!fs.existsSync(stageRoot)) {
    fail(`Missing staged platform package at ${stageRoot}. Run node scripts/prepare-platform-package.js ${target.target} first.`);
  }
  const stageManifest = path.join(stageRoot, 'manifest.json');
  if (!fs.existsSync(stageManifest)) {
    fail(`Missing staged manifest at ${stageManifest}. Re-run node scripts/prepare-platform-package.js ${target.target}.`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `echarts-cli-${target.target}-verify-`));
  const packResult = run('npm', ['pack', '--json', '--ignore-scripts'], stageRoot);
  const packMeta = JSON.parse(packResult.stdout);
  const tarball = Array.isArray(packMeta) ? packMeta[0].filename : packMeta.filename;
  run('tar', ['-xzf', path.join(stageRoot, tarball), '-C', tempRoot], stageRoot);

  const packageRoot = path.join(tempRoot, 'package');
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  if (pkg.name !== target.package_name) {
    fail(`Unexpected package name for ${target.target}: ${pkg.name}`);
  }
  if (JSON.stringify(pkg.os) !== JSON.stringify(target.os)) {
    fail(`Unexpected os metadata for ${target.target}: ${JSON.stringify(pkg.os)}`);
  }
  if (JSON.stringify(pkg.cpu) !== JSON.stringify(target.cpu)) {
    fail(`Unexpected cpu metadata for ${target.target}: ${JSON.stringify(pkg.cpu)}`);
  }

  const binRelative = pkg.bin && pkg.bin.echarts;
  const expectedBinRelative = `bin/${binaryNameFor(target)}`;
  if (binRelative !== expectedBinRelative) {
    fail(`Unexpected bin target for ${target.target}: ${JSON.stringify(pkg.bin)}`);
  }

  const binPath = path.join(packageRoot, binRelative);
  if (!fs.existsSync(binPath)) {
    fail(`Missing packaged binary at ${binPath}`);
  }

  const canExecute = target.target === hostTarget;
  if (canExecute) {
    const help = spawnSync(binPath, ['--help'], {
      cwd: packageRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });
    if (help.status !== 0) {
      fail(help.stderr || help.stdout || 'binary --help failed');
    }
    const info = spawnSync(binPath, ['info', 'line', '--format', 'json'], {
      cwd: packageRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });
    if (info.status !== 0) {
      fail(info.stderr || info.stdout || 'binary info failed');
    }
    JSON.parse(info.stdout);
  }

  return {
    target: target.target,
    tarball: path.join(stageRoot, tarball),
    executed: canExecute
  };
}

const results = resolveRequestedTargets(process.argv.slice(2)).map(verifyTarget);
process.stdout.write(JSON.stringify(results, null, 2) + '\n');
