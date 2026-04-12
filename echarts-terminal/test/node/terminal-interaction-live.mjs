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
import { BarChart, LineChart } from 'echarts/charts.js';
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components.js';
import { TerminalRenderer, patchECharts, initTerminalChart } from '../../dist/index.js';
import { normalizeTerminalOption } from '../terminal-layout.mjs';

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TitleComponent, TerminalRenderer]);

const terminalEcharts = patchECharts(echarts);

const chart = initTerminalChart(terminalEcharts, null, {
    width: 84,
    height: 24
});

const player = chart.createTerminalPlayer({
    output: process.stdout,
    input: process.stdin
});

const option = normalizeTerminalOption({
    title: {
        text: 'Interactive Terminal Demo'
    },
    legend: {
        data: ['Orders', 'Trend']
    },
    grid: {
        top: 7,
        bottom: 3,
        left: 3,
        right: 2
    },
    xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    },
    yAxis: {
        type: 'value'
    },
    series: [
        {
            name: 'Orders',
            type: 'bar',
            itemStyle: { color: '#37A2FF' },
            data: [120, 200, 150, 80, 70, 110, 130]
        },
        {
            name: 'Trend',
            type: 'line',
            symbol: 'none',
            lineStyle: { width: 3, color: '#F59E0B' },
            data: [90, 140, 110, 160, 210, 190, 240]
        }
    ]
});

function cleanup(exitCode = 0) {
    process.stdin.off?.('data', handleExitKey);
    process.off('SIGINT', handleSigint);
    player.stop();
    chart.dispose();
    process.stdout.write('\n');
    process.exit(exitCode);
}

function handleExitKey(chunk) {
    const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (text === 'q' || text === 'Q' || text === '\u0003') {
        cleanup(0);
    }
}

function handleSigint() {
    cleanup(0);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('This live demo needs a real TTY. Run `npm run showcase:interactive` in a local terminal.');
    chart.setOption(option);
    console.log(chart.renderToTerminalString());
    player.stop();
    chart.dispose();
    process.exit(0);
}

console.log('Press Enter to enter interaction mode, arrow keys to move, Esc to leave interaction mode, q / Ctrl+C to quit.');
chart.setOption(option);
process.stdin.on('data', handleExitKey);
process.on('SIGINT', handleSigint);
