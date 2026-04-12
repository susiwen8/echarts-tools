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
import assert from 'assert/strict';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
    TERMINAL_LAYOUT_SCALE_X,
    TERMINAL_LAYOUT_SCALE_Y,
    initTerminalChart,
    patchECharts
} from '../../dist/index.js';

const distPath = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const distText = fs.readFileSync(distPath, 'utf8');

assert.ok(
    /from ['"]zrender\/lib\//.test(distText),
    'terminal plugin dist should externalize zrender imports instead of bundling its own copy'
);
assert.ok(
    !/\/\/ node_modules\/zrender\/lib\//.test(distText),
    'terminal plugin dist should not inline zrender source into the bundle'
);

let initOpts;
const painter = {
    type: 'terminal',
    renderToString() {
        return 'frame';
    }
};
const chart = {
    getZr() {
        return { painter };
    }
};

const echarts = {
    init(dom, theme, opts) {
        initOpts = opts;
        return chart;
    }
};

const terminalChart = initTerminalChart(echarts, null, { width: 60, height: 20 });

assert.equal(initOpts.renderer, 'terminal');
assert.equal(initOpts.ssr, true);
assert.equal(initOpts.width, 60 * TERMINAL_LAYOUT_SCALE_X);
assert.equal(initOpts.height, 20 * TERMINAL_LAYOUT_SCALE_Y);
assert.equal(initOpts.terminalWidth, 60);
assert.equal(initOpts.terminalHeight, 20);
assert.equal(terminalChart.renderToTerminalString(), 'frame');

let patchedInitOpts;
let patchedResizeOpts;
const patchedEcharts = {
    init(dom, theme, opts) {
        patchedInitOpts = opts;
        return {
            getZr() {
                return {
                    painter: {
                        type: 'terminal',
                        renderToString() {
                            return 'patched-frame';
                        }
                    }
                };
            },
            resize(opts) {
                patchedResizeOpts = opts;
            }
        };
    }
};

const terminalEcharts = patchECharts(patchedEcharts);
const patchedChart = terminalEcharts.init(null, null, {
    renderer: 'terminal',
    width: 40,
    height: 10
});

assert.equal(patchedInitOpts.width, 40 * TERMINAL_LAYOUT_SCALE_X);
assert.equal(patchedInitOpts.height, 10 * TERMINAL_LAYOUT_SCALE_Y);
assert.equal(patchedInitOpts.terminalWidth, 40);
assert.equal(patchedInitOpts.terminalHeight, 10);
assert.equal(patchedChart.renderToTerminalString(), 'patched-frame');

patchedChart.resize({
    width: 50,
    height: 12
});

assert.equal(patchedResizeOpts.width, 50 * TERMINAL_LAYOUT_SCALE_X);
assert.equal(patchedResizeOpts.height, 12 * TERMINAL_LAYOUT_SCALE_Y);
assert.equal(patchedResizeOpts.terminalWidth, 50);
assert.equal(patchedResizeOpts.terminalHeight, 12);

console.log(JSON.stringify({
    ok: true,
    scaledWidth: initOpts.width,
    scaledHeight: initOpts.height,
    terminalWidth: initOpts.terminalWidth,
    terminalHeight: initOpts.terminalHeight,
    patchedScaledWidth: patchedInitOpts.width,
    patchedScaledHeight: patchedInitOpts.height
}));
