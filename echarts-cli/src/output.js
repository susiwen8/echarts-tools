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
  if (payload.examples.length) {
    lines.push('', '## Examples', '');
    for (const example of payload.examples) {
      lines.push(`- \`${example.file}\``);
    }
  }

  return lines.join('\n');
}

function formatExampleListText(payload) {
  return payload.examples.map(example => `${example.file} (${example.relativePath})`).join('\n');
}

function formatExampleListMarkdown(payload) {
  const lines = ['| File | Path |', '| --- | --- |'];
  for (const example of payload.examples) {
    lines.push(`| ${example.file} | ${example.relativePath} |`);
  }
  return lines.join('\n');
}

function formatExampleText(payload) {
  return `${payload.file}\n\n${payload.content}`;
}

function formatExampleMarkdown(payload) {
  return `# ${payload.file}\n\n\`\`\`html\n${payload.content}\n\`\`\``;
}

module.exports = {
  formatExampleListMarkdown,
  formatExampleListText,
  formatExampleMarkdown,
  formatExampleText,
  formatInfoMarkdown,
  formatInfoText,
  formatListMarkdown,
  formatListText,
  writeOutput
};
