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
import * as echarts from 'npm:echarts/core';
import {
    BarChart,
    PieChart,
    SankeyChart
} from 'npm:echarts/charts';
import {
    GridComponent,
    TitleComponent
} from 'npm:echarts/components';
import {
    TerminalRenderer,
    patchECharts,
    initTerminalChart
} from '../../dist/index.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const terminalEcharts = patchECharts(echarts);
terminalEcharts.use([BarChart, PieChart, SankeyChart, GridComponent, TitleComponent, TerminalRenderer]);

const cases = {
    bar: {
        title: { text: 'Deno Bar' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [3, 5, 2] }]
    },
    pie: {
        title: { text: 'Deno Pie' },
        series: [{ type: 'pie', data: [{ name: 'A', value: 4 }, { name: 'B', value: 6 }] }]
    },
    sankey: {
        title: { text: 'Deno Sankey' },
        series: [{
            type: 'sankey',
            data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            links: [
                { source: 'A', target: 'B', value: 3 },
                { source: 'B', target: 'C', value: 2 }
            ]
        }]
    }
};

const out = {};
for (const [name, option] of Object.entries(cases)) {
    const chart = initTerminalChart(terminalEcharts, null, { width: 72, height: 22 });
    chart.setOption(option);
    const frame = chart.renderToTerminalString();
    const lineCount = frame.split('\n').length;
    assert(lineCount === 22, `${name} should render to the requested terminal height`);
    assert(frame.includes('\u001b['), `${name} should include ANSI escapes`);
    out[name] = {
        hasAnsi: true,
        lineCount,
        length: frame.length
    };
    chart.dispose();
}

console.log(JSON.stringify(out));
