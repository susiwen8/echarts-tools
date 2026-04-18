const path = require('path');
const fs = require('fs');
const os = require('os');
const test = require('node:test');
const assert = require('node:assert/strict');
const { runRustBuildData, runRustCli } = require('./helpers/parity');

function makeFixture(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function createPackagedMetadataFixture() {
  const fixtureRoot = makeFixture('echarts-cli-rust-build-data');
  fs.cpSync(path.resolve(__dirname, '..', 'scripts'), path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'package.json'), path.join(fixtureRoot, 'package.json'));
  fs.cpSync(path.resolve(__dirname, '..', 'bin'), path.join(fixtureRoot, 'bin'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'node_modules'), path.join(fixtureRoot, 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'data'), { recursive: true });
  return fixtureRoot;
}

function createMetadataWithInlineContentFixture() {
  const fixtureRoot = createPackagedMetadataFixture();

  const websiteRoot = path.join(fixtureRoot, 'website');
  const examplesRoot = path.join(fixtureRoot, 'examples-source');
  fs.mkdirSync(path.join(websiteRoot, 'zh', 'documents', 'option-parts'), { recursive: true });
  fs.mkdirSync(path.join(websiteRoot, 'en', 'documents', 'option-parts'), { recursive: true });
  fs.mkdirSync(path.join(websiteRoot, 'zh', 'documents', 'tutorial-parts'), { recursive: true });
  fs.mkdirSync(path.join(websiteRoot, 'en', 'documents', 'tutorial-parts'), { recursive: true });
  fs.mkdirSync(path.join(examplesRoot, 'public', 'examples', 'ts', 'gl'), { recursive: true });

  const metadata = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    docsRoot: 'data/docs',
    repoRoot: null,
    items: [
      {
        name: 'line',
        kind: 'chart',
        exportName: 'LineChart',
        installPath: null,
        sourcePath: 'src/chart/line/install.ts',
        optionType: 'LineSeriesOption',
        topLevelKey: 'series[]',
        optionPath: 'series[].type = "line"',
        dependencies: [],
        examples: [
          {
            id: 'line-simple',
            file: 'line-simple.ts',
            title: '基础折线图',
            relativePath: 'public/examples/ts/line-simple.ts'
          }
        ],
        docs: {
          option: {
            zh: { relativePath: 'zh/documents/option-parts/option.series-line.json', title: 'option.series-line', summary: null },
            en: { relativePath: 'en/documents/option-parts/option.series-line.json', title: 'option.series-line', summary: null }
          },
          tutorials: []
        }
      },
      {
        name: 'tooltip',
        kind: 'option',
        exportName: 'tooltip',
        installPath: null,
        sourcePath: 'src/export/option.ts',
        optionType: 'TooltipComponentOption',
        topLevelKey: 'tooltip',
        optionPath: 'tooltip',
        dependencies: [],
        examples: [],
        docs: {
          option: {
            zh: { relativePath: 'zh/documents/option-parts/option.tooltip.json', title: 'option.tooltip', summary: '提示框' },
            en: { relativePath: 'en/documents/option-parts/option.tooltip.json', title: 'option.tooltip', summary: null }
          },
          tutorials: []
        }
      }
    ],
    examples: [
      {
        id: 'line-simple',
        file: 'line-simple.ts',
        title: '基础折线图',
        relativePath: 'public/examples/ts/line-simple.ts',
        tokens: ['line', 'simple'],
        content: "/*\n titleCN: 基础折线图\n*/\nconst option = { series: [{ type: 'line' }] };\n"
      },
      {
        id: 'bar3d-on-mapbox',
        file: 'bar3d-on-mapbox.js',
        title: 'Mapbox Demo',
        relativePath: 'public/examples/ts/gl/bar3d-on-mapbox.js',
        tokens: ['bar3d', 'on', 'mapbox'],
        content: "/*\n title: Mapbox Demo\n*/\nconst token = 'pk.abcdefghijklmnopqrstuvwxyz0123456789ABCD';\n"
      }
    ],
    optionIndex: [
      {
        name: 'xAxis',
        topLevelKey: 'xAxis[]',
        optionPath: 'xAxis[]',
        rawType: 'XAXisComponentOption | XAXisComponentOption[]',
        arrayAllowed: true,
        docs: {
          option: {
            zh: { relativePath: 'zh/documents/option-parts/option.xAxis.json', title: 'option.xAxis', summary: 'X 轴' },
            en: { relativePath: 'en/documents/option-parts/option.xAxis.json', title: 'option.xAxis', summary: 'X Axis' }
          },
          tutorials: []
        }
      },
      {
        name: 'tooltip',
        topLevelKey: 'tooltip',
        optionPath: 'tooltip',
        rawType: 'TooltipComponentOption',
        arrayAllowed: false,
        docs: {
          option: {
            zh: { relativePath: 'zh/documents/option-parts/option.tooltip.json', title: 'option.tooltip', summary: '提示框' },
            en: { relativePath: 'en/documents/option-parts/option.tooltip.json', title: 'option.tooltip', summary: null }
          },
          tutorials: []
        }
      }
    ]
  };

  fs.writeFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), JSON.stringify(metadata, null, 2));

  const outline = {
    prop: 'option',
    isObject: true,
    children: [
      {
        prop: 'series',
        isObject: true,
        children: [
          { prop: 'smooth', type: 'boolean', default: false, isObject: false }
        ]
      },
      {
        prop: 'xAxis',
        isObject: true,
        children: [
          { prop: 'type', type: 'string', default: 'category', isObject: false }
        ]
      },
      {
        prop: 'tooltip',
        isObject: true,
        children: []
      }
    ]
  };

  for (const locale of ['zh', 'en']) {
    fs.writeFileSync(path.join(websiteRoot, locale, 'documents', 'tutorial-parts', 'tutorial.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(websiteRoot, locale, 'documents', 'option-parts', 'option-outline.json'), JSON.stringify(outline));
  }

  fs.writeFileSync(path.join(websiteRoot, 'zh', 'documents', 'option.json'), JSON.stringify({ option: { properties: { xAxis: { description: '<p>X 轴</p>', type: 'Object' }, tooltip: { description: '<p>提示框</p>', type: 'Object' } } } }));
  fs.writeFileSync(path.join(websiteRoot, 'en', 'documents', 'option.json'), JSON.stringify({ option: { properties: { xAxis: { description: '<p>X Axis</p>', type: 'Object' }, tooltip: { description: '<p>Tooltip</p>', type: 'Object' } } } }));
  fs.writeFileSync(path.join(websiteRoot, 'zh', 'documents', 'option-parts', 'option.series-line.json'), JSON.stringify({ smooth: { desc: '<p>Smooth &amp; fast</p>' } }));
  fs.writeFileSync(path.join(websiteRoot, 'en', 'documents', 'option-parts', 'option.series-line.json'), JSON.stringify({ smooth: { desc: '<p>Smooth &amp; fast</p>' } }));
  fs.writeFileSync(path.join(websiteRoot, 'zh', 'documents', 'option-parts', 'option.tooltip.json'), JSON.stringify({}));
  fs.writeFileSync(path.join(websiteRoot, 'en', 'documents', 'option-parts', 'option.tooltip.json'), JSON.stringify({}));
  fs.writeFileSync(path.join(websiteRoot, 'zh', 'documents', 'option-parts', 'option.xAxis.json'), JSON.stringify({ type: { desc: '<p>坐标轴类型。</p>' } }));
  fs.writeFileSync(path.join(websiteRoot, 'en', 'documents', 'option-parts', 'option.xAxis.json'), JSON.stringify({ type: { desc: '<p>Axis type.</p>' } }));

  fs.writeFileSync(path.join(examplesRoot, 'public', 'examples', 'ts', 'line-simple.ts'), "/*\n titleCN: 基础折线图\n*/\nconst option = { series: [{ type: 'line' }] };\n");
  fs.writeFileSync(path.join(examplesRoot, 'public', 'examples', 'ts', 'gl', 'bar3d-on-mapbox.js'), "/*\n title: Mapbox Demo\n*/\nconst token = 'pk.abcdefghijklmnopqrstuvwxyz0123456789ABCD';\n");

  return { fixtureRoot, websiteRoot, examplesRoot };
}

function createSplitMetadataFixture() {
  const fixtureRoot = createPackagedMetadataFixture();
  const examplesRoot = path.join(fixtureRoot, 'examples-source');
  fs.mkdirSync(path.join(examplesRoot, 'public', 'examples', 'ts'), { recursive: true });

  const metadata = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    docsRoot: 'data/docs',
    repoRoot: null,
    items: [],
    examples: [
      {
        id: 'line-simple',
        file: 'line-simple.ts',
        title: '基础折线图',
        relativePath: 'public/examples/ts/line-simple.ts',
        tokens: ['line', 'simple'],
        contentPath: 'examples/public/examples/ts/line-simple.ts'
      }
    ],
    optionIndex: []
  };

  fs.writeFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(
    path.join(examplesRoot, 'public', 'examples', 'ts', 'line-simple.ts'),
    "/*\n titleCN: 基础折线图\n*/\nconst option = { series: [{ type: 'line' }] };\n"
  );

  return { fixtureRoot, examplesRoot };
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortJson(value[key])]));
  }
  return value;
}

test('rust build-data falls back to bundled metadata when repo sources are unavailable', () => {
  const fixtureRoot = createPackagedMetadataFixture();
  fs.cpSync(path.resolve(__dirname, '..', 'data'), path.join(fixtureRoot, 'data'), { recursive: true });

  const result = runRustBuildData([], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });

  assert.equal(result.status, 0, result.stderr || `rust build-data exited with ${result.status}`);
  assert.match(result.stdout, /Wrote .*metadata\.json/i);

  const metadata = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), 'utf8'));
  assert.ok(Array.isArray(metadata.items));
  assert.ok(metadata.items.length > 0);
});

test('rust build-data rewrites examples/docs from packaged metadata plus non-repo sources', () => {
  const { fixtureRoot, websiteRoot, examplesRoot } = createMetadataWithInlineContentFixture();

  const result = runRustBuildData([], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_WEBSITE_ROOT: websiteRoot,
      ECHARTS_CLI_EXAMPLES_ROOT: examplesRoot,
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });

  assert.equal(result.status, 0, result.stderr || `rust build-data exited with ${result.status}`);
  assert.match(result.stdout, /Wrote .*metadata\.json/);

  const metadata = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), 'utf8'));
  assert.ok(metadata.examples.every(example => example.content === undefined));
  assert.ok(metadata.examples.every(example => example.contentPath));

  const mapboxPath = path.join(fixtureRoot, 'data', 'examples', 'public', 'examples', 'ts', 'gl', 'bar3d-on-mapbox.js');
  const mapboxContent = fs.readFileSync(mapboxPath, 'utf8');
  assert.doesNotMatch(mapboxContent, /pk\.[A-Za-z0-9._-]{20,}/);
  assert.match(mapboxContent, /<MAPBOX_ACCESS_TOKEN>/);

  const xAxisDoc = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'data', 'docs', 'zh', 'documents', 'option-parts', 'option.xAxis.json'), 'utf8'));
  assert.equal(xAxisDoc.content, undefined);
  assert.ok(xAxisDoc.entries.type);
});

test('rust runtime consumes packaged artifacts produced by rust build-data', () => {
  const { fixtureRoot, websiteRoot, examplesRoot } = createMetadataWithInlineContentFixture();
  const buildResult = runRustBuildData([], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_WEBSITE_ROOT: websiteRoot,
      ECHARTS_CLI_EXAMPLES_ROOT: examplesRoot,
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });
  assert.equal(buildResult.status, 0, buildResult.stderr || `rust build-data exited with ${buildResult.status}`);

  const cliResult = runRustCli(['example', 'line', 'line-simple.ts', '--format', 'json'], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_WEBSITE_ROOT: '/definitely/missing/website',
      ECHARTS_CLI_EXAMPLES_ROOT: '/definitely/missing/examples',
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });
  assert.equal(cliResult.status, 0, cliResult.stderr || `rust cli exited with ${cliResult.status}`);
  const payload = JSON.parse(cliResult.stdout);
  assert.equal(payload.id, 'line-simple');
  assert.match(payload.content, /type:\s*'line'/);

  const optionResult = runRustCli(['option', 'xAxis.type', '--format', 'json'], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_WEBSITE_ROOT: '/definitely/missing/website',
      ECHARTS_CLI_EXAMPLES_ROOT: '/definitely/missing/examples',
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });
  assert.equal(optionResult.status, 0, optionResult.stderr || `rust cli exited with ${optionResult.status}`);
  const optionPayload = JSON.parse(optionResult.stdout);
  assert.equal(optionPayload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.equal(optionPayload.entry.path, 'type');
  assert.equal(optionPayload.entry.type, 'string');
  assert.equal(optionPayload.entry.default, 'category');
});

test('rust build-data restores packaged example files from split metadata when source checkout is available', () => {
  const { fixtureRoot, examplesRoot } = createSplitMetadataFixture();

  const result = runRustBuildData([], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_EXAMPLES_ROOT: examplesRoot,
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });

  assert.equal(result.status, 0, result.stderr || `rust build-data exited with ${result.status}`);
  const packagedExamplePath = path.join(
    fixtureRoot,
    'data',
    'examples',
    'public',
    'examples',
    'ts',
    'line-simple.ts'
  );
  assert.ok(fs.existsSync(packagedExamplePath));
  assert.match(fs.readFileSync(packagedExamplePath, 'utf8'), /type:\s*'line'/);

  const metadata = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), 'utf8'));
  assert.equal(metadata.examples[0].content, undefined);
  assert.equal(metadata.examples[0].contentPath, 'examples/public/examples/ts/line-simple.ts');
});

test('rust runtime rejects external example checkout fallback when packaged content is missing', () => {
  const { fixtureRoot, examplesRoot } = createSplitMetadataFixture();

  const result = runRustCli(['example', 'line', 'line-simple.ts', '--format', 'json'], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_EXAMPLES_ROOT: examplesRoot,
      ECHARTS_CLI_NODE: '/definitely/missing/node'
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Example content unavailable/i);
});

test('rust CLI ignores ECHARTS_CLI_REPO_ROOT and still requires packaged metadata', () => {
  const fixtureRoot = createPackagedMetadataFixture();
  const result = runRustCli(['list', '--format', 'json'], {
    cwd: fixtureRoot,
    env: {
      ECHARTS_CLI_REPO_ROOT: path.join(fixtureRoot, 'echarts')
    }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Packaged metadata\.json is required/i);
});
