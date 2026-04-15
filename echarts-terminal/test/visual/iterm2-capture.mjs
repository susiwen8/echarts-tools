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

const initialWindowBounds = { left: 72, top: 72, right: 592, bottom: 465 };
const columnStep = 7;
const rowStep = 17;

function toBoundsLiteral(bounds) {
    return `{${bounds.left}, ${bounds.top}, ${bounds.right}, ${bounds.bottom}}`;
}

async function setWindowBounds(windowId, bounds, context) {
    await context.helpers.runAppleScript([
        'tell application "iTerm2"',
        `set bounds of (first window whose id is ${windowId}) to ${toBoundsLiteral(bounds)}`,
        'end tell'
    ]);
}

async function getWindowRect(windowId, context) {
    const output = await context.helpers.runAppleScript([
        'tell application "iTerm2"',
        `set captureWindow to first window whose id is ${windowId}`,
        'set {leftEdge, topEdge, rightEdge, bottomEdge} to bounds of captureWindow',
        'return (leftEdge as text) & "," & (topEdge as text) & "," & ((rightEdge - leftEdge) as text) & "," & ((bottomEdge - topEdge) as text)',
        'end tell'
    ]);
    const [left, top, width, height] = output.split(',').map(value => Number(value.trim()));
    return { left, top, width, height };
}

async function getSessionSize(windowId, context) {
    const output = await context.helpers.runAppleScript([
        'tell application "iTerm2"',
        `set captureWindow to first window whose id is ${windowId}`,
        'tell current session of captureWindow',
        'return (columns as text) & "," & (rows as text)',
        'end tell',
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
        `iTerm2 session size did not converge to ${context.columns}x${context.rows}; got ${finalSize.columns}x${finalSize.rows}.`
    );
}

async function configureSession(windowId, context) {
    await context.helpers.runAppleScript([
        'tell application "iTerm2"',
        `set captureWindow to first window whose id is ${windowId}`,
        'tell current session of captureWindow',
        'set transparency to 0',
        'set background color to {0, 0, 0}',
        'set foreground color to {58853, 59367, 60395}',
        'set cursor color to {0, 0, 0}',
        'end tell',
        'select captureWindow',
        'activate',
        'end tell'
    ]);
}

await runRealTerminalCapture({
    id: 'iterm2',
    appName: 'iTerm2',
    reportTitle: 'iTerm2 captures',
    outputDir: 'iterm2',
    readmeDir: 'readme-iterm2',
    artifactsDir: 'iterm2-latest',
    permissionHint: 'iTerm2 and your shell host',
    async openWindow({ context }) {
        const windowIdText = await context.helpers.runAppleScript([
            'tell application "iTerm2"',
            'activate',
            'set captureWindow to create window with default profile',
            'delay 0.3',
            'return id of captureWindow as text',
            'end tell'
        ]);
        return Number(windowIdText);
    },
    async prepareWindow({ handle, commandPath, context }) {
        await settleWindowSize(handle, context);
        await configureSession(handle, context);
        await context.helpers.runAppleScript([
            'tell application "iTerm2"',
            `set captureWindow to first window whose id is ${handle}`,
            'tell current session of captureWindow',
            `write text quoted form of ${appleString(commandPath)}`,
            'end tell',
            'end tell'
        ]);
    },
    async focusWindow({ handle, context }) {
        await context.helpers.runAppleScript([
            'tell application "iTerm2"',
            `set captureWindow to first window whose id is ${handle}`,
            'select captureWindow',
            'activate',
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
            'tell application "iTerm2"',
            'try',
            `close (first window whose id is ${handle})`,
            'end try',
            'end tell'
        ]);
    }
});
