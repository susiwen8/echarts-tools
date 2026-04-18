# Stage Report

This is a partial baseline because the full multi-case serial benchmark is dominated by process startup in this environment.

## What we observed

- A main-thread sample on `./target/release/echarts list --format json` spent most of its time in `_dyld_start`.
- A quick wall-clock probe shows the same pattern at process level:
  - `/bin/echo hi` finished in `2.74 ms`
  - `/usr/bin/python3 -c pass` finished in `48.27 ms`
  - `node -e process.exit(0)` finished in `6189.02 ms`
  - `./target/release/echarts list --format json` finished in `5703.96 ms`
  - `./target/release/echarts option xAxis.axisLabel --tree` finished in `6157.06 ms`

## Interpretation

- The Rust CLI wall-clock time is currently dominated by environment/process startup, not by command-specific logic.
- Comparing against `/bin/echo` alone is not fair, because it does not pay the same loader/runtime cost as `node` or the Rust binary.
- The fair comparison is same-runtime, same-host, same-build, with a no-op control in the same runtime or with inside-process instrumentation that separates loader time from handler time.

## Recommendation

1. Keep reporting total wall-clock time for user-facing CLI cost.
2. Add a startup-floor control and subtract it only when the control and the real command share the same runtime and launch path.
3. For logic-only profiling, instrument from `main`/subcommand entry or use a tracer that separates `_dyld_start` from application work.

## Status

- Full exhaustive baseline: not completed in this stage.
- Partial evidence: collected and written to `report.json`.
