#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildMetadata } = require('../src/build-metadata');
const { deriveScopeRoot, renderOptionJsonDoc } = require('../src/doc-utils');
const { packageRoot, resolveRepoRoot, resolveWebsiteRoot } = require('../src/shared');

const rootDir = packageRoot();
const repoRoot = resolveRepoRoot(rootDir);
const outDir = path.join(rootDir, 'data');
const docsOutDir = path.join(outDir, 'docs');
const examplesOutDir = path.join(outDir, 'examples');
const outFile = path.join(outDir, 'metadata.json');

if (!repoRoot) {
  if (fs.existsSync(outFile)) {
    JSON.parse(fs.readFileSync(outFile, 'utf8'));
    process.stdout.write(`Reused ${outFile} because ECharts repository sources are unavailable.\n`);
    process.exit(0);
  }

  throw new Error('Unable to locate ECharts repository sources for metadata generation.');
}

const metadata = buildMetadata(repoRoot);
const websiteRoot = resolveWebsiteRoot(repoRoot);

const outlineCache = new Map();

function loadOutline(locale) {
  const cacheKey = locale;
  if (outlineCache.has(cacheKey)) {
    return outlineCache.get(cacheKey);
  }

  const outlinePath = path.join(websiteRoot, locale, 'documents', 'option-parts', 'option-outline.json');
  const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
  outlineCache.set(cacheKey, outline);
  return outline;
}

function findScopeNode(node, scopeRoot) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (node.prop === scopeRoot && node.isObject) {
    return node;
  }

  for (const child of node.children || []) {
    const match = findScopeNode(child, scopeRoot);
    if (match) {
      return match;
    }
  }

  return null;
}

function buildOutlineEntries(locale, scopeRoot) {
  const outline = loadOutline(locale);
  const scopeNode = findScopeNode(outline, scopeRoot);
  const entries = new Map();

  function walk(node, prefixParts) {
    for (const child of node.children || []) {
      const childPath = prefixParts.concat(child.prop).join('.');
      entries.set(childPath, {
        type: child.type,
        default: Object.prototype.hasOwnProperty.call(child, 'default') ? child.default : null,
        isObject: Boolean(child.isObject)
      });
      walk(child, prefixParts.concat(child.prop));
    }
  }

  if (scopeNode) {
    walk(scopeNode, []);
  }

  return entries;
}

function collectReferencedOptionDocPaths(metadataValue) {
  const paths = new Set();

  function addRelativePath(relativePath) {
    if (!relativePath) {
      return;
    }
    paths.add(relativePath.split('#')[0]);
  }

  function addBundle(bundle) {
    if (!bundle) {
      return;
    }
    if (bundle.zh) {
      addRelativePath(bundle.zh.relativePath);
    }
    if (bundle.en) {
      addRelativePath(bundle.en.relativePath);
    }
  }

  for (const item of metadataValue.items || []) {
    addBundle(item.docs && item.docs.option);
  }

  for (const option of metadataValue.optionIndex || []) {
    addBundle(option.docs && option.docs.option);
  }

  return Array.from(paths).sort();
}

function copyDocsSubset(metadataValue, websiteRootValue, destinationDir) {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  if (!websiteRootValue) {
    return 0;
  }

  const relativePaths = collectReferencedOptionDocPaths(metadataValue);
  let copied = 0;

  for (const relativePath of relativePaths) {
    const sourcePath = path.join(websiteRootValue, relativePath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const destinationPath = path.join(destinationDir, relativePath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    const locale = relativePath.split('/')[0];
    const scopeRoot = deriveScopeRoot(relativePath);
    const reducedDoc = renderOptionJsonDoc(
      relativePath,
      fs.readFileSync(sourcePath, 'utf8'),
      { outlineEntries: buildOutlineEntries(locale, scopeRoot) }
    );
    const { content, ...docIndex } = reducedDoc;
    fs.writeFileSync(destinationPath, JSON.stringify(docIndex));
    copied += 1;
  }

  return copied;
}

function splitExampleContent(metadataValue, destinationDir) {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  let written = 0;

  const examples = (metadataValue.examples || []).map(example => {
    if (!Object.prototype.hasOwnProperty.call(example, 'content')) {
      return example;
    }

    const contentPath = path.posix.join('examples', example.relativePath);
    const destinationPath = path.join(outDir, contentPath);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, example.content);
    written += 1;

    const { content, ...rest } = example;
    return {
      ...rest,
      contentPath
    };
  });

  metadataValue.examples = examples;
  return written;
}

const copiedDocsCount = copyDocsSubset(metadata, websiteRoot, docsOutDir);
const splitExamplesCount = splitExampleContent(metadata, examplesOutDir);
metadata.docsRoot = 'data/docs';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(metadata, null, 2));

process.stdout.write(`Wrote ${outFile}\n`);
if (copiedDocsCount) {
  process.stdout.write(`Copied ${copiedDocsCount} built doc artifacts to ${docsOutDir}\n`);
}
if (splitExamplesCount) {
  process.stdout.write(`Copied ${splitExamplesCount} example sources to ${examplesOutDir}\n`);
}
