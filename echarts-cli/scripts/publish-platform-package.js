#!/usr/bin/env node

const fs = require('fs');
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

for (const target of resolveRequestedTargets(process.argv.slice(2))) {
  const stageRoot = path.join(repoRoot, 'dist', 'npm', target.package_name);
  if (!fs.existsSync(stageRoot)) {
    fail(`Missing staged package at ${stageRoot}. Run node scripts/prepare-platform-package.js ${target.target} first.`);
  }
  const result = spawnSync('npm', ['publish', '--access', 'public'], {
    cwd: stageRoot,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status == null ? 1 : result.status);
  }
}
