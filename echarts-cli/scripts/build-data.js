#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildMetadata } = require('../src/build-metadata');
const { packageRoot, resolveRepoRoot } = require('../src/shared');

const repoRoot = resolveRepoRoot(packageRoot());

if (!repoRoot) {
  throw new Error('Unable to locate ECharts repository sources for metadata generation.');
}

const metadata = buildMetadata(repoRoot);
const outDir = path.join(packageRoot(), 'data');
const outFile = path.join(outDir, 'metadata.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(metadata, null, 2));

process.stdout.write(`Wrote ${outFile}\n`);
