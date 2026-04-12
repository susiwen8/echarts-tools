# ECharts CLI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a publishable first-pass `echarts-cli` package that exposes offline knowledge-query commands for ECharts users.

**Architecture:** Add a standalone CommonJS package under `../echarts-tools/echarts-cli` so the existing `echarts` library package and release flow remain stable. The CLI will read prebuilt JSON metadata derived from `src/export/*.ts`, `src/*/install.ts`, and `test/*.html`, while retaining a repo-local fallback extractor for development.

**Tech Stack:** Node.js, CommonJS, commander, jest, filesystem-based metadata extraction

---

## Chunk 1: Package Skeleton And Tests

### Task 1: Create publishable package scaffold

**Files:**
- Create: `../echarts-tools/echarts-cli/package.json`
- Create: `../echarts-tools/echarts-cli/README.md`
- Create: `../echarts-tools/echarts-cli/__tests__/cli.test.cjs`

- [ ] **Step 1: Write the failing CLI tests**
- [ ] **Step 2: Run `npx jest --runInBand ../echarts-tools/echarts-cli/__tests__/cli.test.cjs` and confirm failure because the CLI is not implemented yet**
- [ ] **Step 3: Add minimal package metadata for a standalone `echarts-cli` publishable package**

## Chunk 2: Data Extraction

### Task 2: Build offline metadata generation

**Files:**
- Create: `../echarts-tools/echarts-cli/scripts/build-data.js`
- Create: `../echarts-tools/echarts-cli/src/build-metadata.js`
- Create: `../echarts-tools/echarts-cli/src/shared.js`
- Create: `../echarts-tools/echarts-cli/data/.gitkeep` or generated data files

- [ ] **Step 1: Add a test expectation that `list` and `info` can resolve chart/component metadata**
- [ ] **Step 2: Implement metadata extraction for charts, components, features, renderers, top-level option keys, and related examples**
- [ ] **Step 3: Run the focused test file and confirm the metadata-backed assertions pass**

## Chunk 3: Command Surface

### Task 3: Implement CLI entry and command handlers

**Files:**
- Create: `../echarts-tools/echarts-cli/bin/echarts.js`
- Create: `../echarts-tools/echarts-cli/src/cli.js`
- Create: `../echarts-tools/echarts-cli/src/commands/list.js`
- Create: `../echarts-tools/echarts-cli/src/commands/info.js`
- Create: `../echarts-tools/echarts-cli/src/commands/example.js`
- Create: `../echarts-tools/echarts-cli/src/commands/option.js`
- Create: `../echarts-tools/echarts-cli/src/output.js`

- [ ] **Step 1: Implement `list` with `text/json/markdown` output**
- [ ] **Step 2: Implement `info <name>` with metadata, related items, and example links**
- [ ] **Step 3: Implement `example <query> [id]` for listing and printing embedded example source**
- [ ] **Step 4: Implement `option [name]` for top-level option keys and series/component option types**
- [ ] **Step 5: Run the focused test file and confirm all command assertions pass**

## Chunk 4: Integration And Verification

### Task 4: Make the package easy to run from its own package directory

**Files:**
- Modify: `../echarts-tools/echarts-cli/package.json`

- [ ] **Step 1: Add package-level scripts for invoking the CLI and rebuilding metadata**
- [ ] **Step 2: Run `node ../echarts-tools/echarts-cli/bin/echarts.js list` and at least one `info`, `example`, and `option` command**
- [ ] **Step 3: Re-run `npx jest --runInBand ../echarts-tools/echarts-cli/__tests__/cli.test.cjs` and report any remaining risk areas**
