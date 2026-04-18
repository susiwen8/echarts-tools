# development

## Current entrypoints

- Root repo package: development/orchestration only (`private: true`)
- Published runtime shape: direct Rust binary as package `bin`
- Local dev shortcut: `./target/debug/echarts`
- JS CLI retained only as test oracle: `bin/echarts.js`

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
npm run rust:dist:prepare
npm run rust:dist:verify
npm run cli:js -- --help
```

## Packaging

- `prepack` builds the packaged Rust runtime into `dist/rust/echarts`
- `npm pack --dry-run --ignore-scripts` verifies tarball shape
- `npm run rust:dist:verify` verifies tarball extract/run behavior
- `node scripts/prepare-platform-package.js <target>` stages a no-launcher platform npm package under `dist/npm/`
- `node scripts/prepare-platform-package.js all` stages every configured platform package whose Rust binary has already been built
- `node scripts/verify-platform-package.js <target>` verifies the staged platform package tarball and executes the binary when the package matches the current host OS/CPU
- `node scripts/verify-platform-package.js all` verifies every staged package tarball and runs host-native execution checks where possible

Current root-package scope is development-focused:
- used locally: scripts, JS oracle, tests, Rust source/build workflow
- not intended for npm publish

Current staged runtime package scope is runtime-focused:
- shipped: direct Rust binary, `data/**`, docs
- not shipped: JS oracle, tests, build-data binary, Rust sources, repo-only scripts

### Multi-platform npm preparation

The repository now supports staging platform-specific npm packages with direct Rust binaries as `bin`, without a launcher.

Current target config lives in:

- `scripts/platform-packages.json`

Each configured target maps npm `os`/`cpu` metadata to the Rust target triple used for the built release binary.

The intended publish shape is:

- root package stays private
- one published package per platform/arch
- package names include ABI where needed:
  - `echarts-cli-darwin-arm64`
  - `echarts-cli-darwin-x64`
  - `echarts-cli-linux-x64-musl`
  - `echarts-cli-linux-arm64-musl`
  - `echarts-cli-win32-x64-msvc`
  - `echarts-cli-win32-arm64-msvc`
- `package.json#bin.echarts` points directly to `bin/echarts` (or `bin/echarts.exe` on Windows)
- package contents contain only runtime assets (`bin`, `data`, docs)

### Release contract

Suggested release flow:

1. Build host runtime artifact:
   ```bash
   npm run rust:dist:prepare
   ```
2. Stage the target platform package:
   ```bash
   npm run npm:platform:prepare
   ```
   Or all configured targets:
   ```bash
   npm run npm:platform:prepare:all
   ```
3. Verify the staged package:
   ```bash
   npm run npm:platform:verify
   ```
4. Publish the staged platform package:
   ```bash
   npm run npm:platform:publish
   ```

Notes:
- The root package is `private` and is not the publish artifact.
- `npm:platform:publish` publishes the staged package directory under `dist/npm/<package-name>/`.
- Publishing all targets should only be done from CI runners that built and verified each target binary.

### CI release lane

Repository workflow:

- `.github/workflows/publish-echarts-cli-platform.yml`

Current CI matrix publishes/verifies:
- `linux-x64-musl`
- `win32-x64-msvc`
- `darwin-x64`

The workflow:
1. installs Node dependencies
2. installs Rust target toolchain
3. builds the target Rust binary
4. stages the platform package
5. verifies the platform package tarball
6. optionally publishes to npm when `publish=true`

Expected Rust build outputs:

- host release builds may come from `target/release/echarts`
- cross-target builds are read from `target/<rust-target>/release/echarts[.exe]`

Example release packaging flow:

```bash
node scripts/rust-tools.js cargo build --release --bin echarts --target aarch64-apple-darwin
node scripts/rust-tools.js cargo build --release --bin echarts --target x86_64-unknown-linux-gnu
npm run npm:platform:prepare -- darwin-arm64
npm run npm:platform:verify -- darwin-arm64
```

## Testing

- Full dev verification:
  ```bash
  npm test
  ```
- Rust parity harness:
  ```bash
  npm run test:parity:rust
  ```

## Benchmarks

CLI benchmark only:

```bash
node scripts/benchmark-rust-vs-js.js
```

Reports are written under `benchmarks/js-vs-rust/`.

## Current migration status

- Default development and packaging path is Rust-first.
- JS CLI is retained only for parity comparison and debugging.
- Rust build-data currently repackages from bundled metadata plus optional website/examples roots.
- `data/` artifacts in the repository are treated as the canonical packaged snapshot unless intentionally regenerated.
- Multi-platform npm staging now reads prebuilt Rust release binaries per configured target and emits no-launcher package directories under `dist/npm/`.
