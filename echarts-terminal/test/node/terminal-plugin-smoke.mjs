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
import {
    BarChart,
    LineChart,
    PieChart,
    SankeyChart
} from 'echarts/charts.js';
import {
    GridComponent,
    LegendComponent,
    TitleComponent
} from 'echarts/components.js';
import {
    TerminalRenderer,
    patchECharts,
    initTerminalChart
} from '../../dist/index.js';

echarts.use([BarChart, LineChart, PieChart, SankeyChart, GridComponent, LegendComponent, TitleComponent, TerminalRenderer]);
const terminalEcharts = patchECharts(echarts);

const cases = {
    bar: {
        title: { text: 'Plugin Bar' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [3, 5, 2] }]
    },
    line: {
        title: { text: 'Plugin Line' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: [3, 5, 2] }]
    },
    pie: {
        title: { text: 'Plugin Pie' },
        series: [{ type: 'pie', data: [{ name: 'A', value: 4 }, { name: 'B', value: 6 }] }]
    },
    sankey: {
        title: { text: 'Plugin Sankey' },
        series: [{ type: 'sankey', data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], links: [{ source: 'A', target: 'B', value: 3 }, { source: 'B', target: 'C', value: 2 }] }]
    },
    legend: {
        title: { text: 'Legend Probe', top: 8, left: 3 },
        legend: {
            top: 28,
            left: 3,
            itemWidth: 12,
            itemHeight: 8,
            itemGap: 10,
            icon: 'roundRect',
            data: [{ name: 'Alpha', icon: 'roundRect' }, { name: 'Beta', icon: 'roundRect' }],
            textStyle: { color: '#aeb7c4', fontSize: 12 }
        },
        grid: { top: 88, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
        yAxis: { type: 'value' },
        series: [
            { name: 'Alpha', type: 'bar', itemStyle: { color: '#37A2FF' }, data: [3, 5, 2] },
            { name: 'Beta', type: 'line', lineStyle: { width: 3, color: '#5b7cfa' }, data: [2, 4, 6] }
        ]
    }
};

const out = {};
for (const [name, option] of Object.entries(cases)) {
    const chart = initTerminalChart(terminalEcharts, null, { width: 72, height: 22 });
    chart.setOption(option);
    const frame = chart.renderToTerminalString();
    const lineCount = frame.split('\n').length;
    assert.equal(lineCount, 22, `${name} should render to the requested terminal height`);
    assert.ok(frame.includes('\u001b['), `${name} should include ANSI escapes`);
    const plainFrame = frame.replace(/\u001b\[[0-9;]*m/g, '');
    if (name === 'legend') {
        const headerLines = plainFrame.split('\n').slice(0, 4);
        assert.ok(plainFrame.includes('Alpha'), 'legend should keep the first legend label visible');
        assert.ok(plainFrame.includes('Beta'), 'legend should keep the second legend label visible');
        assert.equal(
            headerLines[3].trim(),
            '',
            'legend markers should fit on a single terminal row instead of spilling into a second icon row'
        );
    }
    out[name] = {
        hasAnsi: true,
        lineCount,
        length: frame.length
    };
    chart.dispose();
}

console.log(JSON.stringify(out));
