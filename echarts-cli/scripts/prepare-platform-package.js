#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts', 'platform-packages.json'), 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function currentTarget() {
  return `${process.platform}-${process.arch}`;
}

function binaryNameFor(target) {
  return target.os[0] === 'win32' ? 'echarts.exe' : 'echarts';
}

function resolveRequestedTargets(args) {
  if (args.length === 0) {
    const hostTarget = currentTarget();
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

function resolveBuiltBinary(target) {
  const binaryName = binaryNameFor(target);
  const tripleBinary = path.join(repoRoot, 'target', target.rust_target, 'release', binaryName);
  if (fs.existsSync(tripleBinary)) {
    return tripleBinary;
  }

  if (target.target === currentTarget()) {
    const hostBinary = path.join(repoRoot, 'target', 'release', binaryName);
    if (fs.existsSync(hostBinary)) {
      return hostBinary;
    }
  }

  fail(
    `Missing built Rust binary for ${target.target}.\n` +
      `Expected ${tripleBinary}.\n` +
      `Build it first with: node scripts/rust-tools.js cargo build --release --bin echarts --target ${target.rust_target}`
  );
}

function stagePackage(target) {
  const binaryName = binaryNameFor(target);
  const rustBinary = resolveBuiltBinary(target);
  const stageRoot = path.join(repoRoot, 'dist', 'npm', target.package_name);

  fs.rmSync(stageRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(stageRoot, 'bin'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'data'), path.join(stageRoot, 'data'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'README.md'), path.join(stageRoot, 'README.md'));
  fs.copyFileSync(path.join(repoRoot, 'development.md'), path.join(stageRoot, 'development.md'));
  fs.copyFileSync(rustBinary, path.join(stageRoot, 'bin', binaryName));
  fs.chmodSync(path.join(stageRoot, 'bin', binaryName), 0o755);

  const stagedPkg = {
    name: target.package_name,
    version: rootPkg.version,
    description: rootPkg.description,
    license: rootPkg.license,
    os: target.os,
    cpu: target.cpu,
    publishConfig: { access: 'public' },
    bin: {
      echarts: `bin/${binaryName}`
    },
    files: ['bin', 'data', 'README.md', 'development.md']
  };
  fs.writeFileSync(path.join(stageRoot, 'package.json'), JSON.stringify(stagedPkg, null, 2) + '\n');

  const manifest = {
    generatedAt: new Date().toISOString(),
    target: target.target,
    rustTarget: target.rust_target,
    packageName: target.package_name,
    binary: binaryName,
    sourceBinary: path.relative(repoRoot, rustBinary)
  };
  fs.writeFileSync(path.join(stageRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return stageRoot;
}

const requestedTargets = resolveRequestedTargets(process.argv.slice(2));
const stageRoots = requestedTargets.map(stagePackage);
process.stdout.write(stageRoots.join('\n') + '\n');
