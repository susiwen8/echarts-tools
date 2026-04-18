# development

## Current entrypoints

- Root repo package: development/orchestration only (`private: true`)
- Published runtime shape: direct Rust binary as package `bin`
- Local dev shortcut: `./target/debug/echarts`

## Data source policy

The active Rust/CLI path does **not** read the ECharts main source repository.

Authoritative runtime inputs are:
- `data/metadata.json`
- `data/docs/**`
- `data/examples/**`

Optional repackaging inputs are limited to:
- `ECHARTS_CLI_WEBSITE_ROOT`
- `ECHARTS_CLI_EXAMPLES_ROOT`

`ECHARTS_CLI_REPO_ROOT` is intentionally ignored by the Rust CLI/runtime path.

## Rust commands

```bash
npm run rust:build
npm run rust:build:release
npm run rust:build:data
```

## Packaging

- `prepack` builds the release Rust binaries and refreshes packaged data
- root package remains development-focused and private
- runtime artifacts are the Rust binaries plus `data/**`

## Testing

- Full dev verification:
  ```bash
  npm test
  ```

## Current migration status

- Default development and packaging path is Rust-first.
- Rust build-data currently repackages from bundled metadata plus optional website/examples roots.
- `data/` artifacts in the repository are treated as the canonical packaged snapshot unless intentionally regenerated.
