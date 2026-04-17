# wterm React Bridge Demo Design

## Goal

Add a browser-run React demo that embeds `echarts-terminal` inside `wterm`, preserving ANSI rendering and the existing keyboard interaction model.

## Why this shape

`echarts-terminal` already produces ANSI frames and already has a player/input abstraction. `wterm` already accepts host output via `write(...)` and emits user keystrokes via `onData(...)`. The lowest-risk bridge is therefore to adapt `wterm` to the existing player contracts instead of adding a new renderer path.

## Architecture

### Demo shell

Create an isolated demo app at `demo/wterm-react/` using Vite + React + `@wterm/react`. The demo depends on the local package via `file:../..` so it exercises the built library rather than a duplicated source copy.

### Bridge layer

Create three demo-local bridge pieces:

- `WTermInputAdapter.ts` — browser event adapter exposing the minimal `TerminalInput` API expected by `TerminalInteraction`
- `createWTermOutput.ts` — wraps `wterm`'s imperative `write(...)` as the `TerminalOutput` shape used by `createTerminalPlayer`
- `useEchartsTerminalWTerm.ts` — owns ECharts setup, chart lifecycle, player lifecycle, resize synchronization, and cleanup

### Demo UI

The React app provides:

- a `wterm` viewport
- chart selector (interactive-first showcase set)
- size preset / cols-rows controls
- theme selector for `wterm`
- rerender/reset/focus actions
- inline interaction instructions

## Data flow

1. React mounts `<Terminal>` from `@wterm/react`
2. `useTerminal()` exposes `ref`, `write`, `resize`, and `focus`
3. `onReady` marks the terminal as usable for host output
4. `onData` forwards user keystrokes into `WTermInputAdapter.emit(...)`
5. `useEchartsTerminalWTerm` creates a terminal chart and `createTerminalPlayer(...)`
6. Player output writes ANSI chunks into `wterm.write(...)`
7. `Enter`, arrow keys, and `Esc` flow through the adapter into existing `TerminalInteraction`
8. `cols/rows` changes resize both the DOM terminal and the chart renderer

## Scope decisions

### Included

- React demo subproject
- bridge layer local to the demo
- reuse of existing `createTerminalPlayer` interaction behavior
- root npm scripts and docs for running the demo
- verification by demo build plus browser interaction smoke check

### Explicitly deferred

- shipping a public `wterm` adapter in `src/`
- generic browser-terminal abstraction for multiple terminal emulators
- screenshot/regression automation for the demo app in this pass

## Testing strategy

### Automated

- add a contract test that locks in the demo scripts and key bridge/app files
- run root `build` and `smoke:contract`
- run demo `vite build`

### Manual

In the browser, verify:

- chart appears inside `wterm`
- chart switching rerenders in place
- `Enter` enters interaction mode
- arrow keys move focus / series
- `Esc` exits interaction mode
- size preset updates both terminal layout and chart frame
- theme changes only restyle terminal chrome, not break rendering
