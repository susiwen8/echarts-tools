#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echarts-cli-pack-verify-'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result;
}

const packResult = run('npm', ['pack', '--json']);
const stdout = packResult.stdout.trim();
let tarball;
try {
  const match = stdout.match(/(\[\s*\{[\s\S]*\])\s*$/);
  const jsonText = match ? match[1] : stdout;
  const packMeta = JSON.parse(jsonText);
  tarball = Array.isArray(packMeta) ? packMeta[0].filename : packMeta.filename;
} catch {
  const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  tarball = lines.reverse().find(line => line.endsWith('.tgz'));
}
if (!tarball) {
  throw new Error(`Unable to determine tarball name from npm pack output:\n${packResult.stdout}`);
}

const tarballPath = path.join(repoRoot, tarball);
run('tar', ['-xzf', tarballPath, '-C', tempRoot]);

const packageRoot = path.join(tempRoot, 'package');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
if (!manifest.bin || manifest.bin.echarts !== 'dist/rust/echarts') {
  throw new Error(`Unexpected packaged bin target: ${JSON.stringify(manifest.bin)}`);
}

const rustBin = path.join(packageRoot, 'dist', 'rust', process.platform === 'win32' ? 'echarts.exe' : 'echarts');
const rustManifest = path.join(packageRoot, 'dist', 'rust', 'manifest.json');
if (!fs.existsSync(rustBin)) {
  throw new Error(`Missing packed rust binary: ${rustBin}`);
}
if (!fs.existsSync(rustManifest)) {
  throw new Error(`Missing packed rust manifest: ${rustManifest}`);
}

const helpResult = spawnSync(rustBin, ['--help'], {
  cwd: packageRoot,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  env: process.env
});
if (helpResult.status !== 0) {
  throw new Error(helpResult.stderr || helpResult.stdout || 'packed rust binary help failed');
}

const listResult = spawnSync(rustBin, ['list', '--format', 'json'], {
  cwd: packageRoot,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  env: process.env
});
if (listResult.status !== 0) {
  throw new Error(listResult.stderr || listResult.stdout || 'packed rust binary list failed');
}
JSON.parse(listResult.stdout);

process.stdout.write(`${tarball}\n`);
