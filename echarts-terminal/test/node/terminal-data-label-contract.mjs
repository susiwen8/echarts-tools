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
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts.js';
import { GridComponent, TitleComponent } from 'echarts/components.js';
import { TerminalRenderer, patchECharts, initTerminalChart } from '../../dist/index.js';
import { normalizeTerminalOption } from '../terminal-layout.mjs';

echarts.use([BarChart, LineChart, PieChart, ScatterChart, GridComponent, TitleComponent, TerminalRenderer]);

function render(option) {
    const chart = initTerminalChart(patchECharts(echarts), null, { width: 72, height: 22 });
    chart.setOption(normalizeTerminalOption(option));
    const output = chart.renderToTerminalString().replace(/\u001b\[[0-9;]*m/g, '');
    chart.dispose();
    return output;
}

const barOutput = render({
    title: { text: 'Bar' },
    grid: { top: 4, bottom: 3, left: 3, right: 2 },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [17, 29, 43] }]
});
assert.ok(barOutput.includes('17') && barOutput.includes('29') && barOutput.includes('43'),
    'terminal bar charts should always show the bar values without requiring hover');

const lineOutput = render({
    title: { text: 'Line' },
    grid: { top: 4, bottom: 3, left: 3, right: 2 },
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [17, 29, 43] }]
});
assert.ok(lineOutput.includes('17') && lineOutput.includes('29') && lineOutput.includes('43'),
    'terminal line charts should always show the point values without requiring hover');

const stackedLineOutput = render({
    title: { text: 'Stacked Lines' },
    grid: { top: 4, bottom: 3, left: 3, right: 2 },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    yAxis: { type: 'value' },
    series: [
        { type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#6EE7B7' }, data: [120, 132, 101, 134, 90, 230, 210] },
        { type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#F59E0B' }, data: [220, 182, 191, 234, 290, 330, 310] }
    ]
});
assert.ok(
    ['120', '132', '101', '134', '90', '230', '210', '220', '182', '191', '234', '290', '330', '310']
        .every(value => stackedLineOutput.includes(value)),
    'terminal stacked line charts should always show stacked point values without requiring hover'
);

const scatterOutput = render({
    title: { text: 'Scatter' },
    grid: { top: 4, bottom: 3, left: 3, right: 2 },
    xAxis: { type: 'value' },
    yAxis: { type: 'value' },
    series: [{ type: 'scatter', data: [[1.1, 2.2], [2.2, 5.5], [3.3, 3.4]] }]
});
assert.ok(scatterOutput.includes('1.1,2.2') && scatterOutput.includes('2.2,5.5') && scatterOutput.includes('3.3,3.4'),
    'terminal scatter charts should always show coordinate values without requiring hover');

const pieOutput = render({
    title: { text: 'Pie' },
    series: [{ type: 'pie', data: [{ name: 'Alpha', value: 17 }, { name: 'Beta', value: 29 }] }]
});
assert.ok(pieOutput.includes('Alpha:17') && pieOutput.includes('Beta:29'),
    'terminal pie charts should always show slice names and values without requiring hover');

console.log(JSON.stringify({
    ok: true,
    autoLabelsVisible: true
}));
