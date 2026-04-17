# wterm React Demo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-run React demo that renders `echarts-terminal` inside `wterm` with keyboard interaction, resize sync, and theme/size controls.

**Architecture:** Keep all `wterm` integration code inside a new `demo/wterm-react` app. Reuse `echarts-terminal`'s existing chart player and interaction pipeline through thin input/output adapters instead of adding a new renderer path.

**Tech Stack:** React, Vite, TypeScript, `@wterm/react`, local `echarts-terminal`, Apache ECharts.

---

## Chunk 1: Contract-first guardrails

### Task 1: Add demo contract coverage

**Files:**
- Create: `test/node/wterm-demo-contract.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing contract test**
- [ ] **Step 2: Add the contract test to `smoke:contract`**
- [ ] **Step 3: Run `npm run smoke:contract` and confirm it fails because demo scripts/files do not exist yet**

## Chunk 2: Demo app scaffold

### Task 2: Create the React/Vite demo shell

**Files:**
- Create: `demo/wterm-react/package.json`
- Create: `demo/wterm-react/tsconfig.json`
- Create: `demo/wterm-react/vite.config.ts`
- Create: `demo/wterm-react/index.html`
- Create: `demo/wterm-react/src/main.tsx`
- Create: `demo/wterm-react/src/App.tsx`
- Create: `demo/wterm-react/src/app.css`

- [ ] **Step 1: Scaffold the isolated app with local-package dependency on `file:../..`**
- [ ] **Step 2: Add root scripts for `demo:wterm:dev` and `demo:wterm:build`**
- [ ] **Step 3: Install demo dependencies and run an initial build to surface missing bridge code**

## Chunk 3: Bridge layer and chart lifecycle

### Task 3: Implement wterm input/output adapters

**Files:**
- Create: `demo/wterm-react/src/bridge/WTermInputAdapter.ts`
- Create: `demo/wterm-react/src/bridge/createWTermOutput.ts`
- Create: `demo/wterm-react/src/bridge/useEchartsTerminalWTerm.ts`
- Create: `demo/wterm-react/src/showcaseOptions.ts`

- [ ] **Step 1: Implement the browser `TerminalInput` adapter with `on/off/resume/pause/setRawMode` compatibility**
- [ ] **Step 2: Implement the `TerminalOutput` wrapper around `wterm.write`**
- [ ] **Step 3: Build the hook that creates/disposes the chart and player, syncs option changes, and handles resize**
- [ ] **Step 4: Add a focused interactive showcase option set**
- [ ] **Step 5: Run the contract test and demo build again**

## Chunk 4: UI wiring and docs

### Task 4: Finish the browser experience

**Files:**
- Modify: `demo/wterm-react/src/App.tsx`
- Modify: `README.md`
- Modify: `docs/development.md`

- [ ] **Step 1: Wire chart/theme/size controls, focus/reset actions, and inline instructions**
- [ ] **Step 2: Document how to launch the demo from the root repo**
- [ ] **Step 3: Run root verification plus demo `vite build`**
- [ ] **Step 4: Launch the dev server and manually verify browser rendering + keyboard interaction**
