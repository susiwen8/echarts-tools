const fs = require('fs');
const path = require('path');

function packageRoot() {
  return path.resolve(__dirname, '..');
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  }
  catch (error) {
    return false;
  }
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function resolveRepoRoot(startDir) {
  const explicit = process.env.ECHARTS_CLI_REPO_ROOT;
  const candidates = [];
  let current = explicit || startDir || packageRoot();

  while (current && !candidates.includes(current)) {
    candidates.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  for (const candidate of candidates) {
    const possibleRoots = [
      candidate,
      path.join(candidate, 'echarts')
    ];
    for (const possibleRoot of possibleRoots) {
      if (fileExists(path.join(possibleRoot, 'src', 'export', 'charts.ts'))
        && fileExists(path.join(possibleRoot, 'test'))
      ) {
        return possibleRoot;
      }
    }
  }

  return null;
}

function pascalToCamel(value) {
  if (!value) {
    return value;
  }
  return value
    .replace(/^[A-Z]+(?=[A-Z][a-z]|$)/, match => match.toLowerCase())
    .replace(/^[A-Z]/, match => match.toLowerCase());
}

function normalizeName(value) {
  return String(value || '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function tokenize(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
}

function humanize(value) {
  return tokenize(value)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function walkFiles(dirPath, matcher, state) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const output = state || [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolutePath, matcher, output);
      continue;
    }
    if (matcher(absolutePath, entry.name)) {
      output.push(absolutePath);
    }
  }

  return output;
}

module.exports = {
  fileExists,
  humanize,
  normalizeName,
  packageRoot,
  pascalToCamel,
  readFile,
  resolveRepoRoot,
  tokenize,
  uniqBy,
  walkFiles
};
