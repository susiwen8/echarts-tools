const fs = require('fs');
const path = require('path');
const { buildMetadata } = require('./build-metadata');
const { renderOptionJsonDoc } = require('./doc-utils');
const {
  normalizeName,
  packageRoot,
  resolveWebsiteRoot,
  resolveRepoRoot
} = require('./shared');

let metadataCache = null;
const exampleContentCache = new Map();
const optionDocCache = new Map();

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

function loadExampleContent(example) {
  if (!example) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(example, 'content') && example.content != null) {
    return example.content;
  }

  if (example.contentPath) {
    const packagedContentPath = path.join(packageRoot(), 'data', example.contentPath);
    if (exampleContentCache.has(packagedContentPath)) {
      return exampleContentCache.get(packagedContentPath);
    }
    if (fs.existsSync(packagedContentPath)) {
      const content = fs.readFileSync(packagedContentPath, 'utf8');
      exampleContentCache.set(packagedContentPath, content);
      return content;
    }
  }

  return null;
}

function resolveTopLevelOption(name) {
  const metadata = loadMetadata();
  const normalizedQuery = normalizeName(name);
  return metadata.optionIndex.find(option => normalizeName(option.name) === normalizedQuery) || null;
}

function resolveLocalizedDoc(bundle, lang) {
  if (!bundle) {
    return null;
  }

  if (lang === 'en') {
    return bundle.en || bundle.zh || null;
  }

  return bundle.zh || bundle.en || null;
}

function loadOptionDoc(bundle, lang) {
  const localized = resolveLocalizedDoc(bundle, lang);
  if (!localized) {
    return null;
  }

  function buildDocResponse(absolutePath) {
    const cacheKey = `${localized.relativePath}:${absolutePath}`;
    if (optionDocCache.has(cacheKey)) {
      return optionDocCache.get(cacheKey);
    }

    const source = fs.readFileSync(absolutePath, 'utf8');
    const resolvedLang = localized.relativePath.startsWith('en/') ? 'en' : 'zh';
    const rendered = localized.relativePath.endsWith('.json')
      ? renderOptionJsonDoc(localized.relativePath, source)
      : { title: localized.title, content: source };

    const payload = {
      lang: resolvedLang,
      relativePath: localized.relativePath,
      title: rendered.title || localized.title,
      summary: localized.summary,
      scopeRoot: rendered.scopeRoot || null,
      entries: rendered.entries || {},
      content: rendered.content
    };
    optionDocCache.set(cacheKey, payload);
    return payload;
  }

  const packagedDocsPath = path.join(packageRoot(), 'data', 'docs', localized.relativePath);
  if (fs.existsSync(packagedDocsPath)) {
    return buildDocResponse(packagedDocsPath);
  }

  const websiteRoot = resolveWebsiteRoot(packageRoot());
  if (!websiteRoot) {
    return {
      lang: localized.relativePath.startsWith('en/') ? 'en' : 'zh',
      relativePath: localized.relativePath,
      title: localized.title,
      summary: localized.summary,
      content: null
    };
  }

  const absolutePath = path.join(websiteRoot, localized.relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      lang: localized.relativePath.startsWith('en/') ? 'en' : 'zh',
      relativePath: localized.relativePath,
      title: localized.title,
      summary: localized.summary,
      content: null
    };
  }

  return buildDocResponse(absolutePath);
}

function getEntry(doc, propPath) {
  if (!doc || !doc.entries || !propPath) {
    return null;
  }

  return doc.entries[propPath] || null;
}

function getDescendantEntries(doc, propPath) {
  if (!doc || !doc.entries) {
    return [];
  }

  const entries = Object.values(doc.entries);
  const filtered = propPath
    ? entries.filter(entry => entry.path && entry.path.startsWith(`${propPath}.`))
    : entries;

  return filtered
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.path.localeCompare(b.path));
}

function listEntryChildren(doc, propPath) {
  if (!doc || !doc.entries) {
    return [];
  }

  const prefix = propPath ? `${propPath}.` : '';
  const children = new Map();

  for (const [pathKey, entry] of Object.entries(doc.entries)) {
    if (propPath) {
      if (pathKey === propPath || !pathKey.startsWith(prefix)) {
        continue;
      }
    }

    const rest = propPath ? pathKey.slice(prefix.length) : pathKey;
    const name = rest.split('.')[0];
    if (!name) {
      continue;
    }

    const childPath = propPath ? `${propPath}.${name}` : name;
    const directEntry = doc.entries[childPath];
    const childEntry = directEntry || {
      path: childPath,
      description: null,
      type: null,
      default: null,
      isObject: true,
      order: entry.order
    };

    if (!children.has(childPath)) {
      children.set(childPath, {
        ...childEntry,
        name,
        hasChildren: false
      });
    }

    if (childPath !== pathKey) {
      children.get(childPath).hasChildren = true;
      children.get(childPath).isObject = true;
    }
  }

  return Array.from(children.values())
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.path.localeCompare(b.path));
}

function isOptionDocKey(name) {
  return Boolean(resolveTopLevelOption(name));
}

function scoreEntryForTokens(pathValue, tokens) {
  const normalizedPath = normalizeName(pathValue);
  const normalizedSegments = pathValue.split('.').map(segment => normalizeName(segment));
  let score = 0;

  for (const token of tokens) {
    const normalizedToken = normalizeName(token);
    if (!normalizedToken) {
      continue;
    }

    if (normalizedSegments.includes(normalizedToken)) {
      score += 80;
      continue;
    }

    if (normalizedSegments.some(segment => segment.startsWith(normalizedToken))) {
      score += 50;
      continue;
    }

    if (normalizedSegments.some(segment => segment.includes(normalizedToken))) {
      score += 30;
      continue;
    }

    if (normalizedPath.includes(normalizedToken)) {
      score += 10;
      continue;
    }

    return null;
  }

  score -= pathValue.split('.').length;
  return score;
}

function searchEntries(doc, tokens, basePath) {
  if (!doc || !doc.entries || !tokens || !tokens.length) {
    return [];
  }

  const prefix = basePath ? `${basePath}.` : '';
  const results = [];

  for (const entry of Object.values(doc.entries)) {
    if (basePath && entry.path !== basePath && !entry.path.startsWith(prefix)) {
      continue;
    }

    const score = scoreEntryForTokens(entry.path, tokens);
    if (score === null) {
      continue;
    }

    results.push({
      ...entry,
      name: entry.path.split('.').slice(-1)[0],
      hasChildren: listEntryChildren(doc, entry.path).length > 0,
      score
    });
  }

  return results.sort((a, b) =>
    b.score - a.score
    || (a.order || 0) - (b.order || 0)
    || a.path.split('.').length - b.path.split('.').length
    || a.path.localeCompare(b.path)
  );
}

function searchRelatedOptionDocs(tokens, lang, contextItem) {
  const metadata = loadMetadata();
  const results = [];

  for (const option of metadata.optionIndex || []) {
    const localizedDoc = resolveLocalizedDoc(option.docs && option.docs.option, lang);
    const summary = localizedDoc && localizedDoc.summary ? localizedDoc.summary : '';
    let score = 0;
    const normalizedName = normalizeName(option.name);

    for (const token of tokens) {
      const normalizedToken = normalizeName(token);
      if (!normalizedToken) {
        continue;
      }

      if (normalizedName === normalizedToken) {
        score += 120;
        continue;
      }
      if (normalizedName.startsWith(normalizedToken)) {
        score += 90;
        continue;
      }
      if (normalizedName.includes(normalizedToken)) {
        score += 60;
        continue;
      }
      if (normalizeName(summary).includes(normalizedToken)) {
        score += 20;
        continue;
      }

      score = null;
      break;
    }

    if (score === null) {
      continue;
    }

    if (contextItem && tokens.some(token => normalizeName(token) === 'axis')) {
      if (option.name === 'xAxis' || option.name === 'yAxis') {
        score += 35;
      }
      else if (option.name === 'angleAxis' || option.name === 'radiusAxis') {
        score += 20;
      }
      else if (option.name === 'singleAxis') {
        score += 10;
      }
    }

    results.push({
      name: option.name,
      optionType: option.rawType,
      topLevelKey: option.topLevelKey,
      doc: localizedDoc,
      summary: summary || null,
      score
    });
  }

  return results
    .sort((a, b) =>
      b.score - a.score
      || a.name.length - b.name.length
      || a.name.localeCompare(b.name)
    )
    .slice(0, 8);
}

function buildQueryPayload(query, doc, propPath, contextItem) {
  const normalizedPath = propPath || null;
  const entry = normalizedPath ? getEntry(doc, normalizedPath) : null;
  const children = listEntryChildren(doc, normalizedPath);

  if (normalizedPath && !entry && !children.length) {
    return null;
  }

  return {
    query,
    contextItem: contextItem || null,
    doc: {
      lang: doc.lang,
      relativePath: doc.relativePath,
      title: doc.title,
      scopeRoot: doc.scopeRoot
    },
    _docState: doc,
    path: normalizedPath,
    entry,
    children
  };
}

function buildSearchPayload(query, doc, tokens, results, contextItem) {
  return {
    query,
    contextItem: contextItem || null,
    doc: {
      lang: doc.lang,
      relativePath: doc.relativePath,
      title: doc.title,
      scopeRoot: doc.scopeRoot
    },
    _docState: doc,
    searchTokens: tokens,
    results
  };
}

function buildRelatedDocsPayload(query, relatedDocs, contextItem) {
  return {
    query,
    contextItem: contextItem || null,
    relatedDocs
  };
}

function resolveFineOptionQuery(query, lang) {
  const segments = Array.isArray(query)
    ? query.filter(Boolean)
    : String(query || '').split('.').filter(Boolean);
  const queryText = Array.isArray(query) ? query.join(' ') : String(query || '');
  if (segments.length < 2) {
    return null;
  }

  const item = resolveItem(segments[0]);
  if (item) {
    const itemDoc = loadOptionDoc(item.docs && item.docs.option, lang);
    const remainder = segments.slice(1).join('.');
    const broadTokens = segments.slice(1);

    if (itemDoc && getEntry(itemDoc, remainder)) {
      return buildQueryPayload(queryText, itemDoc, remainder, item.name);
    }

    if (isOptionDocKey(segments[1])) {
      const option = resolveTopLevelOption(segments[1]);
      const optionDoc = loadOptionDoc(option.docs && option.docs.option, lang);
      const nestedPath = segments.slice(2).join('.') || null;
      if (!nestedPath) {
        return buildQueryPayload(queryText, optionDoc, null, item.name);
      }

      if (getEntry(optionDoc, nestedPath) || listEntryChildren(optionDoc, nestedPath).length) {
        return buildQueryPayload(queryText, optionDoc, nestedPath, item.name);
      }

      const results = searchEntries(optionDoc, segments.slice(2), null);
      if (results.length) {
        return buildSearchPayload(queryText, optionDoc, segments.slice(2), results, item.name);
      }

      return null;
    }

    if (broadTokens.length === 1) {
      const relatedDocs = searchRelatedOptionDocs(broadTokens, lang, item.name);
      if (relatedDocs.length) {
        return buildRelatedDocsPayload(queryText, relatedDocs, item.name);
      }
    }

    if (itemDoc) {
      if (getEntry(itemDoc, remainder) || listEntryChildren(itemDoc, remainder).length) {
        return buildQueryPayload(queryText, itemDoc, remainder, item.name);
      }

      const results = searchEntries(itemDoc, segments.slice(1), null);
      if (results.length) {
        return buildSearchPayload(queryText, itemDoc, segments.slice(1), results, item.name);
      }

      return null;
    }
  }

  const option = resolveTopLevelOption(segments[0]);
  if (!option) {
    if (segments.length >= 1) {
      const relatedDocs = searchRelatedOptionDocs(segments, lang, null);
      if (relatedDocs.length) {
        return buildRelatedDocsPayload(queryText, relatedDocs, null);
      }
    }
    return null;
  }

  const optionDoc = loadOptionDoc(option.docs && option.docs.option, lang);
  const nestedPath = segments.slice(1).join('.');
  if (getEntry(optionDoc, nestedPath) || listEntryChildren(optionDoc, nestedPath).length) {
    return buildQueryPayload(queryText, optionDoc, nestedPath, null);
  }

  const results = searchEntries(optionDoc, segments.slice(1), null);
  if (results.length) {
    return buildSearchPayload(queryText, optionDoc, segments.slice(1), results, null);
  }

  return null;
}

module.exports = {
  findExamples,
  getEntry,
  getDescendantEntries,
  listEntryChildren,
  loadExampleContent,
  loadMetadata,
  loadOptionDoc,
  resolveFineOptionQuery,
  resolveItem,
  resolveTopLevelOption,
  searchRelatedOptionDocs,
  searchEntries
};
