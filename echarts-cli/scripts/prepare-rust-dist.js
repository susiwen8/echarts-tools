#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveBinary } = require('./rust-tools');

const repoRoot = path.resolve(__dirname, '..');
const cargo = resolveBinary('cargo');
const binaryNames = process.platform === 'win32'
  ? ['echarts.exe']
  : ['echarts'];
const distDir = path.join(repoRoot, 'dist', 'rust');
const targetReleaseDir = path.join(repoRoot, 'target', 'release');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status == null ? 1 : result.status);
  }
}

run(cargo, ['build', '--release', '--quiet', '--bin', 'echarts']);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const binaryName of binaryNames) {
  const source = path.join(targetReleaseDir, binaryName);
  const destination = path.join(distDir, binaryName);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing release binary: ${source}`);
  }
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, 0o755);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  binaries: binaryNames
};
fs.writeFileSync(path.join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
process.stdout.write(`${distDir}\n`);
