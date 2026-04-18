const test = require('node:test');

const {
  assertCliParity,
  createPackagedFixture,
  runJsCli,
  runRustCli
} = require('./helpers/parity');

const rustParityEnabled = process.env.ECHARTS_CLI_RUN_RUST_PARITY === '1';
const rustTest = rustParityEnabled ? test : test.skip;

const rustParityCases = [
  { name: 'bare echarts', args: [] },
  { name: 'unknown command', args: ['nope'] },
  { name: 'top-level help', args: ['--help'] },
  { name: 'list help', args: ['list', '--help'] },
  { name: 'info help', args: ['info', '--help'] },
  { name: 'example help', args: ['example', '--help'] },
  { name: 'option help', args: ['option', '--help'] },
  { name: 'top-level unknown option', args: ['--bogus'] },
  { name: 'list unknown option', args: ['list', '--bogus'] },
  { name: 'option unknown option', args: ['option', '--bogus'] },
  { name: 'info missing required arg', args: ['info'] },
  { name: 'example missing required arg', args: ['example'] },
  { name: 'info missing option value before help', args: ['info', '--format', '--help'] }
];

const rustJsonParityCases = [
  { name: 'list json', args: ['list', '--format', 'json'] },
  { name: 'info line json', args: ['info', 'line', '--format', 'json'] },
  { name: 'info dataset json', args: ['info', 'dataset', '--format', 'json'] },
  { name: 'example line list json', args: ['example', 'line', '--format', 'json'] },
  { name: 'example line detail json', args: ['example', 'line', 'line-simple.ts', '--format', 'json'] },
  { name: 'option line json', args: ['option', 'line', '--format', 'json'] },
  { name: 'option xAxis json', args: ['option', 'xAxis', '--format', 'json'] },
  { name: 'option xAxis.type json', args: ['option', 'xAxis.type', '--format', 'json'] },
  { name: 'option xAxis.axisLabel json', args: ['option', 'xAxis.axisLabel', '--format', 'json'] },
  { name: 'option line xAxis label json', args: ['option', 'line', 'xAxis', 'label', '--format', 'json'] },
  { name: 'option line axis json', args: ['option', 'line', 'axis', '--format', 'json'] }
];

const rustExactRuntimeCases = [
  { name: 'list markdown', args: ['list', '--format', 'markdown'] },
  { name: 'info line markdown', args: ['info', 'line', '--format', 'markdown'] },
  { name: 'example line markdown', args: ['example', 'line', '--format', 'markdown'] },
  { name: 'example line text', args: ['example', 'line'] },
  { name: 'example line detail text', args: ['example', 'line', 'line-simple.ts'] },
  { name: 'option xAxis.type markdown', args: ['option', 'xAxis.type', '--format', 'markdown'] },
  { name: 'option axisLabel full-desc text', args: ['option', 'xAxis.axisLabel', '--full-desc'] },
  { name: 'option axis rotate search text', args: ['option', 'xAxis', 'axis', 'rotate'] },
  { name: 'option axisLabel detail text', args: ['option', 'xAxis.axisLabel'] },
  { name: 'option axisLabel tree text', args: ['option', 'xAxis.axisLabel', '--tree'] },
  { name: 'option line.xAxis grep text', args: ['option', 'line.xAxis', '--grep'] }
];

for (const parityCase of rustParityCases) {
  rustTest(`rust skeleton matches JS oracle for ${parityCase.name}`, () => {
    assertCliParity({
      args: parityCase.args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      label: parityCase.name
    });
  });
}

for (const parityCase of rustJsonParityCases) {
  rustTest(`rust runtime matches JS oracle for ${parityCase.name}`, () => {
    assertCliParity({
      args: parityCase.args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      label: parityCase.name,
      mode: 'json'
    });
  });
}

for (const parityCase of rustExactRuntimeCases) {
  rustTest(`rust runtime matches JS oracle for ${parityCase.name}`, () => {
    assertCliParity({
      args: parityCase.args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      label: parityCase.name
    });
  });
}

test('parity harness can lock fallback quirks before the Rust runtime exists', () => {
  assertCliParity({
    args: ['list', '--kind', 'bogus', '--format', 'json'],
    oracleRunner: runJsCli,
    candidateRunner: runJsCli,
    label: 'list --kind bogus json self-parity',
    mode: 'json'
  });

  assertCliParity({
    args: ['info', 'line', '--format', 'bogus'],
    oracleRunner: runJsCli,
    candidateRunner: runJsCli,
    label: 'info --format bogus text fallback self-parity'
  });

  assertCliParity({
    args: ['option', 'xAxis.type', '--lang', 'bogus', '--format', 'json'],
    oracleRunner: runJsCli,
    candidateRunner: runJsCli,
    label: 'option --lang bogus json self-parity',
    mode: 'json'
  });
});

test('parity harness supports markdown output comparisons before the Rust runtime exists', () => {
  for (const args of [
    ['list', '--format', 'markdown'],
    ['info', 'line', '--format', 'markdown'],
    ['example', 'line', '--format', 'markdown'],
    ['option', 'xAxis.type', '--format', 'markdown']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runJsCli,
      label: `${args.join(' ')} markdown self-parity`
    });
  }
});

test('parity harness supports packaged-only fixture runs', () => {
  const fixtureRoot = createPackagedFixture();

  for (const args of [
    ['list', '--format', 'json'],
    ['info', 'line', '--format', 'json'],
    ['example', 'line', 'line-simple.ts', '--format', 'json'],
    ['option', 'line', '--format', 'json']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runJsCli,
      oracleOptions: { cwd: fixtureRoot },
      candidateOptions: { cwd: fixtureRoot },
      label: `packaged self-parity ${args.join(' ')}`,
      mode: 'json'
    });
  }
});

test('parity harness supports future packaged-first env precedence cases', () => {
  const fixtureRoot = createPackagedFixture();
  const env = {
    ECHARTS_CLI_REPO_ROOT: '/definitely/missing/echarts-cli-fixture-root',
    ECHARTS_CLI_WEBSITE_ROOT: '/definitely/missing/echarts-cli-fixture-root',
    ECHARTS_CLI_EXAMPLES_ROOT: '/definitely/missing/echarts-cli-fixture-root'
  };

  for (const args of [
    ['info', 'line', '--format', 'json'],
    ['example', 'line', 'line-simple.ts', '--format', 'json'],
    ['option', 'line', '--format', 'json']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runJsCli,
      oracleOptions: { cwd: fixtureRoot, env },
      candidateOptions: { cwd: fixtureRoot, env },
      label: `env precedence self-parity ${args.join(' ')}`,
      mode: 'json'
    });
  }
});

rustTest('rust runtime supports packaged-only fixture parity', () => {
  const fixtureRoot = createPackagedFixture();

  for (const args of [
    ['list', '--format', 'json'],
    ['info', 'line', '--format', 'json'],
    ['info', 'dataset', '--format', 'json'],
    ['example', 'line', 'line-simple.ts', '--format', 'json'],
    ['option', 'line', '--format', 'json'],
    ['option', 'xAxis', '--format', 'json'],
    ['option', 'xAxis.type', '--format', 'json']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      oracleOptions: { cwd: fixtureRoot },
      candidateOptions: { cwd: fixtureRoot },
      label: `rust packaged parity ${args.join(' ')}`,
      mode: 'json'
    });
  }
});

rustTest('rust runtime supports packaged-only exact text parity for docs', () => {
  const fixtureRoot = createPackagedFixture();

  for (const args of [
    ['option', 'xAxis.type'],
    ['option', 'xAxis.type', '--format', 'markdown'],
    ['example', 'line', 'line-simple.ts']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      oracleOptions: { cwd: fixtureRoot },
      candidateOptions: { cwd: fixtureRoot },
      label: `rust packaged text parity ${args.join(' ')}`
    });
  }
});

rustTest('rust runtime preserves packaged-first env precedence parity', () => {
  const fixtureRoot = createPackagedFixture();
  const env = {
    ECHARTS_CLI_REPO_ROOT: '/definitely/missing/echarts-cli-fixture-root',
    ECHARTS_CLI_WEBSITE_ROOT: '/definitely/missing/echarts-cli-fixture-root',
    ECHARTS_CLI_EXAMPLES_ROOT: '/definitely/missing/echarts-cli-fixture-root'
  };

  for (const args of [
    ['list', '--format', 'json'],
    ['info', 'line', '--format', 'json'],
    ['example', 'line', 'line-simple.ts', '--format', 'json'],
    ['option', 'line', '--format', 'json'],
    ['option', 'xAxis.type', '--format', 'json']
  ]) {
    assertCliParity({
      args,
      oracleRunner: runJsCli,
      candidateRunner: runRustCli,
      oracleOptions: { cwd: fixtureRoot, env },
      candidateOptions: { cwd: fixtureRoot, env },
      label: `rust env precedence parity ${args.join(' ')}`,
      mode: 'json'
    });
  }
});
