function writeOutput(format, payload, renderText, renderMarkdown) {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (format === 'markdown') {
    process.stdout.write(`${renderMarkdown(payload)}\n`);
    return;
  }

  process.stdout.write(`${renderText(payload)}\n`);
}

function pushTextDocs(lines, docs) {
  if (!docs) {
    return;
  }

  const primarySummary = docs.option && (
    (docs.option.zh && docs.option.zh.summary)
    || (docs.option.en && docs.option.en.summary)
  );

  if (primarySummary) {
    lines.push(`Summary: ${primarySummary}`);
  }

  if (docs.option && (docs.option.zh || docs.option.en)) {
    lines.push('', 'Docs:');
    if (docs.option.zh) {
      lines.push(`- zh option: ${docs.option.zh.relativePath}`);
    }
    if (docs.option.en) {
      lines.push(`- en option: ${docs.option.en.relativePath}`);
    }
  }

  if (docs.tutorials && docs.tutorials.length) {
    lines.push('', 'Tutorials:');
    for (const tutorial of docs.tutorials) {
      if (tutorial.zh) {
        lines.push(`- zh: ${tutorial.zh.title || tutorial.zh.relativePath} (${tutorial.zh.relativePath})`);
      }
      if (tutorial.en) {
        lines.push(`- en: ${tutorial.en.title || tutorial.en.relativePath} (${tutorial.en.relativePath})`);
      }
    }
  }
}

function pushMarkdownDocs(lines, docs) {
  if (!docs) {
    return;
  }

  const primarySummary = docs.option && (
    (docs.option.zh && docs.option.zh.summary)
    || (docs.option.en && docs.option.en.summary)
  );

  if (primarySummary) {
    lines.push('', `> ${primarySummary}`);
  }

  if (docs.option && (docs.option.zh || docs.option.en)) {
    lines.push('', '## Docs', '');
    if (docs.option.zh) {
      lines.push(`- zh option: \`${docs.option.zh.relativePath}\``);
    }
    if (docs.option.en) {
      lines.push(`- en option: \`${docs.option.en.relativePath}\``);
    }
  }

  if (docs.tutorials && docs.tutorials.length) {
    lines.push('', '## Tutorials', '');
    for (const tutorial of docs.tutorials) {
      if (tutorial.zh) {
        lines.push(`- zh: \`${tutorial.zh.relativePath}\``);
      }
      if (tutorial.en) {
        lines.push(`- en: \`${tutorial.en.relativePath}\``);
      }
    }
  }
}

function formatListText(payload) {
  const lines = payload.items.map(item => {
    const optionPart = item.optionType ? ` ${item.optionType}` : '';
    return `${item.kind.padEnd(10)} ${item.name.padEnd(20)}${optionPart}`.trimEnd();
  });
  return lines.join('\n');
}

function formatListMarkdown(payload) {
  const lines = ['| Kind | Name | Option Type |', '| --- | --- | --- |'];
  for (const item of payload.items) {
    lines.push(`| ${item.kind} | ${item.name} | ${item.optionType || '-'} |`);
  }
  return lines.join('\n');
}

function formatInfoText(payload) {
  const lines = [
    `${payload.name} (${payload.kind})`,
    `Export: ${payload.exportName}`,
    `Source: ${payload.sourcePath}`
  ];

  if (payload.optionType) {
    lines.push(`Option Type: ${payload.optionType}`);
  }
  if (payload.optionPath) {
    lines.push(`Option Path: ${payload.optionPath}`);
  }
  pushTextDocs(lines, payload.docs);
  if (payload.examples.length) {
    lines.push('', 'Examples:');
    for (const example of payload.examples) {
      lines.push(`- ${example.file}`);
    }
  }

  return lines.join('\n');
}

function formatInfoMarkdown(payload) {
  const lines = [
    `# ${payload.name}`,
    '',
    `- Kind: \`${payload.kind}\``,
    `- Export: \`${payload.exportName}\``,
    `- Source: \`${payload.sourcePath}\``
  ];

  if (payload.optionType) {
    lines.push(`- Option Type: \`${payload.optionType}\``);
  }
  if (payload.optionPath) {
    lines.push(`- Option Path: \`${payload.optionPath}\``);
  }
  pushMarkdownDocs(lines, payload.docs);
  if (payload.examples.length) {
    lines.push('', '## Examples', '');
    for (const example of payload.examples) {
      lines.push(`- \`${example.file}\``);
    }
  }

  return lines.join('\n');
}

function formatDetailedOptionText(payload) {
  const lines = [
    `${payload.name} (${payload.kind})`,
    `Export: ${payload.exportName}`,
    `Source: ${payload.sourcePath}`
  ];

  if (payload.optionType) {
    lines.push(`Option Type: ${payload.optionType}`);
  }
  if (payload.optionPath) {
    lines.push(`Option Path: ${payload.optionPath}`);
  }

  if (payload.doc) {
    if (payload.doc.summary) {
      lines.push(`Summary: ${payload.doc.summary}`);
    }
    lines.push('', `Documentation (${payload.doc.relativePath}):`);
    if (payload.doc.content) {
      lines.push(payload.doc.content);
    }
  }

  return lines.join('\n');
}

function formatDetailedOptionMarkdown(payload) {
  const lines = [
    `# ${payload.name}`,
    '',
    `- Kind: \`${payload.kind}\``,
    `- Export: \`${payload.exportName}\``,
    `- Source: \`${payload.sourcePath}\``
  ];

  if (payload.optionType) {
    lines.push(`- Option Type: \`${payload.optionType}\``);
  }
  if (payload.optionPath) {
    lines.push(`- Option Path: \`${payload.optionPath}\``);
  }
  if (payload.doc) {
    if (payload.doc.summary) {
      lines.push('', `> ${payload.doc.summary}`);
    }

    lines.push('', `## Documentation (\`${payload.doc.relativePath}\`)`, '');
    if (payload.doc.content) {
      lines.push('```md');
      lines.push(payload.doc.content);
      lines.push('```');
    }
  }

  return lines.join('\n');
}

function formatOptionQueryText(payload) {
  if (payload.relatedDocs && payload.relatedDocs.length) {
    const lines = [`Query: ${payload.query}`];
    if (payload.contextItem) {
      lines.push(`Context: ${payload.contextItem}`);
    }
    lines.push('', 'Related option docs:');
    for (const doc of payload.relatedDocs) {
      lines.push(`- ${doc.name}${doc.optionType ? ` (${doc.optionType})` : ''}`);
      if (doc.summary) {
        lines.push(`  ${truncateLine(doc.summary, 180)}`);
      }
      if (doc.doc && doc.doc.relativePath) {
        lines.push(`  Doc: ${doc.doc.relativePath}`);
      }
    }
    return lines.join('\n');
  }

  if (payload.results && payload.viewMode === 'grep') {
    return payload.results.map(result => {
      const pieces = [result.path];
      if (result.type) {
        pieces.push(`type=${Array.isArray(result.type) ? result.type.join('|') : result.type}`);
      }
      if (result.default !== null && result.default !== undefined) {
        pieces.push(`default=${result.default}`);
      }
      return pieces.join('\t');
    }).join('\n');
  }

  if (payload.results && payload.viewMode === 'tree') {
    return buildTextTree(payload.results, { includeDescriptions: true });
  }

  if (payload.results && payload.results.length) {
    const lines = [`Query: ${payload.query}`];

    if (payload.contextItem) {
      lines.push(`Context: ${payload.contextItem}`);
    }
    lines.push(`Doc: ${payload.doc.title} (${payload.doc.relativePath})`);
    lines.push('', 'Matches:');
    for (const result of payload.results) {
      const pieces = [`- ${result.path}`];
      if (result.type) {
        pieces.push(`type=${Array.isArray(result.type) ? result.type.join('|') : result.type}`);
      }
      if (result.default !== null && result.default !== undefined) {
        pieces.push(`default=${result.default}`);
      }
      if (result.hasChildren) {
        pieces.push('children');
      }
      lines.push(pieces.join(' '));
      if (result.description) {
        lines.push(`  ${renderPropertyDescription(result.description, payload.fullDesc)}`);
      }
    }
    return lines.join('\n');
  }

  const lines = [`Query: ${payload.query}`];

  if (payload.contextItem) {
    lines.push(`Context: ${payload.contextItem}`);
  }
  lines.push(`Doc: ${payload.doc.title} (${payload.doc.relativePath})`);

  if (payload.path) {
    lines.push(`Path: ${payload.path}`);
  }

  if (payload.entry) {
    if (payload.entry.type) {
      lines.push(`Type: ${Array.isArray(payload.entry.type) ? payload.entry.type.join(' | ') : payload.entry.type}`);
    }
    if (payload.entry.default !== null && payload.entry.default !== undefined) {
      lines.push(`Default: ${payload.entry.default}`);
    }
    if (payload.entry.description) {
      lines.push('', payload.entry.description);
    }
  }

  if (payload.children && payload.children.length) {
    lines.push('', 'Available properties:');
    for (const child of payload.children) {
      const pieces = [`- ${child.name}`];
      if (child.type) {
        pieces.push(`type=${Array.isArray(child.type) ? child.type.join('|') : child.type}`);
      }
      if (child.default !== null && child.default !== undefined) {
        pieces.push(`default=${child.default}`);
      }
      if (child.hasChildren) {
        pieces.push('children');
      }
      lines.push(pieces.join(' '));
      if (child.description) {
        lines.push(`  ${renderPropertyDescription(child.description, payload.fullDesc)}`);
      }
    }
  }

  return lines.join('\n');
}

function formatOptionQueryMarkdown(payload) {
  if (payload.relatedDocs && payload.relatedDocs.length) {
    const lines = [`# ${payload.query}`, ''];
    if (payload.contextItem) {
      lines.push(`- Context: \`${payload.contextItem}\``);
    }
    lines.push('', '## Related option docs', '');
    for (const doc of payload.relatedDocs) {
      const header = [`- \`${doc.name}\``];
      if (doc.optionType) {
        header.push(`type=\`${doc.optionType}\``);
      }
      lines.push(header.join(' '));
      if (doc.summary) {
        lines.push(`  - ${truncateLine(doc.summary, 180)}`);
      }
      if (doc.doc && doc.doc.relativePath) {
        lines.push(`  - doc: \`${doc.doc.relativePath}\``);
      }
    }
    return lines.join('\n');
  }

  if (payload.results && payload.viewMode === 'grep') {
    return payload.results.map(result => {
      const pieces = [`\`${result.path}\``];
      if (result.type) {
        pieces.push(`type=\`${Array.isArray(result.type) ? result.type.join('|') : result.type}\``);
      }
      if (result.default !== null && result.default !== undefined) {
        pieces.push(`default=\`${result.default}\``);
      }
      return `- ${pieces.join(' ')}`;
    }).join('\n');
  }

  if (payload.results && payload.viewMode === 'tree') {
    return ['```text', buildTextTree(payload.results), '```'].join('\n');
  }

  if (payload.results && payload.results.length) {
    const lines = [`# ${payload.query}`, ''];

    if (payload.contextItem) {
      lines.push(`- Context: \`${payload.contextItem}\``);
    }
    lines.push(`- Doc: \`${payload.doc.title}\` (\`${payload.doc.relativePath}\`)`, '', '## Matches', '');
    for (const result of payload.results) {
      const pieces = [`- \`${result.path}\``];
      if (result.type) {
        pieces.push(`type=\`${Array.isArray(result.type) ? result.type.join('|') : result.type}\``);
      }
      if (result.default !== null && result.default !== undefined) {
        pieces.push(`default=\`${result.default}\``);
      }
      if (result.hasChildren) {
        pieces.push('has-children');
      }
      lines.push(pieces.join(' '));
      if (result.description) {
        lines.push(`  - ${renderPropertyDescription(result.description, payload.fullDesc)}`);
      }
    }
    return lines.join('\n');
  }

  const lines = [`# ${payload.query}`, ''];

  if (payload.contextItem) {
    lines.push(`- Context: \`${payload.contextItem}\``);
  }
  lines.push(`- Doc: \`${payload.doc.title}\` (\`${payload.doc.relativePath}\`)`);

  if (payload.path) {
    lines.push(`- Path: \`${payload.path}\``);
  }

  if (payload.entry) {
    if (payload.entry.type) {
      lines.push(`- Type: \`${Array.isArray(payload.entry.type) ? payload.entry.type.join(' | ') : payload.entry.type}\``);
    }
    if (payload.entry.default !== null && payload.entry.default !== undefined) {
      lines.push(`- Default: \`${payload.entry.default}\``);
    }
    if (payload.entry.description) {
      lines.push('', payload.entry.description);
    }
  }

  if (payload.children && payload.children.length) {
    lines.push('', '## Available properties', '');
    for (const child of payload.children) {
      const pieces = [`- \`${child.name}\``];
      if (child.type) {
        pieces.push(`type=\`${Array.isArray(child.type) ? child.type.join('|') : child.type}\``);
      }
      if (child.default !== null && child.default !== undefined) {
        pieces.push(`default=\`${child.default}\``);
      }
      if (child.hasChildren) {
        pieces.push('has-children');
      }
      lines.push(pieces.join(' '));
      if (child.description) {
        lines.push(`  - ${renderPropertyDescription(child.description, payload.fullDesc)}`);
      }
    }
  }

  return lines.join('\n');
}

function buildTextTree(results, options) {
  const opts = options || {};
  const nodeMap = new Map();

  function ensureNode(pathValue) {
    if (!nodeMap.has(pathValue)) {
      const name = pathValue.split('.').slice(-1)[0];
      nodeMap.set(pathValue, { path: pathValue, name, children: [], entry: null });
    }
    return nodeMap.get(pathValue);
  }

  for (const result of results) {
    const parts = result.path.split('.');
    for (let index = 0; index < parts.length; index += 1) {
      const pathValue = parts.slice(0, index + 1).join('.');
      const node = ensureNode(pathValue);
      if (index > 0) {
        const parentPath = parts.slice(0, index).join('.');
        const parent = ensureNode(parentPath);
        if (!parent.children.includes(pathValue)) {
          parent.children.push(pathValue);
        }
      }
      if (pathValue === result.path) {
        node.entry = result;
      }
    }
  }

  const roots = Array.from(nodeMap.values())
    .filter(node => !node.path.includes('.'))
    .sort((a, b) => {
      const orderA = a.entry && a.entry.order ? a.entry.order : Number.MAX_SAFE_INTEGER;
      const orderB = b.entry && b.entry.order ? b.entry.order : Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.path.localeCompare(b.path);
    });

  const lines = [];

  function visit(node, depth) {
    const entry = node.entry || {};
    const pieces = [`${'  '.repeat(depth)}${node.name}`];
    if (entry.type) {
      pieces.push(`type=${Array.isArray(entry.type) ? entry.type.join('|') : entry.type}`);
    }
    if (entry.default !== null && entry.default !== undefined) {
      pieces.push(`default=${entry.default}`);
    }
    lines.push(pieces.join(' '));

    if (opts.includeDescriptions && entry.description) {
      lines.push(`${'  '.repeat(depth + 1)}${renderPropertyDescription(entry.description, false)}`);
    }

    const children = node.children
      .map(pathValue => nodeMap.get(pathValue))
      .sort((a, b) => {
        const orderA = a.entry && a.entry.order ? a.entry.order : Number.MAX_SAFE_INTEGER;
        const orderB = b.entry && b.entry.order ? b.entry.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || a.path.localeCompare(b.path);
      });

    for (const child of children) {
      visit(child, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  return lines.join('\n');
}

function truncateLine(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCodeBlocks(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ');
}

function summarizeDescription(value) {
  let stripped = stripCodeBlocks(value)
    .replace(/\s+/g, ' ')
    .trim();

  const cutMarkers = ['如下示例', '示例：', '示例:', '例如：', '例如:', '详情参见教程', '详情参见'];
  let cutIndex = -1;
  for (const marker of cutMarkers) {
    const index = stripped.indexOf(marker);
    if (index >= 0 && (cutIndex === -1 || index < cutIndex)) {
      cutIndex = index;
    }
  }
  if (cutIndex > 0) {
    stripped = stripped.slice(0, cutIndex).trim();
  }

  const sentenceMatch = stripped.match(/^(.+?[。！？.!?])(?:\s|$)/u);
  if (sentenceMatch) {
    stripped = sentenceMatch[1].trim();
  }

  return truncateLine(stripped, 140);
}

function fullDescription(value) {
  return stripCodeBlocks(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function renderPropertyDescription(value, fullDesc) {
  return fullDesc ? fullDescription(value) : summarizeDescription(value);
}

function formatExampleListText(payload) {
  return payload.examples.map(example => `${example.title} — ${example.id}`).join('\n');
}

function formatExampleListMarkdown(payload) {
  const lines = ['| Title | ID |', '| --- | --- |'];
  for (const example of payload.examples) {
    lines.push(`| ${example.title} | ${example.id} |`);
  }
  return lines.join('\n');
}

function formatExampleText(payload) {
  return `${payload.title}\nID: ${payload.id}\n\n${payload.content}`;
}

function formatExampleMarkdown(payload) {
  return `# ${payload.title}\n\n- ID: \`${payload.id}\`\n\n\`\`\`html\n${payload.content}\n\`\`\``;
}

module.exports = {
  formatDetailedOptionMarkdown,
  formatDetailedOptionText,
  formatExampleListMarkdown,
  formatExampleListText,
  formatExampleMarkdown,
  formatExampleText,
  formatInfoMarkdown,
  formatInfoText,
  formatListMarkdown,
  formatListText,
  formatOptionQueryMarkdown,
  formatOptionQueryText,
  writeOutput
};
