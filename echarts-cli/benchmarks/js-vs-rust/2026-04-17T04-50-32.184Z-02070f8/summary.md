# JS vs Rust CLI Benchmark

- Generated: 2026-04-17T04:50:32.185Z
- Git SHA: 02070f8
- Node: v22.17.0
- Warmup runs: 5
- Timed runs: 20

| Case | JS median (ms) | Rust median (ms) | Median speedup | JS p95 (ms) | Rust p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| `list --format json` | 283.26 | 235.44 | 1.20x | 452.69 | 378.50 |
| `info line --format json` | 242.47 | 120.02 | 2.02x | 387.27 | 257.68 |
| `example line --format json` | 183.66 | 64.25 | 2.86x | 329.18 | 117.66 |
| `example line line-simple.ts --format json` | 180.58 | 115.58 | 1.56x | 330.48 | 188.08 |
| `option xAxis.axisLabel --tree` | 222.43 | 62.41 | 3.56x | 327.59 | 124.33 |
| `option line.xAxis --grep` | 245.93 | 117.02 | 2.10x | 333.67 | 312.53 |
