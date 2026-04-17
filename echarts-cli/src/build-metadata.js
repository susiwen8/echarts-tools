const fs = require('fs');
const path = require('path');
const { decodeHtmlEntities } = require('./doc-utils');
const {
  camelToKebab,
  fileExists,
  humanize,
  normalizeName,
  pascalToCamel,
  readFile,
  resolveExamplesRoot,
  resolveWebsiteRoot,
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

const DOC_OPTION_HINTS = {
  axisPointer: 'documents/option-parts/option.axisPointer.json',
  angleAxis: 'documents/option-parts/option.angleAxis.json',
  aria: 'documents/option-parts/option.aria.json',
  brush: 'documents/option-parts/option.brush.json',
  calendar: 'documents/option-parts/option.calendar.json',
  dataZoomInside: 'documents/option-parts/option.dataZoom-inside.json',
  dataZoomSlider: 'documents/option-parts/option.dataZoom-slider.json',
  dataset: 'documents/option-parts/option.dataset.json',
  geo: 'documents/option-parts/option.geo.json',
  graphic: 'documents/option-parts/option.graphic.json',
  grid: 'documents/option-parts/option.grid.json',
  gridSimple: 'documents/option-parts/option.grid.json',
  legend: 'documents/option-parts/option.legend.json',
  legendPlain: 'documents/option-parts/option.legend.json',
  legendScroll: 'documents/option-parts/option.legend.json',
  matrix: 'documents/option-parts/option.matrix.json',
  parallel: 'documents/option-parts/option.parallel.json',
  parallelAxis: 'documents/option-parts/option.parallelAxis.json',
  polar: 'documents/option-parts/option.polar.json',
  radar: 'documents/option-parts/option.radar.json',
  radiusAxis: 'documents/option-parts/option.radiusAxis.json',
  singleAxis: 'documents/option-parts/option.singleAxis.json',
  textStyle: 'documents/option-parts/option.textStyle.json',
  thumbnail: 'documents/option-parts/option.thumbnail.json',
  timeline: 'documents/option-parts/option.timeline.json',
  title: 'documents/option-parts/option.title.json',
  toolbox: 'documents/option-parts/option.toolbox.json',
  tooltip: 'documents/option-parts/option.tooltip.json',
  visualMapContinuous: 'documents/option-parts/option.visualMap-continuous.json',
  visualMapPiecewise: 'documents/option-parts/option.visualMap-piecewise.json',
  xAxis: 'documents/option-parts/option.xAxis.json',
  yAxis: 'documents/option-parts/option.yAxis.json'
};

const DOC_TUTORIAL_HINTS = {
  aria: [{ zh: '在图表中支持无障碍访问', en: 'Supporting ARIA in Charts' }],
  canvas: [{ zh: '使用 Canvas 或者 SVG 渲染', en: 'Render by Canvas or SVG' }],
  custom: [{ zh: '自定义系列', en: 'Custom Series' }],
  dataZoom: [{ zh: '在图表中加入交互组件', en: 'Add interaction to the chart component' }],
  dataZoomInside: [{ zh: '在图表中加入交互组件', en: 'Add interaction to the chart component' }],
  dataZoomSlider: [{ zh: '在图表中加入交互组件', en: 'Add interaction to the chart component' }],
  dataset: [{ zh: '使用 dataset 管理数据', en: 'Dataset' }],
  graphic: [{ zh: '小例子：自己实现拖拽', en: 'An Example: Implement Dragging' }],
  svg: [{ zh: '使用 Canvas 或者 SVG 渲染', en: 'Render by Canvas or SVG' }],
  transform: [{ zh: '使用 transform 进行数据转换', en: 'Data Transform' }],
  visualMap: [{ zh: '数据的视觉映射', en: 'Visual Map of Data' }],
  visualMapContinuous: [{ zh: '数据的视觉映射', en: 'Visual Map of Data' }],
  visualMapPiecewise: [{ zh: '数据的视觉映射', en: 'Visual Map of Data' }]
};

const MAPBOX_ACCESS_TOKEN_PATTERN = /pk\.[A-Za-z0-9._-]{20,}/g;

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
      .replace(/<code[\s\S]*?<\/code>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeExampleContent(content) {
  return String(content || '').replace(MAPBOX_ACCESS_TOKEN_PATTERN, '<MAPBOX_ACCESS_TOKEN>');
}

function loadOptionRootMeta(websiteRoot, locale) {
  if (!websiteRoot) {
    return {};
  }

  const filePath = path.join(websiteRoot, locale, 'documents', 'option.json');
  if (!fileExists(filePath)) {
    return {};
  }

  const root = JSON.parse(readFile(filePath));
  const properties = (root.option && root.option.properties) || {};
  const meta = {};

  for (const [name, entry] of Object.entries(properties)) {
    meta[name] = {
      summary: stripHtml(entry.description || ''),
      type: entry.type || null,
      default: Object.prototype.hasOwnProperty.call(entry, 'default') ? entry.default : null
    };
  }

  return meta;
}

function parseDocMeta(source) {
  const lines = source.split(/\r?\n/);
  const titleLine = lines.find(line => /^#\s+/.test(line.trim()));
  const title = stripMarkdown(titleLine ? titleLine.replace(/^#\s+/, '') : '');

  const blocks = [];
  let codeFence = false;
  let ignoredTagBlock = null;
  let ignoredTemplateBlock = false;
  let currentBlock = [];

  function flushBlock() {
    if (currentBlock.length) {
      const cleaned = stripMarkdown(currentBlock.join(' '));
      if (cleaned) {
        blocks.push(cleaned);
      }
      currentBlock = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      codeFence = !codeFence;
      flushBlock();
      continue;
    }

    if (ignoredTemplateBlock) {
      if (line.includes('}}')) {
        ignoredTemplateBlock = false;
      }
      continue;
    }

    if (ignoredTagBlock) {
      if (line.startsWith(`</${ignoredTagBlock}`)) {
        ignoredTagBlock = null;
      }
      continue;
    }

    if (codeFence || !line) {
      flushBlock();
      continue;
    }

    if (/^{{/.test(line)) {
      flushBlock();
      if (!line.includes('}}')) {
        ignoredTemplateBlock = true;
      }
      continue;
    }

    if (/^#+\s+/.test(line) || /^~\[/.test(line) || /^---+$/.test(line)) {
      flushBlock();
      continue;
    }

    const ignoredTagMatch = line.match(/^<(ExampleBaseOption|ExampleUIControlBoolean|ExampleUIControlEnum|ExampleUIControlNumber|ExampleUIControl|template|script|style)\b/);
    if (ignoredTagMatch) {
      flushBlock();
      if (!/\/>$/.test(line)) {
        ignoredTagBlock = ignoredTagMatch[1];
      }
      continue;
    }

    currentBlock.push(line);
  }
  flushBlock();

  const summaryParts = [];
  for (const block of blocks) {
    if (block === title) {
      continue;
    }
    summaryParts.push(block);
    const summaryText = summaryParts.join(' ');
    const firstBlock = summaryParts[0] || '';
    const firstBlockLooksComplete = firstBlock.length >= 48 || /[。！？.!?]$/.test(firstBlock);
    if (summaryParts.length >= 2 || summaryText.length >= 160 || firstBlockLooksComplete) {
      break;
    }
  }

  return {
    title: title || null,
    summary: /^- Type:/i.test(summaryParts.join(' ').trim())
      ? null
      : (summaryParts.join(' ').trim() || null)
  };
}

function createDocRef(websiteRoot, locale, relativePath, overrideMeta) {
  const normalizedPath = relativePath.split('/').join(path.sep);
  const absolutePath = path.join(websiteRoot, locale, normalizedPath);
  if (!fileExists(absolutePath)) {
    return null;
  }

  const source = readFile(absolutePath);
  let meta;
  if (relativePath.endsWith('.json')) {
    const title = path.basename(relativePath, '.json');
    meta = {
      title,
      summary: null
    };
  }
  else {
    meta = parseDocMeta(source);
  }

  return {
    relativePath: `${locale}/${relativePath}`,
    title: meta.title,
    summary: (overrideMeta && overrideMeta.summary) || meta.summary
  };
}

function createLocalizedDocBundle(websiteRoot, relativePath, metaByLocale) {
  if (!relativePath || !websiteRoot) {
    return null;
  }

  const zh = createDocRef(websiteRoot, 'zh', relativePath, metaByLocale && metaByLocale.zh);
  const en = createDocRef(websiteRoot, 'en', relativePath, metaByLocale && metaByLocale.en);

  if (!zh && !en) {
    return null;
  }

  return { zh, en };
}

function resolveOptionDocRelativePath(kind, name) {
  if (DOC_OPTION_HINTS[name]) {
    return DOC_OPTION_HINTS[name];
  }

  if (kind === 'chart') {
    return `documents/option-parts/option.series-${name}.json`;
  }

  return `documents/option-parts/option.${camelToKebab(name)}.json`;
}

function loadTutorialIndex(websiteRoot, locale) {
  if (!websiteRoot) {
    return null;
  }

  const filePath = path.join(websiteRoot, locale, 'documents', 'tutorial-parts', 'tutorial.json');
  if (!fileExists(filePath)) {
    return null;
  }

  return JSON.parse(readFile(filePath));
}

function createTutorialRef(websiteRoot, locale, title) {
  const index = loadTutorialIndex(websiteRoot, locale);
  if (!index || !index[title]) {
    return null;
  }

  return {
    relativePath: `${locale}/documents/tutorial-parts/tutorial.json#${encodeURIComponent(title)}`,
    title,
    summary: stripHtml(index[title].desc)
  };
}

function createLocalizedTutorialBundle(websiteRoot, zhTitle, enTitle) {
  const zh = createTutorialRef(websiteRoot, 'zh', zhTitle);
  const en = createTutorialRef(websiteRoot, 'en', enTitle);

  if (!zh && !en) {
    return null;
  }

  return { zh, en };
}

function buildDocsPayload(kind, name, websiteRoot, optionRootMeta) {
  const optionDocPath = resolveOptionDocRelativePath(kind, name);
  const option = createLocalizedDocBundle(websiteRoot, optionDocPath, optionRootMeta && optionRootMeta[name]
    ? {
      zh: optionRootMeta[name].zh,
      en: optionRootMeta[name].en
    }
    : null);
  const tutorials = (DOC_TUTORIAL_HINTS[name] || [])
    .map(tutorial => createLocalizedTutorialBundle(websiteRoot, tutorial.zh, tutorial.en))
    .filter(Boolean);

  return {
    option,
    tutorials
  };
}

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
  const examplesRoot = resolveExamplesRoot(repoRoot);
  const sourceRoot = examplesRoot
    ? path.join(examplesRoot, 'public', 'examples')
    : path.join(repoRoot, 'test');
  const sourceFiles = walkFiles(
    sourceRoot,
    (absolutePath, fileName) => {
      if (absolutePath.includes(`${path.sep}types${path.sep}`)) {
        return false;
      }
      return absolutePath.endsWith('.html')
        || absolutePath.endsWith('.js')
        || (absolutePath.endsWith('.ts') && !fileName.endsWith('.d.ts'));
    }
  );

  return sourceFiles.map(filePath => {
    const file = path.basename(filePath);
    const normalizedId = file.endsWith('.html')
      ? path.basename(filePath, '.html')
      : path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(examplesRoot || repoRoot, filePath).split(path.sep).join('/');
    const content = sanitizeExampleContent(readFile(filePath));
    const exampleTitle = extractExampleTitle(content);
    return {
      id: normalizedId,
      file,
      title: exampleTitle || humanize(normalizedId),
      relativePath,
      tokens: uniqBy(tokenize(normalizedId), token => token),
      content
    };
  });
}

function extractExampleTitle(content) {
  const blockMatch = String(content || '').match(/\/\*([\s\S]*?)\*\//);
  if (!blockMatch) {
    return null;
  }

  const block = blockMatch[1];
  const titleCnMatch = block.match(/^\s*titleCN:\s*(.+)\s*$/m);
  if (titleCnMatch) {
    return titleCnMatch[1].trim();
  }

  const titleMatch = block.match(/^\s*title:\s*(.+)\s*$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  return null;
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
  const websiteRoot = resolveWebsiteRoot(repoRoot);
  const optionRootMeta = {};
  if (websiteRoot) {
    const zhMeta = loadOptionRootMeta(websiteRoot, 'zh');
    const enMeta = loadOptionRootMeta(websiteRoot, 'en');
    for (const key of new Set([...Object.keys(zhMeta), ...Object.keys(enMeta)])) {
      optionRootMeta[key] = {
        zh: zhMeta[key] || null,
        en: enMeta[key] || null
      };
    }
  }
  const optionSource = readFile(path.join(repoRoot, 'src', 'export', 'option.ts'));
  const registeredSeries = parseRegisteredSeries(optionSource);
  const optionIndex = parseTopLevelOptions(optionSource)
    .map(option => ({
      ...option,
      docs: buildDocsPayload('option', option.name, websiteRoot, optionRootMeta)
    }));

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
  ).map(item => ({
    ...item,
    docs: buildDocsPayload(item.kind, item.name, websiteRoot, optionRootMeta)
  }));

  return {
    generatedAt: new Date().toISOString(),
    docsRoot: websiteRoot ? path.relative(repoRoot, websiteRoot).split(path.sep).join('/') || '.' : null,
    repoRoot,
    items,
    examples,
    optionIndex
  };
}

module.exports = {
  buildMetadata
};
