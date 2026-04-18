# JS vs Rust Benchmark

- Generated: 2026-04-17T13:36:51.286Z
- Git SHA: 02070f8
- Warmup runs: 1
- Measured runs: 1
- Note: preliminary benchmark snapshot; use together with parity/acceptance evidence, not as a standalone migration verdict.

| Case | JS median (ms) | Rust median (ms) | Speedup |
| --- | ---: | ---: | ---: |
| list-json | 8239.55 | 9913.00 | 0.83x |
| info-line-json | 10485.03 | 12220.19 | 0.86x |
| example-line-detail-json | 10200.38 | 10007.09 | 1.02x |
| option-axislabel-tree | 10233.95 | 9601.36 | 1.07x |
| option-line-xaxis-label-json | 9405.78 | 9205.77 | 1.02x |
| option-line-xaxis-grep | 9079.56 | 8970.27 | 1.01x |
