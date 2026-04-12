# Terminal Renderer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an experimental SSR-oriented `terminal` renderer so CLI users can print colorized ECharts charts in the terminal.

**Architecture:** Register a real `terminal` painter in zrender/ECharts and expose the core output API as `chart.renderToTerminalString()`. The painter rasterizes a narrow supported subset of zrender displayables into a half-block ANSI cell buffer using path conversion helpers rather than DOM or image dependencies.

**Tech Stack:** TypeScript, Jest, zrender PainterBase, zrender PathProxy conversion, ANSI escape sequences, Node.js streams

---

## Chunk 1: Core API Surface

### Task 1: Add the terminal renderer entry points

**Files:**
- Create: `src/renderer/installTerminalRenderer.ts`
- Modify: `src/export/renderers.ts`
- Modify: `src/util/types.ts`
- Modify: `src/core/echarts.ts`
- Test: `test/ut/spec/api/terminalRenderer.test.ts`

- [ ] **Step 1: Write a failing API test for registering and calling the terminal renderer**
- [ ] **Step 2: Run `npx jest --config test/ut/jest.config.cjs --runInBand test/ut/spec/api/terminalRenderer.test.ts` and confirm failure**
- [ ] **Step 3: Add `'terminal'` to renderer types and export `TerminalRenderer` from `echarts/renderers`**
- [ ] **Step 4: Add `renderToTerminalString()` beside the existing SVG/canvas render helpers**
- [ ] **Step 5: Re-run the focused Jest test and keep it red for the missing painter behavior**

## Chunk 2: Terminal Painter MVP

### Task 2: Build an SSR-only terminal painter

**Files:**
- Create: `src/renderer/terminal/TerminalPainter.ts`
- Create: `src/renderer/terminal/TerminalCellBuffer.ts`
- Create: `src/renderer/terminal/terminalColor.ts`
- Create: `src/renderer/terminal/terminalPath.ts`
- Test: `test/ut/spec/api/terminalRenderer.test.ts`

- [ ] **Step 1: Add a failing expectation that `renderToTerminalString()` returns ANSI-colored content for a simple bar chart**
- [ ] **Step 2: Implement a minimal cell buffer that compresses two logical rows into one terminal row with half-block glyphs**
- [ ] **Step 3: Support this exact MVP displayable matrix: `Path`, `Text`, and `TSpan`; exclude clip-heavy, image, and effect displayables**
- [ ] **Step 4: Add deterministic assertions for row count, ANSI escapes, glyph output, and the non-terminal renderer guard**
- [ ] **Step 5: Register the terminal painter and make the focused test pass**

## Chunk 3: Verification And Example

### Task 3: Prove the vertical slice works end to end

**Files:**
- Create: `test/node/terminal.mjs`
- Modify: `package.json`

- [ ] **Step 1: Decide the smoke path explicitly: built output, not source-only execution**
- [ ] **Step 2: Add a package-level build step that produces the artifact the smoke script imports**
- [ ] **Step 3: Add a package-level script for a terminal renderer smoke example**
- [ ] **Step 4: Run the focused Jest test file**
- [ ] **Step 5: Run the required build command before the smoke script**
- [ ] **Step 6: Run the node smoke script and inspect the terminal output**
- [ ] **Step 7: Run `npm run checktype` or the narrowest viable type verification for touched files**
- [ ] **Step 8: Record unsupported renderer behaviors as explicit remaining risks**
