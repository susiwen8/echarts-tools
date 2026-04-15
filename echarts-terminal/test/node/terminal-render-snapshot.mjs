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
import * as echarts from 'echarts/core.js';
import fs from 'fs/promises';
import { initTerminalChart, patchECharts } from '../../dist/index.js';
import { normalizeTerminalOption } from '../terminal-layout.mjs';
import {
    installTerminalShowcase,
    terminalShowcaseExamples,
    terminalShowcaseIds
} from './terminal-showcase-data.mjs';

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }
        args[token.slice(2)] = argv[i + 1];
        i++;
    }
    return args;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRelease(releasePath) {
    while (true) {
        try {
            await fs.stat(releasePath);
            return;
        }
        catch {
            await delay(100);
        }
    }
}

const args = parseArgs(process.argv.slice(2));
const id = args.id;
const readyPath = args.ready;
const releasePath = args.release;
const width = Number(args.width || 72);
const height = Number(args.height || 22);

if (!id || !readyPath || !releasePath) {
    throw new Error('terminal-render-snapshot requires --id, --ready, and --release.');
}

const option = terminalShowcaseExamples[id];
if (!option) {
    throw new Error(`Unknown showcase id "${id}". Expected one of: ${terminalShowcaseIds.join(', ')}`);
}

installTerminalShowcase(echarts);
const terminalEcharts = patchECharts(echarts);
const chart = initTerminalChart(terminalEcharts, null, { width, height });

let cursorRestored = false;
function restoreCursor() {
    if (!cursorRestored) {
        process.stdout.write('\u001b[?25h');
        cursorRestored = true;
    }
}

process.once('SIGINT', () => {
    restoreCursor();
    process.exit(130);
});
process.once('SIGTERM', () => {
    restoreCursor();
    process.exit(143);
});

try {
    chart.setOption(normalizeTerminalOption(option));
    const frame = chart.renderToTerminalString();
    process.stdout.write('\u001b[2J\u001b[H\u001b[?25l');
    process.stdout.write(frame);
    await fs.writeFile(readyPath, JSON.stringify({
        id,
        width,
        height,
        lineCount: frame.split('\n').length
    }));
    await waitForRelease(releasePath);
    await delay(80);
}
finally {
    restoreCursor();
    chart.dispose();
}
