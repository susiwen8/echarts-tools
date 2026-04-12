const fs = require('fs');
const path = require('path');
const { buildMetadata } = require('./build-metadata');
const { normalizeName, packageRoot, resolveRepoRoot } = require('./shared');

let metadataCache = null;

function metadataPath() {
  return path.join(packageRoot(), 'data', 'metadata.json');
}

function loadMetadata() {
  if (metadataCache) {
    return metadataCache;
  }

  const packagedMetadataPath = metadataPath();
  if (fs.existsSync(packagedMetadataPath)) {
    metadataCache = JSON.parse(fs.readFileSync(packagedMetadataPath, 'utf8'));
    return metadataCache;
  }

  const repoRoot = resolveRepoRoot(packageRoot());
  if (!repoRoot) {
    throw new Error('Unable to locate ECharts repository sources or packaged metadata.');
  }

  metadataCache = buildMetadata(repoRoot);
  return metadataCache;
}

function resolveItem(query) {
  const metadata = loadMetadata();
  const normalizedQuery = normalizeName(query);
  return metadata.items.find(item => normalizeName(item.name) === normalizedQuery)
    || metadata.items.find(item => normalizeName(item.exportName) === normalizedQuery)
    || null;
}

function findExamples(query) {
  const metadata = loadMetadata();
  const normalizedQuery = normalizeName(query);

  return metadata.examples
    .map(example => {
      const normalizedId = normalizeName(example.id);
      let score = 0;
      if (normalizedId === normalizedQuery) {
        score = 100;
      }
      else if (normalizedId.startsWith(normalizedQuery)) {
        score = 80;
      }
      else if (normalizedId.includes(normalizedQuery)) {
        score = 50;
      }
      return { example, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.example.file.localeCompare(b.example.file))
    .map(result => result.example);
}

function resolveTopLevelOption(name) {
  const metadata = loadMetadata();
  const normalizedQuery = normalizeName(name);
  return metadata.optionIndex.find(option => normalizeName(option.name) === normalizedQuery) || null;
}

module.exports = {
  findExamples,
  loadMetadata,
  resolveItem,
  resolveTopLevelOption
};
