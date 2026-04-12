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
import * as echarts from 'echarts/core.js';
import { BarChart } from 'echarts/charts.js';
import { GridComponent, TitleComponent } from 'echarts/components.js';
import {
    TerminalRenderer,
    patchECharts,
    initTerminalChart,
    createTerminalPlayer
} from '../../dist/index.js';

const terminalEcharts = patchECharts(echarts);
terminalEcharts.use([BarChart, GridComponent, TitleComponent, TerminalRenderer]);

const outputChunks = [];
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
    output
});

chart.setOption({
    title: { text: 'Live 1' },
    grid: { top: 4, bottom: 2, left: 2, right: 1 },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [1, 2, 3] }]
});

assert.equal(outputChunks.length, 1, 'first setOption should render the first frame automatically');
assert.ok(outputChunks[0].includes('\u001b[?25l'), 'first frame should hide the cursor');
assert.ok(outputChunks[0].includes('Live 1'), 'first frame should contain the initial title');

chart.setOption({
    title: { text: 'Live 2' },
    grid: { top: 4, bottom: 2, left: 2, right: 1 },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [3, 2, 1] }]
});

assert.equal(outputChunks.length, 2, 'second setOption should repaint in place');
assert.match(outputChunks[1], /\u001b\[[0-9]+A\r\u001b\[0J/, 'second frame should rewind and clear the previous frame');
assert.ok(outputChunks[1].includes('Live 2'), 'second frame should contain the updated title');

const manualFrame = player.render();
assert.equal(outputChunks.length, 3, 'manual render should still be available');
assert.equal(manualFrame.split('\n').length, 12, 'manual render should preserve the terminal height');

player.stop();
assert.equal(outputChunks.length, 4, 'stop should write one final cleanup chunk');
assert.ok(outputChunks[3].includes('\u001b[?25h'), 'stop should restore the cursor');

chart.dispose();

console.log(JSON.stringify({
    ok: true,
    writes: outputChunks.length,
    lineCount: manualFrame.split('\n').length
}));
