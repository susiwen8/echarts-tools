const path = require('path');

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'');
}

function htmlToText(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '\n```\n$1\n```\n')
      .replace(/<li>/g, '\n- ')
      .replace(/<\/li>/g, '\n')
      .replace(/<\/p>/g, '\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function buildOptionDocContent(title, entries) {
  const lines = [`# ${title}`];
  const orderedEntries = Object.values(entries || {})
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.path.localeCompare(b.path));

  for (const entry of orderedEntries) {
    lines.push('', `## ${entry.path}`);
    if (entry.description) {
      lines.push(entry.description);
    }
  }

  return lines.join('\n').trim();
}

function normalizeType(type) {
  if (Array.isArray(type)) {
    return type;
  }
  return type || null;
}

function deriveScopeRoot(relativePath) {
  const baseName = path.basename(relativePath, '.json').replace(/^option\./, '');
  if (baseName.startsWith('series-')) {
    return 'series';
  }
  return baseName;
}

function renderOptionJsonDoc(relativePath, source, options) {
  const opts = options || {};
  const doc = JSON.parse(source);
  if (doc && typeof doc === 'object' && doc.entries && !doc.content) {
    return {
      title: doc.title || path.basename(relativePath, '.json'),
      scopeRoot: doc.scopeRoot || null,
      entries: doc.entries || {},
      content: buildOptionDocContent(doc.title || path.basename(relativePath, '.json'), doc.entries || {})
    };
  }

  if (doc && typeof doc === 'object' && typeof doc.content === 'string') {
    return {
      title: doc.title || path.basename(relativePath, '.json'),
      scopeRoot: doc.scopeRoot || null,
      entries: doc.entries || {},
      content: doc.content
    };
  }

  const title = path.basename(relativePath, '.json');
  const scopeRoot = deriveScopeRoot(relativePath);
  const outlineEntries = opts.outlineEntries || new Map();
  const lines = [`# ${title}`];
  const entries = {};
  let order = 0;

  for (const [prop, entry] of Object.entries(doc)) {
    lines.push('', `## ${prop}`);
    const desc = htmlToText(entry && entry.desc);
    const outlineEntry = outlineEntries.get(prop) || {};
    entries[prop] = {
      path: prop,
      description: desc || null,
      type: normalizeType(outlineEntry.type),
      default: outlineEntry.default ?? ((entry && entry.uiControl && entry.uiControl.default) || null),
      isObject: Boolean(outlineEntry.isObject),
      order: order += 1
    };
    if (desc) {
      lines.push(desc);
    }
  }

  for (const [prop, outlineEntry] of outlineEntries.entries()) {
    if (entries[prop]) {
      continue;
    }
    entries[prop] = {
      path: prop,
      description: null,
      type: normalizeType(outlineEntry.type),
      default: outlineEntry.default ?? null,
      isObject: Boolean(outlineEntry.isObject),
      order: order += 1
    };
  }

  return {
    title,
    scopeRoot,
    entries,
    content: lines.join('\n').trim()
  };
}

module.exports = {
  buildOptionDocContent,
  decodeHtmlEntities,
  deriveScopeRoot,
  htmlToText,
  renderOptionJsonDoc
};
