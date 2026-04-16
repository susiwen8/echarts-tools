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
import { runRealTerminalCapture } from './real-terminal-capture-core.mjs';

const columns = 72;
const rows = 22;

const readmeNameById = {
    bar: 'bar.png',
    legend: 'legend.png',
    line: 'line.png',
    stackedLine: 'stacked.png',
    scatter: 'scatter.png',
    heatmap: 'heatmap.png',
    candlestick: 'candlestick.png',
    boxplot: 'boxplot.png',
    pictorialBar: 'pictorial-bar.png',
    pie: 'pie.png',
    radar: 'radar.png',
    gauge: 'gauge.png',
    funnel: 'funnel.png',
    sankey: 'sankey.png',
    tree: 'tree.png',
    treemap: 'treemap.png',
    sunburst: 'sunburst.png',
    graph: 'graph.png',
    parallel: 'parallel.png',
    themeRiver: 'theme-river.png'
};

function parsePgrep(stdout) {
    return stdout
        .split(/\s+/)
        .map(value => Number(value.trim()))
        .filter(value => Number.isFinite(value) && value > 0);
}

async function listGhosttyPids(context) {
    try {
        const { stdout } = await context.helpers.runExecFile('pgrep', ['-x', 'ghostty']);
        return parsePgrep(stdout);
    }
    catch {
        return [];
    }
}

async function listGhosttyWindows(context) {
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
    const { stdout } = await context.helpers.runExecFile('swift', ['-e', script]);
    return JSON.parse(stdout || '[]');
}

async function waitForNewGhosttyPid(beforePids, context) {
    const before = new Set(beforePids);
    for (let attempt = 0; attempt < 100; attempt++) {
        const current = await listGhosttyPids(context);
        const next = current.find(pid => !before.has(pid));
        if (next) {
            return next;
        }
        await context.helpers.delay(100);
    }
    throw new Error('Timed out waiting for the launched Ghostty process.');
}

async function waitForNewGhosttyWindow(beforeWindowNumbers, context) {
    const before = new Set(beforeWindowNumbers);
    for (let attempt = 0; attempt < 100; attempt++) {
        const windows = (await listGhosttyWindows(context))
            .filter(window => !before.has(window.windowNumber))
            .sort((left, right) => right.windowNumber - left.windowNumber);
        if (windows[0]) {
            return windows[0];
        }
        await context.helpers.delay(100);
    }
    throw new Error('Timed out waiting for the new Ghostty window.');
}

async function waitForGhosttyExit(pid, context) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const pids = await listGhosttyPids(context);
        if (!pids.includes(pid)) {
            return;
        }
        await context.helpers.delay(100);
    }
}

await runRealTerminalCapture({
    id: 'ghostty',
    appName: 'Ghostty',
    reportTitle: 'Ghostty captures',
    outputDir: 'ghostty',
    readmeDir: 'readme',
    readmeNameForId(id) {
        return readmeNameById[id] ?? `${id}.png`;
    },
    artifactsDir: 'ghostty-latest',
    permissionHint: 'Ghostty and your shell host',
    columns,
    rows,
    async beforeAll(context) {
        return {
            pids: new Set(await listGhosttyPids(context))
        };
    },
    async openWindow({ id, commandPath, context }) {
        const beforePids = await listGhosttyPids(context);
        const beforeWindowNumbers = (await listGhosttyWindows(context)).map(window => window.windowNumber);
        await context.helpers.runExecFile('open', [
            '-na',
            'Ghostty.app',
            '--args',
            `--title=echarts-terminal ${id}`,
            '--font-family=Menlo',
            '--font-size=13',
            '--background=#000000',
            '--foreground=#e5e7eb',
            `--window-width=${context.columns}`,
            `--window-height=${context.rows}`,
            '--window-padding-x=0',
            '--window-padding-y=0',
            '--window-padding-balance=false',
            '--window-position-x=72',
            '--window-position-y=72',
            `--working-directory=${context.pkgDir}`,
            '--wait-after-command=true',
            `--initial-command=shell:${commandPath}`
        ]);
        const pid = await waitForNewGhosttyPid(beforePids, context);
        const window = await waitForNewGhosttyWindow(beforeWindowNumbers, context);
        return { pid, windowNumber: window.windowNumber };
    },
    async captureWindow({ handle, outputPath, context }) {
        await context.helpers.runScreenCapture([
            '-x',
            '-o',
            '-l',
            String(handle.windowNumber),
            outputPath
        ]);
        const window = (await listGhosttyWindows(context)).find(item => item.windowNumber === handle.windowNumber);
        return { width: window?.width ?? 0, height: window?.height ?? 0 };
    },
    async closeWindow({ handle, context }) {
        try {
            process.kill(handle.pid, 'TERM');
        }
        catch {
            return;
        }
        await waitForGhosttyExit(handle.pid, context);
    },
    async afterAll({ context, runState }) {
        const currentPids = await listGhosttyPids(context);
        for (const pid of currentPids) {
            if (runState?.pids?.has(pid)) {
                continue;
            }
            try {
                process.kill(pid, 'TERM');
            }
            catch {
                continue;
            }
        }
        await context.helpers.delay(500);
        if ((runState?.pids?.size ?? 0) === 0) {
            await context.helpers.runAppleScript([
                'tell application "Ghostty"',
                'quit',
                'end tell'
            ]).catch(() => {});
            await context.helpers.delay(500);
            const remaining = await listGhosttyPids(context);
            for (const pid of remaining) {
                try {
                    process.kill(pid, 'TERM');
                }
                catch {}
            }
            await context.helpers.delay(500);
            const stubborn = await listGhosttyPids(context);
            for (const pid of stubborn) {
                try {
                    process.kill(pid, 'KILL');
                }
                catch {}
            }
        }
    }
});
