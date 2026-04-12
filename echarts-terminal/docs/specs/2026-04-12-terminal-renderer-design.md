# ECharts Terminal Renderer Design

## Goal

Add an experimental `terminal` renderer to ECharts so Node/CLI users can render colorized charts in a terminal without a browser DOM. The first version should be SSR-oriented and string-oriented, with full-frame output as the primary supported mode.

## Why This Shape

ECharts already has a strong non-DOM pipeline for `svg` SSR: option parsing, data transforms, visual mapping, coordinate layout, and zrender display-list generation all work without a browser. The missing piece is a new painter that can turn that display list into ANSI-colored terminal output.

Registering `terminal` as a real renderer keeps the user-facing model aligned with ECharts:

- `echarts.use([TerminalRenderer])`
- `echarts.init(null, null, { renderer: 'terminal', width, height })`
- `chart.renderToTerminalString()`

This keeps terminal rendering inside the existing renderer contract instead of creating a parallel one-off export API.

## Architecture

### 1. Renderer registration

- Add `src/renderer/installTerminalRenderer.ts`
- Export `TerminalRenderer` from `src/export/renderers.ts`
- Extend `RendererType` to include `'terminal'`

The install hook should stay as thin as the existing canvas/svg installers and only register a new zrender painter.

### 2. SSR-only terminal painter

Create `src/renderer/terminal/TerminalPainter.ts` as an SSR-only zrender painter:

- `type = 'terminal'`
- `ssrOnly = true`
- no DOM root required
- stores width/height from init options
- renders the current display list into an ANSI string

The painter should expose:

- `renderToString()`
- `getLastRenderResult()` for wrappers that want the already-rendered frame

### 3. Display-list to terminal conversion

The first version should avoid DOM or image dependencies. Instead it should consume zrender displayables directly.

Preferred strategy:

- iterate the display list from `storage.getDisplayList(true)`
- support only these displayable families in MVP:
  - `Path` and subclasses for fills/strokes
  - `TSpan`
  - `Text`
- treat clip-heavy, custom-symbol, effect, image, and toolbox-specific displayables as unsupported in MVP
- handle path-like displayables by reusing zrender `PathProxy`
- convert supported paths to polylines/polygons with `zrender/src/tool/convertPath`
- rasterize those shapes into a terminal cell buffer

This keeps the renderer native to zrender while still leaning on existing path conversion logic, but with a deliberately narrow support matrix.

### 4. Cell buffer model

Render into a virtual high-resolution buffer first, then compress to terminal cells:

- logical width = terminal columns
- logical height = terminal rows * 2
- each logical pixel stores fg/bg color and occupancy
- final flush uses half-block characters (`▀`, `▄`, `█`, or space)

This gives a good first-pass resolution boost without needing a full Braille engine.

Compositing rules for MVP:

- later display-list items overwrite earlier pixels
- no alpha blending beyond coarse opacity cutoffs
- no clip-path support
- text is painted after geometry as the top layer

### 5. Terminal output contract

The first version returns a plain ANSI string. It does not promise diff-based repaint loops, structured frame diffs, or terminal capability negotiation in the core renderer.

Any later wrapper can still add full-frame rewrite behavior, but incremental diff flushing is explicitly out of MVP.

## Supported First Version

### Explicitly targeted

- line
- bar
- scatter
- heatmap
- cartesian axis labels
- cartesian axes
- grid
- simple text displayables emitted as `Text` / `TSpan`

### Best-effort

- pie and sector-based charts if their displayables reduce cleanly through path conversion
- title and legend text when their emitted displayables fit the supported text subset

### Deferred

- toolbox
- save-as-image
- decal-heavy visuals
- DOM tooltip semantics
- complex animation
- map/geo-heavy scenes
- brush/dataZoom interaction

## API Shape

### Core ECharts instance

Add `renderToTerminalString()` beside `renderToSVGString()` and `renderToCanvas()`.

Rules:

- only valid when the active painter type is `terminal`
- throws in dev mode if called with a different renderer
- returns a full ANSI frame string

### Convenience wrapper package

Out of MVP. The initial slice focuses on the renderer and string output only.

## Testing Strategy

### Unit tests

Add focused Jest tests that:

- register the terminal renderer
- create an SSR chart with no DOM
- call `renderToTerminalString()`
- assert the output contains ANSI color sequences and non-empty glyphs
- assert the output row count matches the requested terminal height
- verify renderer guard rails for wrong renderer types

### Node smoke script

Follow-up after build integration is finalized. This should target either built `dist/lib` output or a dedicated source-runner, not an ambiguous mixed path.

### Scope guard

The first tests should use a small bar/line chart, because it exercises axes, labels, colored series fills/strokes, and terminal string output without the extra complexity of pie arcs or custom symbols.

## Risks

- Some series/components assume a canvas-vs-svg binary and may need follow-up fixes for `terminal`.
- Text measurement in terminals is approximate. MVP only promises stable ASCII-ish labels and best-effort mixed-width Unicode placement.
- Half-block rendering gives good density, but true pixel fidelity is intentionally not the goal.

## MVP Exit Criteria

The first slice is successful when all of the following are true:

- `TerminalRenderer` can be imported from `echarts/renderers`
- `echarts.init(null, null, { renderer: 'terminal', width, height })` works
- `chart.renderToTerminalString()` returns colored output for a small cartesian chart
- the returned string can be written directly to a terminal
- focused automated tests pass
