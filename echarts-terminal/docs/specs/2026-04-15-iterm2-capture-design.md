# iTerm2 Real Capture Design

## Goal

Add a first-class real-window capture flow for `iTerm2` that mirrors the existing `Terminal.app` capture workflow.

The new flow should:

- expose `npm run visual:update:iterm2`
- export real iTerm2 window screenshots into `test/visual/iterm2/`
- sync README-facing copies into `docs/readme-iterm2/`
- write an HTML artifact report to `test/visual/artifacts/iterm2-latest/`

## Chosen Shape

Use a shared real-terminal capture engine plus app-specific adapters.

This keeps file-system orchestration, command-script generation, `screencapture` handling, and artifact syncing in one place while letting each terminal app keep its own AppleScript lifecycle.

## Architecture

### Shared engine

Create a shared module under `test/visual/` that owns:

- CLI argument parsing for `update` and optional `--id`
- common `osascript` / `screencapture` helpers
- temp command-script creation for `test/node/terminal-render-snapshot.mjs`
- artifact directory reset and PNG syncing
- HTML report generation

### Terminal.app adapter

Keep `test/visual/terminal-app-capture.mjs` as the user-facing entrypoint, but reduce it to a thin wrapper over the shared engine.

The Terminal adapter should preserve current behavior and output locations.

### iTerm2 adapter

Add `test/visual/iterm2-capture.mjs` as a second wrapper over the shared engine.

The iTerm2 adapter should:

- create a real iTerm2 window via AppleScript
- resize that window until the live session reports `72x22`
- set a black background / light foreground for consistent captures
- execute the same snapshot command script used by the Terminal.app flow

## Why Resize-by-Measurement

iTerm2 did not honor direct AppleScript writes to `columns` / `rows` during probing, but it did reliably report live `columns` / `rows` after changing window `bounds`.

Because of that, the adapter should converge on `72x22` by:

1. applying an initial calibrated bounds guess
2. reading the resulting live session size
3. nudging the window bounds until the session size matches the target

This avoids baking the capture logic into a single hard-coded local window size.

## Tests

Add a dedicated `test/node/iterm2-capture-contract.mjs` contract that checks:

- `package.json` exposes `visual:update:iterm2`
- the iTerm2 capture script references `iTerm2`
- the script uses `osascript` and `screencapture`
- the script syncs into `docs/readme-iterm2/`

Also update `smoke:contract` to run that new contract.

## Non-Goals

This change does not yet add cross-terminal diffing between Terminal.app and iTerm2.

That compare flow can be added on top of the shared engine once both real-capture lanes are stable.
