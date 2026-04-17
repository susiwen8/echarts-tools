const path = require('path');
const fs = require('fs');
const os = require('os');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');

const binPath = path.resolve(__dirname, '..', 'bin', 'echarts.js');

function runCli(args) {
  return spawnSync(process.execPath, [binPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
}

function parseJson(result) {
  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('list returns charts and components in json format', () => {
  const result = runCli(['list', '--format', 'json']);
  const payload = parseJson(result);

  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.some(item => item.name === 'line' && item.kind === 'chart'));
  assert.ok(payload.items.some(item => item.name === 'tooltip' && item.kind === 'component'));
});

test('info resolves chart metadata and related examples', () => {
  const result = runCli(['info', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.name, 'line');
  assert.equal(payload.kind, 'chart');
  assert.equal(payload.optionType, 'LineSeriesOption');
  assert.equal(payload.topLevelKey, 'series[]');
  assert.ok(payload.examples.length > 0);
  assert.ok(payload.examples.every(example => example.relativePath.startsWith('public/examples/')));
});

test('example lists matching echarts-examples sources', () => {
  const result = runCli(['example', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.ok(Array.isArray(payload.examples));
  assert.ok(payload.examples.some(example => example.id === 'line-simple' && example.file === 'line-simple.ts'));
  assert.ok(payload.examples.every(example => example.relativePath === undefined));
  const lineSimple = payload.examples.find(example => example.id === 'line-simple');
  assert.equal(lineSimple.title, '基础折线图');
});

test('example can print echarts-examples source content', () => {
  const result = runCli(['example', 'line', 'line-simple.ts', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.id, 'line-simple');
  assert.equal(payload.file, 'line-simple.ts');
  assert.equal(payload.title, '基础折线图');
  assert.equal(payload.relativePath, undefined);
  assert.match(payload.content, /type:\s*'line'/);
});

test('example text list shows title before filename', () => {
  const result = runCli(['example', 'line']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /基础折线图\s+—\s+line-simple/);
  assert.doesNotMatch(result.stdout, /基础折线图\s+—\s+line-simple\.ts/);
});

test('example detail text shows title and id', () => {
  const result = runCli(['example', 'line', 'line-simple.ts']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /^基础折线图/m);
  assert.match(result.stdout, /^ID:\s+line-simple$/m);
});

test('option returns option metadata for a series', () => {
  const result = runCli(['option', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.name, 'line');
  assert.equal(payload.kind, 'chart');
  assert.equal(payload.optionType, 'LineSeriesOption');
  assert.equal(payload.topLevelKey, 'series[]');
  assert.equal(payload.optionPath, 'series[].type = "line"');
});

test('info includes linked built website option docs for charts', () => {
  const result = runCli(['info', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.docs.option.zh.relativePath, 'zh/documents/option-parts/option.series-line.json');
  assert.equal(payload.docs.option.en.relativePath, 'en/documents/option-parts/option.series-line.json');
  assert.equal(payload.docs.option.zh.title, 'option.series-line');
});

test('option includes linked built website docs for top-level option entries', () => {
  const result = runCli(['option', 'xAxis', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.name, 'xAxis');
  assert.equal(payload.docs.option.zh.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.equal(payload.docs.option.en.relativePath, 'en/documents/option-parts/option.xAxis.json');
});

test('option returns full built zh doc content and full example sources for a chart', () => {
  const result = runCli(['option', 'line', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.doc.lang, 'zh');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.series-line.json');
  assert.match(payload.doc.content, /# option\.series-line/);
  assert.equal(payload.exampleDetails, undefined);
});

test('option returns full built zh doc content for top-level options', () => {
  const result = runCli(['option', 'xAxis', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.match(payload.doc.content, /# option\.xAxis/);
  assert.equal(payload.exampleDetails, undefined);
});

test('option can query a nested top-level option property', () => {
  const result = runCli(['option', 'xAxis.type', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'xAxis.type');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.equal(payload.path, 'type');
  assert.equal(payload.entry.default, "'category'");
  assert.match(payload.entry.description, /坐标轴类型/);
});

test('option can list nested child properties for an object node', () => {
  const result = runCli(['option', 'xAxis.axisLabel', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'xAxis.axisLabel');
  assert.equal(payload.path, 'axisLabel');
  assert.ok(Array.isArray(payload.children));
  assert.ok(payload.children.some(child => child.name === 'rotate'));
  assert.ok(payload.children.some(child => child.name === 'formatter'));
  assert.match(
    payload.children.find(child => child.name === 'rotate').description,
    /旋转|角度/
  );
});

test('option available properties text output includes child descriptions', () => {
  const result = runCli(['option', 'xAxis.axisLabel']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /- rotate\b/);
  assert.match(result.stdout, /刻度标签旋转的角度|标签旋转/);
  assert.doesNotMatch(result.stdout, /formatter:\s*'\{value\}/);
  assert.match(
    result.stdout,
    /- formatter type=string\|Function\n  刻度标签的内容格式器，支持字符串模板和回调函数两种形式。/
  );
  assert.doesNotMatch(
    result.stdout,
    /- formatter type=string\|Function\n  .*示例[:：]/
  );
});

test('option full-desc shows fuller child descriptions', () => {
  const result = runCli(['option', 'xAxis.axisLabel', '--full-desc']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /- rotate\b/);
  assert.match(result.stdout, /旋转的角度从 -90 度到 90 度/);
});

test('option tree mode includes brief descriptions', () => {
  const result = runCli(['option', 'xAxis.axisLabel', '--tree']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /^  rotate\b/m);
  assert.match(result.stdout, /刻度标签旋转的角度|标签旋转/);
});

test('option can route chart context to related top-level options', () => {
  const result = runCli(['option', 'line.xAxis', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'line.xAxis');
  assert.equal(payload.contextItem, 'line');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.ok(payload.children.some(child => child.name === 'type'));
  assert.ok(payload.children.some(child => child.name === 'axisLabel'));
});

test('option can query nested properties inside a chart series doc', () => {
  const result = runCli(['option', 'line.smooth', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'line.smooth');
  assert.equal(payload.contextItem, 'line');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.series-line.json');
  assert.equal(payload.path, 'smooth');
  assert.match(payload.entry.description, /平滑曲线/);
});

test('option can fuzzy search with space-separated tokens', () => {
  const result = runCli(['option', 'line', 'xAxis', 'label', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'line xAxis label');
  assert.equal(payload.contextItem, 'line');
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.xAxis.json');
  assert.ok(Array.isArray(payload.results));
  assert.ok(payload.results.some(resultItem => resultItem.path === 'axisLabel'));
  assert.ok(payload.results.some(resultItem => resultItem.path === 'axisLabel.rotate'));
});

test('option broad fuzzy query returns related option docs with summaries', () => {
  const result = runCli(['option', 'line', 'axis', '--format', 'json']);
  const payload = parseJson(result);

  assert.equal(payload.query, 'line axis');
  assert.equal(payload.contextItem, 'line');
  assert.ok(Array.isArray(payload.relatedDocs));
  assert.ok(payload.relatedDocs.some(doc => doc.name === 'xAxis'));
  assert.ok(payload.relatedDocs.some(doc => doc.name === 'yAxis'));
  const xAxisDoc = payload.relatedDocs.find(doc => doc.name === 'xAxis');
  assert.ok(xAxisDoc.summary);
  assert.ok(xAxisDoc.optionType);
});

test('option supports grep mode for recursive flattened properties', () => {
  const result = runCli(['option', 'line.xAxis', '--grep']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /^axisLabel\b/m);
  assert.match(result.stdout, /^axisLabel\.rotate\t/m);
  assert.match(result.stdout, /^axisLine\.show/m);
});

test('option supports tree mode for recursive nested properties', () => {
  const result = runCli(['option', 'xAxis.axisLabel', '--tree']);

  assert.equal(result.status, 0, result.stderr || `CLI exited with ${result.status}`);
  assert.match(result.stdout, /^axisLabel\b/m);
  assert.match(result.stdout, /^  rotate\b/m);
  assert.match(result.stdout, /^  formatter\b/m);
});

test('info includes linked built website tutorials when available', () => {
  const result = runCli(['info', 'dataset', '--format', 'json']);
  const payload = parseJson(result);

  assert.ok(Array.isArray(payload.docs.tutorials));
  assert.ok(payload.docs.tutorials.some(doc => doc.zh && doc.zh.relativePath.startsWith('zh/documents/tutorial-parts/tutorial.json#')));
  assert.ok(payload.docs.tutorials.some(doc => doc.en && doc.en.relativePath.startsWith('en/documents/tutorial-parts/tutorial.json#')));
});

test('build-data falls back to bundled metadata when repo sources are unavailable', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echarts-cli-build-data-'));

  fs.cpSync(path.resolve(__dirname, '..', 'scripts'), path.join(fixtureRoot, 'scripts'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'data'), path.join(fixtureRoot, 'data'), { recursive: true });

  const result = spawnSync(process.execPath, [path.join('scripts', 'build-data.js')], {
    cwd: fixtureRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || `build-data exited with ${result.status}`);
  assert.match(result.stdout, /metadata/i);

  const metadata = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'data', 'metadata.json'), 'utf8'));
  assert.ok(Array.isArray(metadata.items));
  assert.ok(metadata.items.length > 0);
});

test('build-data stores example content outside metadata.json', () => {
  const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', 'metadata.json'), 'utf8'));
  assert.ok(Array.isArray(metadata.examples));
  assert.ok(metadata.examples.length > 0);
  const sample = metadata.examples.find(example => example.id === 'line-simple') || metadata.examples[0];
  assert.equal(sample.content, undefined);
  assert.ok(sample.contentPath);
  assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'data', sample.contentPath)));
});

test('build-data redacts packaged example secrets', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'data', 'examples', 'public', 'examples', 'ts', 'gl', 'bar3d-on-mapbox.js'),
    'utf8'
  );

  assert.doesNotMatch(source, /pk\.[A-Za-z0-9._-]{20,}/);
  assert.match(source, /<MAPBOX_ACCESS_TOKEN>/);
});

test('build-data stores packaged option docs without rendered content blobs', () => {
  const packagedDoc = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '..', 'data', 'docs', 'zh', 'documents', 'option-parts', 'option.xAxis.json'),
      'utf8'
    )
  );

  assert.equal(packagedDoc.content, undefined);
  assert.ok(packagedDoc.entries);
  assert.ok(packagedDoc.entries.type);
});

test('example uses packaged content files without external examples checkout', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echarts-cli-packaged-examples-'));

  fs.cpSync(path.resolve(__dirname, '..', 'bin'), path.join(fixtureRoot, 'bin'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'data'), path.join(fixtureRoot, 'data'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'node_modules'), path.join(fixtureRoot, 'node_modules'), { recursive: true });

  const result = spawnSync(process.execPath, [path.join('bin', 'echarts.js'), 'example', 'line', 'line-simple.ts', '--format', 'json'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });

  assert.equal(result.status, 0, result.stderr || `example exited with ${result.status}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.id, 'line-simple');
  assert.match(payload.content, /type:\s*'line'/);
});

test('option uses packaged docs subset without external echarts-website checkout', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echarts-cli-packaged-docs-'));

  fs.cpSync(path.resolve(__dirname, '..', 'bin'), path.join(fixtureRoot, 'bin'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'src'), path.join(fixtureRoot, 'src'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'data'), path.join(fixtureRoot, 'data'), { recursive: true });
  fs.cpSync(path.resolve(__dirname, '..', 'node_modules'), path.join(fixtureRoot, 'node_modules'), { recursive: true });

  const result = spawnSync(process.execPath, [path.join('bin', 'echarts.js'), 'option', 'line', '--format', 'json'], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });

  assert.equal(result.status, 0, result.stderr || `option exited with ${result.status}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.doc.relativePath, 'zh/documents/option-parts/option.series-line.json');
  assert.ok(payload.doc.content);
  assert.ok(payload.doc.entries);
});
