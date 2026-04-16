/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { terminalShowcaseIds } from '../node/terminal-showcase-data.mjs';

export const DEFAULT_COLUMNS = 72;
export const DEFAULT_ROWS = 22;

function parseCli(argv) {
    let mode = 'update';
    let index = 0;
    if (argv[0] && !argv[0].startsWith('--')) {
        mode = argv[0];
        index = 1;
    }

    const options = {};
    for (let i = index; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }
        options[token.slice(2)] = argv[i + 1];
        i++;
    }

    return { mode, options };
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function appleString(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export async function runExecFile(pkgDir, command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            cwd: pkgDir,
            maxBuffer: 1024 * 1024 * 8,
            ...options
        }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

export async function runAppleScript(pkgDir, lines) {
    const args = lines.flatMap(line => ['-e', line]);
    const { stdout } = await runExecFile(pkgDir, 'osascript', args);
    return stdout.trim();
}

export async function waitForFile(filePath, timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await fs.stat(filePath);
            return;
        }
        catch {
            await delay(120);
        }
    }
    throw new Error(`Timed out waiting for ${filePath}`);
}

export async function ensureCleanDir(dir) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
}

export async function removeStalePngs(dir, currentIds) {
    await fs.mkdir(dir, { recursive: true });
    const existing = await fs.readdir(dir);
    await Promise.all(existing
        .filter(name => name.endsWith('.png') && !currentIds.has(path.basename(name, '.png')))
        .map(name => fs.rm(path.join(dir, name), { force: true })));
}

export async function ensureScreenCaptureAvailable(pkgDir, permissionHint) {
    try {
        await runExecFile(pkgDir, 'which', ['screencapture']);
    }
    catch {
        throw new Error(
            `screencapture is unavailable. Grant Screen Recording permission to ${permissionHint}, then rerun the capture script.`
        );
    }
}

export async function writeCommandScript({
    pkgDir,
    filePath,
    id,
    readyPath,
    releasePath,
    columns = DEFAULT_COLUMNS,
    rows = DEFAULT_ROWS
}) {
    const content = `#!/bin/zsh
set -euo pipefail
cd ${JSON.stringify(pkgDir)}
stty cols ${columns} rows ${rows} || true
${JSON.stringify(process.execPath)} test/node/terminal-render-snapshot.mjs --id ${JSON.stringify(id)} --ready ${JSON.stringify(readyPath)} --release ${JSON.stringify(releasePath)} --width ${columns} --height ${rows}
`;
    await fs.writeFile(filePath, content, { mode: 0o700 });
}

async function runScreenCaptureViaTerminal(pkgDir, args) {
    const outputPath = args[args.length - 1];
    const shellCommand = ['screencapture', ...args].map(shellQuote).join(' ');
    const hadTerminalBefore = await runExecFile(pkgDir, 'pgrep', ['-x', 'Terminal'])
        .then(({ stdout }) => stdout.trim().length > 0)
        .catch(() => false);
    const proxyWindowId = await runAppleScript(pkgDir, [
        'tell application "Terminal"',
        `do script ${appleString(shellCommand)}`,
        'delay 0.2',
        'return id of front window as text',
        'end tell'
    ]);
    try {
        await waitForFile(outputPath);
    }
    finally {
        if (proxyWindowId) {
            await runAppleScript(pkgDir, [
                'tell application "Terminal"',
                'try',
                `close (first window whose id is ${proxyWindowId}) saving no`,
                'end try',
                'end tell'
            ]).catch(() => {});
        }
        if (!hadTerminalBefore) {
            await runAppleScript(pkgDir, [
                'tell application "Terminal"',
                'quit',
                'end tell'
            ]).catch(() => {});
            await delay(500);
            await runExecFile(pkgDir, 'pkill', ['-x', 'Terminal']).catch(() => {});
            await delay(500);
            await runExecFile(pkgDir, 'pkill', ['-KILL', '-x', 'Terminal']).catch(() => {});
        }
    }
}

export async function runScreenCapture(pkgDir, args) {
    try {
        await runExecFile(pkgDir, 'screencapture', args);
    }
    catch {
        await runScreenCaptureViaTerminal(pkgDir, args);
    }
}

export async function captureWindowRect(pkgDir, rect, outputPath) {
    const region = `${rect.left},${rect.top},${rect.width},${rect.height}`;
    await runScreenCapture(pkgDir, ['-x', '-R', region, outputPath]);
}

function renderReport(title, results) {
    const cards = results.map(result => `
        <section class="card">
            <h2>${result.id}</h2>
            <p>${result.width}x${result.height}</p>
            <img src="./actual/${result.id}.png" alt="${result.id}" />
        </section>
    `).join('');
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { margin: 24px; font-family: ui-sans-serif, system-ui; background: #101828; color: #e5e7eb; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 12px; }
    img { width: 100%; border-radius: 8px; border: 1px solid #475569; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

async function captureId(adapter, context, id) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `echarts-terminal-${adapter.id}-`));
    const readyPath = path.join(tmpDir, `${id}.ready.json`);
    const releasePath = path.join(tmpDir, `${id}.release`);
    const commandPath = path.join(tmpDir, `${id}.zsh`);
    const actualPath = path.join(context.actualDir, `${id}.png`);
    let handle = null;

    try {
        await writeCommandScript({
            pkgDir: context.pkgDir,
            filePath: commandPath,
            id,
            readyPath,
            releasePath,
            columns: context.columns,
            rows: context.rows
        });
        handle = await adapter.openWindow({ id, commandPath, readyPath, releasePath, context });
        if (adapter.prepareWindow) {
            await adapter.prepareWindow({ handle, id, commandPath, readyPath, releasePath, context });
        }
        await waitForFile(readyPath);
        await delay(adapter.postReadyDelay ?? 250);
        if (adapter.focusWindow) {
            await adapter.focusWindow({ handle, id, context });
        }
        await delay(adapter.preCaptureDelay ?? 250);
        const size = await adapter.captureWindow({ handle, id, outputPath: actualPath, context });
        await fs.writeFile(releasePath, '');
        await delay(adapter.postReleaseDelay ?? 250);
        return { id, filePath: actualPath, width: size.width, height: size.height };
    }
    finally {
        if (handle != null) {
            await adapter.closeWindow?.({ handle, id, context }).catch(() => {});
        }
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
}

export async function runRealTerminalCapture(adapter, argv = process.argv.slice(2)) {
    const { mode, options } = parseCli(argv);
    const onlyId = options.id ?? null;
    const visualDir = path.dirname(fileURLToPath(import.meta.url));
    const pkgDir = path.resolve(visualDir, '..', '..');
    const outputDir = path.join(visualDir, adapter.outputDir);
    const readmeDir = adapter.readmeDir ? path.join(pkgDir, 'docs', adapter.readmeDir) : null;
    const artifactsDir = path.join(visualDir, 'artifacts', adapter.artifactsDir);
    const actualDir = path.join(artifactsDir, 'actual');
    const reportPath = path.join(artifactsDir, 'report.html');
    const columns = adapter.columns ?? DEFAULT_COLUMNS;
    const rows = adapter.rows ?? DEFAULT_ROWS;

    if (process.platform !== 'darwin') {
        throw new Error(`${adapter.appName} capture is only supported on macOS.`);
    }
    if (mode !== 'update') {
        throw new Error(`Unsupported mode: ${mode}`);
    }
    if (onlyId && !terminalShowcaseIds.includes(onlyId)) {
        throw new Error(`Unknown showcase id "${onlyId}". Expected one of: ${terminalShowcaseIds.join(', ')}`);
    }

    await ensureCleanDir(artifactsDir);
    await fs.mkdir(actualDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    if (readmeDir) {
        await fs.mkdir(readmeDir, { recursive: true });
    }
    await ensureScreenCaptureAvailable(pkgDir, adapter.permissionHint);

    const targetIds = onlyId ? [onlyId] : terminalShowcaseIds;
    const targetIdSet = new Set(targetIds);
    await removeStalePngs(outputDir, targetIdSet);
    if (readmeDir) {
        const readmeTargetNames = new Set(targetIds.map(id => {
            const mapped = adapter.readmeNameForId ? adapter.readmeNameForId(id) : `${id}.png`;
            return path.basename(mapped, '.png');
        }));
        await removeStalePngs(readmeDir, readmeTargetNames);
    }

    const context = {
        pkgDir,
        visualDir,
        outputDir,
        readmeDir,
        artifactsDir,
        actualDir,
        reportPath,
        columns,
        rows,
        helpers: {
            delay,
            appleString,
            runExecFile: (command, args, options) => runExecFile(pkgDir, command, args, options),
            runAppleScript: lines => runAppleScript(pkgDir, lines),
            captureWindowRect: (rect, outputPath) => captureWindowRect(pkgDir, rect, outputPath),
            runScreenCapture: args => runScreenCapture(pkgDir, args)
        }
    };

    const runState = adapter.beforeAll ? await adapter.beforeAll(context) : null;
    const captures = [];
    try {
        for (const id of targetIds) {
            captures.push(await captureId(adapter, context, id));
        }

        await Promise.all(captures.map(async capture => {
            await fs.copyFile(capture.filePath, path.join(outputDir, `${capture.id}.png`));
            if (readmeDir) {
                const readmeName = adapter.readmeNameForId ? adapter.readmeNameForId(capture.id) : `${capture.id}.png`;
                await fs.copyFile(capture.filePath, path.join(readmeDir, readmeName));
            }
        }));

        await fs.writeFile(reportPath, renderReport(adapter.reportTitle, captures));

        console.log(`Captured ${captures.length} ${adapter.appName} snapshots.`);
        console.log(`Snapshot directory: ${outputDir}`);
        if (readmeDir) {
            console.log(`README directory: ${readmeDir}`);
        }
        console.log(`Report: ${reportPath}`);
    }
    finally {
        await adapter.afterAll?.({ context, runState, captures }).catch(() => {});
    }
}
