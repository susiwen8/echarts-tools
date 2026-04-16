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
import { appleString, runRealTerminalCapture } from './real-terminal-capture-core.mjs';

const initialWindowBounds = { left: 72, top: 72, right: 599, bottom: 437 };
const columnStep = 7;
const rowStep = 14;

function toBoundsLiteral(bounds) {
    return `{${bounds.left}, ${bounds.top}, ${bounds.right}, ${bounds.bottom}}`;
}

async function getWindowRect(windowId, context) {
    const output = await context.helpers.runAppleScript([
        'tell application "Terminal"',
        `set captureWindow to first window whose id is ${windowId}`,
        'set {leftEdge, topEdge, rightEdge, bottomEdge} to bounds of captureWindow',
        'return (leftEdge as text) & "," & (topEdge as text) & "," & ((rightEdge - leftEdge) as text) & "," & ((bottomEdge - topEdge) as text)',
        'end tell'
    ]);
    const [left, top, width, height] = output.split(',').map(value => Number(value.trim()));
    return { left, top, width, height };
}

async function listTerminalWindowIds(context) {
    const output = await context.helpers.runAppleScript([
        'tell application "Terminal"',
        'set idsText to ""',
        'repeat with w in windows',
        'set idsText to idsText & (id of w as text) & "\\n"',
        'end repeat',
        'return idsText',
        'end tell'
    ]);
    return output.split(/\s+/).map(value => Number(value.trim())).filter(Number.isFinite);
}

async function listTerminalPids(context) {
    try {
        const { stdout } = await context.helpers.runExecFile('pgrep', ['-x', 'Terminal']);
        return stdout.split(/\s+/).map(value => Number(value.trim())).filter(Number.isFinite);
    }
    catch {
        return [];
    }
}

async function setWindowBounds(windowId, bounds, context) {
    await context.helpers.runAppleScript([
        'tell application "Terminal"',
        `set bounds of (first window whose id is ${windowId}) to ${toBoundsLiteral(bounds)}`,
        'end tell'
    ]);
}

async function getSessionSize(windowId, context) {
    const output = await context.helpers.runAppleScript([
        'tell application "Terminal"',
        `set captureWindow to first window whose id is ${windowId}`,
        'set captureTab to selected tab of captureWindow',
        `return (number of columns of captureTab as text) & "," & (number of rows of captureTab as text)`,
        'end tell'
    ]);
    const [columns, rows] = output.split(',').map(value => Number(value.trim()));
    return { columns, rows };
}

async function settleWindowSize(windowId, context) {
    const bounds = { ...initialWindowBounds };
    await setWindowBounds(windowId, bounds, context);
    await context.helpers.delay(350);

    for (let attempt = 0; attempt < 6; attempt++) {
        const size = await getSessionSize(windowId, context);
        if (size.columns === context.columns && size.rows === context.rows) {
            return;
        }
        bounds.right += (context.columns - size.columns) * columnStep;
        bounds.bottom += (context.rows - size.rows) * rowStep;
        await setWindowBounds(windowId, bounds, context);
        await context.helpers.delay(350);
    }

    const finalSize = await getSessionSize(windowId, context);
    throw new Error(
        `Terminal.app session size did not converge to ${context.columns}x${context.rows}; got ${finalSize.columns}x${finalSize.rows}.`
    );
}

await runRealTerminalCapture({
    id: 'terminal-app',
    appName: 'Terminal.app',
    reportTitle: 'Terminal.app captures',
    outputDir: 'terminal-app',
    artifactsDir: 'terminal-app-latest',
    permissionHint: 'Terminal and your shell host',
    async beforeAll(context) {
        return {
            windowIds: new Set(await listTerminalWindowIds(context)),
            pids: new Set(await listTerminalPids(context))
        };
    },
    async openWindow({ id, commandPath, context }) {
        const windowIdText = await context.helpers.runAppleScript([
            'tell application "Terminal"',
            'activate',
            'set captureTab to do script ""',
            'delay 0.3',
            'set captureWindow to front window',
            'tell captureTab',
            'set title displays custom title to true',
            `set custom title to ${appleString(`echarts-terminal ${id}`)}`,
            'set title displays device name to false',
            'set title displays shell path to false',
            'set title displays window size to false',
            'set title displays file name to false',
            `set number of columns to ${context.columns}`,
            `set number of rows to ${context.rows}`,
            'try',
            'set font name to "Menlo-Regular"',
            'on error',
            'try',
            'set font name to "Menlo"',
            'end try',
            'end try',
            'set font size to 13',
            'set font antialiasing to true',
            'set background color to {0, 0, 0}',
            'set normal text color to {58853, 59367, 60395}',
            'set bold text color to {65535, 65535, 65535}',
            'set cursor color to {0, 0, 0}',
            'end tell',
            `do script quoted form of ${appleString(commandPath)} in captureTab`,
            'return id of captureWindow as text',
            'end tell'
        ]);
        return Number(windowIdText);
    },
    async prepareWindow({ handle, context }) {
        await settleWindowSize(handle, context);
    },
    async focusWindow({ handle, context }) {
        await context.helpers.runAppleScript([
            'tell application "Terminal"',
            'activate',
            `set captureWindow to first window whose id is ${handle}`,
            'set frontmost of captureWindow to true',
            'set index of captureWindow to 1',
            'end tell'
        ]);
    },
    async captureWindow({ handle, outputPath, context }) {
        const rect = await getWindowRect(handle, context);
        await context.helpers.captureWindowRect(rect, outputPath);
        return { width: rect.width, height: rect.height };
    },
    async closeWindow({ handle, context }) {
        await context.helpers.runAppleScript([
            'tell application "Terminal"',
            'try',
            `close (first window whose id is ${handle}) saving no`,
            'end try',
            'end tell'
        ]);
    },
    async afterAll({ context, runState }) {
        const currentIds = await listTerminalWindowIds(context);
        for (const id of currentIds) {
            if (runState?.windowIds?.has(id)) {
                continue;
            }
            await context.helpers.runAppleScript([
                'tell application "Terminal"',
                'try',
                `close (first window whose id is ${id}) saving no`,
                'end try',
                'end tell'
            ]).catch(() => {});
        }
        if ((runState?.pids?.size ?? 0) === 0) {
            await context.helpers.runAppleScript([
                'tell application "Terminal"',
                'quit',
                'end tell'
            ]).catch(() => {});
            await context.helpers.delay(500);
            await context.helpers.runExecFile('pkill', ['-x', 'Terminal']).catch(() => {});
            await context.helpers.delay(500);
            await context.helpers.runExecFile('pkill', ['-KILL', '-x', 'Terminal']).catch(() => {});
        }
    }
});
