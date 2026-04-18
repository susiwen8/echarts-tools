# echarts-cli

Offline knowledge CLI for Apache ECharts users.

## Usage

Build the Rust CLI:

```bash
npm run rust:build
```

Run commands locally:

```bash
./target/debug/echarts list
./target/debug/echarts info line --format json
./target/debug/echarts example line line-simple.ts --format json
./target/debug/echarts option xAxis.type --format json
```

Prepare the packaged Rust binary:

```bash
npm run rust:dist:prepare
```

JS oracle for parity/debugging only:

```bash
npm run cli:js -- list
```

See `development.md` for implementation notes, packaging details, testing, and migration status.
