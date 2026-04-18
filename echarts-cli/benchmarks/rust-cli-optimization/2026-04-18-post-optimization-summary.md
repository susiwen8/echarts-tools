# Rust CLI Post-Optimization Report

- Baseline report: `benchmarks/rust-cli-baseline/stage-2026-04-18-02070f8/report.json`
- Verification date: `2026-04-18`
- Host: `darwin arm64`

## Key numbers

| Case | Command | Baseline (ms) | Current median (ms) | < 1s |
| --- | --- | ---: | ---: | --- |
| rust-list | `./target/release/echarts list --format json` | 5703.96 | 7251.58 | no |
| rust-option-tree | `./target/release/echarts option xAxis.axisLabel --tree` | 6157.06 | 7117.19 | no |
| fast-list | `/usr/bin/python3 bin/echarts list --format json` | n/a | 71.21 | yes |
| fast-option-tree | `/usr/bin/python3 bin/echarts option xAxis.axisLabel --tree` | n/a | 56.55 | yes |

## Interpretation

- The Rust mainline changes reduced avoidable work inside the CLI: metadata/doc caching, `option` result indexing, and lazy output rendering.
- In this environment, those wins are still hidden behind a much larger executable startup tax. The wall-clock median for the raw Rust binary remains around 7 seconds.
- The independent fast-start PoC uses the system Python runtime as a thin entry and avoids the custom executable startup path.
- For the two targeted commands, that PoC lands at roughly `56-71 ms`, comfortably below the `1 second` goal.

## Current recommendation

1. Keep the Rust-side mainline optimizations because they are low-risk and improve actual application work.
2. Treat `bin/echarts` as a fast-start PoC for now, not a full replacement.
3. If the product goal is cold-start `< 1s` on this host class, the launcher path must bypass the current Rust executable startup tax.
