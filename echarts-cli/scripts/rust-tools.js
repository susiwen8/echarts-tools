#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function envKeyFor(binaryName) {
  return `ECHARTS_CLI_${binaryName.toUpperCase()}`;
}

function resolveBinary(binaryName) {
  const envKey = envKeyFor(binaryName);
  if (process.env[envKey] && fs.existsSync(process.env[envKey])) {
    return process.env[envKey];
  }

  const standalone = path.join(os.homedir(), '.local', 'rust-1.95.0', 'bin', binaryName);
  if (fs.existsSync(standalone)) {
    return standalone;
  }

  return binaryName;
}

function probeBinary(binaryName) {
  const result = spawnSync(resolveBinary(binaryName), ['--version'], {
    encoding: 'utf8'
  });
  return result.status === 0;
}

if (require.main === module) {
  const [binaryName, ...args] = process.argv.slice(2);
  if (!binaryName) {
    process.stderr.write('Usage: node scripts/rust-tools.js <cargo|rustc> [args...]\n');
    process.exit(1);
  }

  const result = spawnSync(resolveBinary(binaryName), args, {
    stdio: 'inherit',
    env: process.env
  });
  process.exit(result.status == null ? 1 : result.status);
}

module.exports = {
  probeBinary,
  resolveBinary
};
