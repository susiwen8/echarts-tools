#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { probeBinary } = require('./rust-tools');

function runNodeTest(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  });
  if (result.status !== 0) {
    process.exit(result.status == null ? 1 : result.status);
  }
}

runNodeTest([
  '--test',
  '__tests__/cli.test.js',
  '__tests__/rust-build-data.test.js',
  '__tests__/compat.test.js'
]);

if (probeBinary('cargo')) {
  runNodeTest(['--test', '__tests__/parity-harness.test.js'], {
    ECHARTS_CLI_RUN_RUST_PARITY: '1'
  });
} else {
  runNodeTest(['--test', '__tests__/parity-harness.test.js']);
}
