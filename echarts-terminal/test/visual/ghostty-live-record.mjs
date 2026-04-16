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

const visualDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(visualDir, '..', '..');
const artifactsDir = path.join(visualDir, 'artifacts', 'ghostty-live-recording-latest');
const outputPath = path.join(artifactsDir, 'showcase-live-ghostty.mp4');
const columns = 72;
const rows = 22;
const fps = Number(process.env.GHOSTTY_RECORD_FPS || 12);
const durationSeconds = Number(process.env.GHOSTTY_RECORD_SECONDS || 16);

function run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            cwd: pkgDir,
            maxBuffer: 1024 * 1024 * 32,
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureCleanDir(dir) {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
}

async function waitForFile(filePath, timeoutMs = 30000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            await fs.stat(filePath);
            return;
        }
        catch {
            await sleep(100);
        }
    }
    throw new Error(`Timed out waiting for ${filePath}`);
}

function parsePgrep(stdout) {
    return stdout
        .split(/\s+/)
        .map(value => Number(value.trim()))
        .filter(value => Number.isFinite(value) && value > 0);
}

async function listGhosttyPids() {
    try {
        const { stdout } = await run('pgrep', ['-x', 'ghostty']);
        return parsePgrep(stdout);
    }
    catch {
        return [];
    }
}

async function listGhosttyWindows() {
    const script = `import CoreGraphics
import Foundation
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
let rows = windows.compactMap { row -> [String: Any]? in
 guard (row[kCGWindowOwnerName as String] as? String) == "Ghostty" else { return nil }
 guard (row[kCGWindowLayer as String] as? Int) == 0 else { return nil }
 guard let bounds = row[kCGWindowBounds as String] as? [String: CGFloat] else { return nil }
 return [
   "windowNumber": row[kCGWindowNumber as String] as? Int ?? 0,
   "x": Int(bounds["X"] ?? 0),
   "y": Int(bounds["Y"] ?? 0),
   "width": Int(bounds["Width"] ?? 0),
   "height": Int(bounds["Height"] ?? 0)
 ]
}
let data = try JSONSerialization.data(withJSONObject: rows, options: [])
FileHandle.standardOutput.write(data)`;
    const { stdout } = await run('swift', ['-e', script]);
    return JSON.parse(stdout || '[]');
}

async function waitForNewGhosttyPid(beforePids) {
    const before = new Set(beforePids);
    for (let attempt = 0; attempt < 100; attempt++) {
        const current = await listGhosttyPids();
        const next = current.find(pid => !before.has(pid));
        if (next) {
            return next;
        }
        await sleep(100);
    }
    throw new Error('Timed out waiting for the launched Ghostty process.');
}

async function waitForNewGhosttyWindow(beforeWindowNumbers) {
    const before = new Set(beforeWindowNumbers);
    for (let attempt = 0; attempt < 100; attempt++) {
        const windows = (await listGhosttyWindows())
            .filter(window => !before.has(window.windowNumber))
            .sort((left, right) => right.windowNumber - left.windowNumber);
        if (windows[0]) {
            return windows[0];
        }
        await sleep(100);
    }
    throw new Error('Timed out waiting for the new Ghostty window.');
}

await ensureCleanDir(artifactsDir);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'echarts-terminal-ghostty-live-'));
const commandPath = path.join(tmpDir, 'live.zsh');
const beforePids = await listGhosttyPids();
const beforeWindowNumbers = (await listGhosttyWindows()).map(window => window.windowNumber);

await fs.writeFile(commandPath, `#!/bin/zsh
set -euo pipefail
cd ${JSON.stringify(pkgDir)}
stty cols ${columns} rows ${rows} || true
${JSON.stringify(process.execPath)} test/node/terminal-live.mjs
`, { mode: 0o700 });

await run('open', [
    '-na',
    'Ghostty.app',
    '--args',
    '--title=echarts-terminal live recording',
    '--font-family=Menlo',
    '--font-size=13',
    '--background=#000000',
    '--foreground=#e5e7eb',
    `--window-width=${columns}`,
    `--window-height=${rows}`,
    '--window-padding-x=0',
    '--window-padding-y=0',
    '--window-padding-balance=false',
    '--window-position-x=72',
    '--window-position-y=72',
    `--working-directory=${pkgDir}`,
    '--wait-after-command=true',
    `--initial-command=shell:${commandPath}`
]);

const pid = await waitForNewGhosttyPid(beforePids);
const window = await waitForNewGhosttyWindow(beforeWindowNumbers);
await sleep(700);

await run('swift', [
    path.join(pkgDir, 'test/visual/record-window.swift'),
    String(window.windowNumber),
    outputPath,
    String(fps),
    String(durationSeconds)
]);
await waitForFile(outputPath, 10000);

try {
    process.kill(pid, 'TERM');
}
catch {}
await sleep(500);
const stubborn = await listGhosttyPids();
for (const currentPid of stubborn) {
    if (beforePids.includes(currentPid)) {
        continue;
    }
    try {
        process.kill(currentPid, 'KILL');
    }
    catch {}
}
await fs.rm(tmpDir, { recursive: true, force: true });

console.log(`Ghostty live video: ${outputPath}`);
console.log(`Recorded area: ${window.width}x${window.height}@${window.x},${window.y}`);
console.log(`Duration (s): ${durationSeconds}`);
