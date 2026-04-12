const fs = require('fs');
const path = require('path');
const {
  humanize,
  normalizeName,
  pascalToCamel,
  readFile,
  tokenize,
  uniqBy,
  walkFiles
} = require('./shared');

const COMPONENT_TOP_LEVEL_HINTS = {
  aria: { topLevelKey: 'aria', optionPath: 'aria' },
  axisPointer: { topLevelKey: 'axisPointer', optionPath: 'axisPointer' },
  brush: { topLevelKey: 'brush', optionPath: 'brush' },
  calendar: { topLevelKey: 'calendar[]', optionPath: 'calendar[]' },
  dataZoom: { topLevelKey: 'dataZoom[]', optionPath: 'dataZoom[]' },
  dataZoomInside: { topLevelKey: 'dataZoom[]', optionPath: 'dataZoom[].type = "inside"' },
  dataZoomSlider: { topLevelKey: 'dataZoom[]', optionPath: 'dataZoom[].type = "slider"' },
  dataset: { topLevelKey: 'dataset[]', optionPath: 'dataset[]' },
  geo: { topLevelKey: 'geo[]', optionPath: 'geo[]' },
  graphic: { topLevelKey: 'graphic[]', optionPath: 'graphic[]' },
  grid: { topLevelKey: 'grid[]', optionPath: 'grid[]' },
  gridSimple: { topLevelKey: 'grid[]', optionPath: 'grid[]' },
  legend: { topLevelKey: 'legend[]', optionPath: 'legend[]' },
  legendPlain: { topLevelKey: 'legend[]', optionPath: 'legend[]' },
  legendScroll: { topLevelKey: 'legend[]', optionPath: 'legend[]' },
  markArea: { topLevelKey: 'series[].markArea', optionPath: 'series[].markArea' },
  markLine: { topLevelKey: 'series[].markLine', optionPath: 'series[].markLine' },
  markPoint: { topLevelKey: 'series[].markPoint', optionPath: 'series[].markPoint' },
  matrix: { topLevelKey: 'matrix[]', optionPath: 'matrix[]' },
  parallel: { topLevelKey: 'parallel[]', optionPath: 'parallel[]' },
  polar: { topLevelKey: 'polar[]', optionPath: 'polar[]' },
  radar: { topLevelKey: 'radar[]', optionPath: 'radar[]' },
  singleAxis: { topLevelKey: 'singleAxis[]', optionPath: 'singleAxis[]' },
  thumbnail: { topLevelKey: 'thumbnail[]', optionPath: 'thumbnail[]' },
  timeline: { topLevelKey: 'timeline', optionPath: 'timeline' },
  title: { topLevelKey: 'title[]', optionPath: 'title[]' },
  toolbox: { topLevelKey: 'toolbox', optionPath: 'toolbox' },
  tooltip: { topLevelKey: 'tooltip', optionPath: 'tooltip' },
  transform: { topLevelKey: 'dataset[].transform', optionPath: 'dataset[].transform' },
  visualMap: { topLevelKey: 'visualMap[]', optionPath: 'visualMap[]' },
  visualMapContinuous: { topLevelKey: 'visualMap[]', optionPath: 'visualMap[].type = "continuous"' },
  visualMapPiecewise: { topLevelKey: 'visualMap[]', optionPath: 'visualMap[].type = "piecewise"' }
};

function parseNamedExports(source, segment, kind, suffix) {
  const pattern = new RegExp(`export \\{install(?:[A-Za-z0-9_]+)? as ([A-Za-z0-9_]+)\\} from '\\.\\.\\/${segment}\\/([^']+)';`, 'g');
  const items = [];
  let match = pattern.exec(source);

  while (match) {
    const exportName = match[1];
    const relativeImport = match[2];
    const normalizedBase = exportName.endsWith(suffix)
      ? exportName.slice(0, exportName.length - suffix.length)
      : exportName;
    const name = pascalToCamel(normalizedBase);
    const installPath = path.posix.join('src', segment, `${relativeImport}.ts`);

    items.push({
      name,
      kind,
      exportName,
      installPath,
      sourcePath: installPath
    });
    match = pattern.exec(source);
  }

  return items;
}

function parseFeatureExports(source) {
  const pattern = /export \{install(?:[A-Za-z0-9_]+)? as ([A-Za-z0-9_]+)\} from '\.\.\/([^']+)';/g;
  const items = [];
  let match = pattern.exec(source);

  while (match) {
    const exportName = match[1];
    const relativeImport = match[2];
    const name = pascalToCamel(exportName);
    const sourcePath = path.posix.join('src', `${relativeImport}.ts`);

    items.push({
      name,
      kind: 'feature',
      exportName,
      installPath: sourcePath,
      sourcePath
    });
    match = pattern.exec(source);
  }

  return items;
}

function parseRegisteredSeries(source) {
  const blockMatch = source.match(/export interface RegisteredSeriesOption \{([\s\S]*?)\n\}/);
  const result = {};
  if (!blockMatch) {
    return result;
  }

  const pattern = /^\s*([A-Za-z0-9]+):\s*([A-Za-z0-9]+)\s*$/gm;
  let match = pattern.exec(blockMatch[1]);
  while (match) {
    result[match[1]] = match[2];
    match = pattern.exec(blockMatch[1]);
  }
  return result;
}

function parseTopLevelOptions(source) {
  const blockMatch = source.match(/export interface EChartsOption extends ECBasicOption \{([\s\S]*?)\n\}/);
  const items = [];
  if (!blockMatch) {
    return items;
  }

  const lines = blockMatch[1].split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z0-9]+)\?:\s*(.+);$/);
    if (!match) {
      continue;
    }
    const rawType = match[2].trim();
    const key = match[1];
    const arrayAllowed = /\[\]/.test(rawType);
    items.push({
      name: key,
      topLevelKey: arrayAllowed ? `${key}[]` : key,
      optionPath: arrayAllowed ? `${key}[]` : key,
      rawType,
      arrayAllowed
    });
  }

  return items;
}

function parseInstallDependencies(repoRoot, relativeFilePath) {
  const absolutePath = path.join(repoRoot, relativeFilePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const source = readFile(absolutePath);
  const importAliases = {};
  const importPattern = /import\s+\{\s*install(?:[A-Za-z0-9_]+)?\s+as\s+([A-Za-z0-9_]+)\s*\}\s+from\s+'([^']+)';/g;
  let importMatch = importPattern.exec(source);
  while (importMatch) {
    importAliases[importMatch[1]] = importMatch[2];
    importMatch = importPattern.exec(source);
  }

  const dependencyPattern = /use\(([A-Za-z0-9_]+)\);/g;
  const dependencies = [];
  let dependencyMatch = dependencyPattern.exec(source);
  while (dependencyMatch) {
    const alias = dependencyMatch[1];
    const importPath = importAliases[alias];
    if (!importPath) {
      dependencyMatch = dependencyPattern.exec(source);
      continue;
    }

    const pathParts = importPath.split('/');
    const namePart = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
    dependencies.push(pascalToCamel(namePart.replace(/^install/, '')));
    dependencyMatch = dependencyPattern.exec(source);
  }

  return uniqBy(dependencies, value => value);
}

function buildExamples(repoRoot) {
  const htmlFiles = walkFiles(
    path.join(repoRoot, 'test'),
    absolutePath => absolutePath.endsWith('.html')
  );

  return htmlFiles.map(filePath => {
    const file = path.basename(filePath);
    const id = path.basename(filePath, '.html');
    const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
    const content = readFile(filePath);
    return {
      id,
      file,
      title: humanize(id),
      relativePath,
      tokens: uniqBy(tokenize(id), token => token),
      content
    };
  });
}

function scoreExample(example, query) {
  const normalizedQuery = normalizeName(query);
  const normalizedId = normalizeName(example.id);
  if (!normalizedQuery) {
    return 0;
  }
  if (normalizedId === normalizedQuery) {
    return 100;
  }
  if (normalizedId.startsWith(normalizedQuery)) {
    return 80;
  }
  if (example.tokens.includes(normalizedQuery)) {
    return 70;
  }
  if (normalizedId.includes(normalizedQuery)) {
    return 50;
  }
  return 0;
}

function linkExamples(items, examples) {
  return items.map(item => {
    const linkedExamples = examples
      .map(example => ({
        example,
        score: scoreExample(example, item.name)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || a.example.file.localeCompare(b.example.file))
      .slice(0, 8)
      .map(result => ({
        id: result.example.id,
        file: result.example.file,
        title: result.example.title,
        relativePath: result.example.relativePath
      }));

    return {
      ...item,
      examples: linkedExamples
    };
  });
}

function enrichChartItems(items, registeredSeries, repoRoot) {
  return items.map(item => ({
    ...item,
    optionType: registeredSeries[item.name] || null,
    topLevelKey: 'series[]',
    optionPath: `series[].type = "${item.name}"`,
    dependencies: parseInstallDependencies(repoRoot, item.installPath)
  }));
}

function resolveComponentHint(name, optionIndex) {
  if (COMPONENT_TOP_LEVEL_HINTS[name]) {
    return COMPONENT_TOP_LEVEL_HINTS[name];
  }

  const exact = optionIndex.find(option => option.name === name);
  if (exact) {
    return {
      topLevelKey: exact.topLevelKey,
      optionPath: exact.optionPath
    };
  }

  const prefixes = Object.keys(COMPONENT_TOP_LEVEL_HINTS).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return COMPONENT_TOP_LEVEL_HINTS[prefix];
    }
  }

  return {
    topLevelKey: null,
    optionPath: null
  };
}

function enrichComponentItems(items, repoRoot, optionIndex) {
  return items.map(item => {
    const hint = resolveComponentHint(item.name, optionIndex);
    const exactOption = optionIndex.find(option => option.name === item.name);
    return {
      ...item,
      optionType: exactOption ? exactOption.rawType : null,
      topLevelKey: hint.topLevelKey,
      optionPath: hint.optionPath,
      dependencies: parseInstallDependencies(repoRoot, item.installPath)
    };
  });
}

function enrichRendererItems(items) {
  return items.map(item => ({
    ...item,
    optionType: null,
    topLevelKey: 'initOptions.renderer',
    optionPath: `echarts.init(dom, null, { renderer: "${item.name}" })`,
    dependencies: []
  }));
}

function enrichFeatureItems(items, repoRoot) {
  return items.map(item => ({
    ...item,
    optionType: null,
    topLevelKey: null,
    optionPath: null,
    dependencies: parseInstallDependencies(repoRoot, item.installPath)
  }));
}

function buildMetadata(repoRoot) {
  const optionSource = readFile(path.join(repoRoot, 'src', 'export', 'option.ts'));
  const registeredSeries = parseRegisteredSeries(optionSource);
  const optionIndex = parseTopLevelOptions(optionSource);

  const charts = enrichChartItems(
    parseNamedExports(readFile(path.join(repoRoot, 'src', 'export', 'charts.ts')), 'chart', 'chart', 'Chart'),
    registeredSeries,
    repoRoot
  );

  const components = enrichComponentItems(
    parseNamedExports(readFile(path.join(repoRoot, 'src', 'export', 'components.ts')), 'component', 'component', 'Component'),
    repoRoot,
    optionIndex
  );

  const features = enrichFeatureItems(
    parseFeatureExports(readFile(path.join(repoRoot, 'src', 'export', 'features.ts'))),
    repoRoot
  );

  const renderers = enrichRendererItems(
    parseNamedExports(readFile(path.join(repoRoot, 'src', 'export', 'renderers.ts')), 'renderer', 'renderer', 'Renderer')
  );

  const examples = buildExamples(repoRoot);
  const items = linkExamples(
    uniqBy([...charts, ...components, ...features, ...renderers], item => `${item.kind}:${item.name}`),
    examples
  );

  return {
    generatedAt: new Date().toISOString(),
    repoRoot,
    items,
    examples,
    optionIndex
  };
}

module.exports = {
  buildMetadata
};
