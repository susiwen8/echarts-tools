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
import { EventEmitter } from 'events';
import * as echarts from 'echarts/core.js';
import { BarChart, LineChart } from 'echarts/charts.js';
import { GridComponent, TitleComponent } from 'echarts/components.js';
import {
    TerminalRenderer,
    patchECharts,
    initTerminalChart,
    createTerminalPlayer
} from '../../dist/index.js';

class FakeInput extends EventEmitter {
    isTTY = true;
    rawMode = false;

    setRawMode(value) {
        this.rawMode = value;
    }

    resume() {}
    pause() {}

    send(chars) {
        this.emit('data', Buffer.from(chars));
    }
}

echarts.use([BarChart, LineChart, GridComponent, TitleComponent, TerminalRenderer]);
const terminalEcharts = patchECharts(echarts);

const outputChunks = [];
const input = new FakeInput();
const output = {
    write(chunk) {
        outputChunks.push(chunk);
    }
};

const chart = initTerminalChart(terminalEcharts, null, {
    width: 48,
    height: 12
});

const player = createTerminalPlayer(chart, {
    output,
    input
});

chart.setOption({
    title: { text: 'Interactive' },
    grid: { top: 4, bottom: 2, left: 2, right: 1 },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [
        { name: 'Alpha', type: 'bar', data: [1, 2, 3] },
        { name: 'Beta', type: 'line', data: [3, 2, 1] }
    ]
});

assert.equal(input.rawMode, true, 'interactive terminal player should enable raw mode on the input');

input.send('\r');
let lastChunk = outputChunks[outputChunks.length - 1];
let lastFrame = lastChunk.replace(/\u001b\[[0-9;]*m/g, '');
assert.ok(lastFrame.includes('INTERACTIVE Alpha A:1'), 'Enter should activate interaction mode on the first point');
assert.equal(lastFrame.includes('@'), false, 'bar interaction should not use a text marker overlay');
const barHighlightCount = (lastChunk.match(/\u001b\[38;2;255;255;255m/g) || []).length;

input.send('\u001b[C');
lastChunk = outputChunks[outputChunks.length - 1];
lastFrame = lastChunk.replace(/\u001b\[[0-9;]*m/g, '');
assert.ok(lastFrame.includes('INTERACTIVE Alpha B:2'), 'Right arrow should move to the next data point');

input.send('\u001b[B');
lastChunk = outputChunks[outputChunks.length - 1];
lastFrame = lastChunk.replace(/\u001b\[[0-9;]*m/g, '');
assert.ok(lastFrame.includes('INTERACTIVE Beta B:2'), 'Down arrow should switch to the next series on the same category');
assert.equal(lastFrame.includes('@'), false, 'line interaction should change point color instead of drawing a text marker');
const lineHighlightCount = (lastChunk.match(/\u001b\[38;2;255;255;255m/g) || []).length;
assert.ok(
    barHighlightCount > lineHighlightCount,
    'bar interaction should recolor a larger region than line interaction'
);

input.send('\u001b');
lastFrame = outputChunks[outputChunks.length - 1].replace(/\u001b\[[0-9;]*m/g, '');
assert.equal(lastFrame.includes('INTERACTIVE'), false, 'Esc should exit interaction mode');

player.stop();
assert.equal(input.rawMode, false, 'stop should restore the previous raw mode');
chart.dispose();

console.log(JSON.stringify({
    ok: true,
    writes: outputChunks.length
}));
