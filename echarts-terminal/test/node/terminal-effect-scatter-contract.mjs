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
import { ScatterChart, EffectScatterChart } from 'echarts/charts.js';
import { GridComponent, TitleComponent } from 'echarts/components.js';
import { TerminalRenderer, patchECharts, initTerminalChart } from '../../dist/index.js';
import { normalizeTerminalOption } from '../terminal-layout.mjs';

echarts.use([ScatterChart, EffectScatterChart, GridComponent, TitleComponent, TerminalRenderer]);

function renderSeries(type) {
    const chart = initTerminalChart(patchECharts(echarts), null, { width: 72, height: 22 });
    chart.setOption(normalizeTerminalOption({
        title: { text: 'Scatter' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'value' },
        yAxis: { type: 'value' },
        series: [{
            type,
            symbolSize: 12,
            itemStyle: { color: '#37A2FF' },
            data: [[1, 2], [2, 5], [3, 3], [4, 6], [5, 4]]
        }]
    }));
    const output = chart.renderToTerminalString().replace(/\u001b\[[0-9;]*m/g, '');
    chart.dispose();
    return output;
}

assert.equal(
    renderSeries('effectScatter'),
    renderSeries('scatter'),
    'effectScatter should render the same terminal frame as scatter when effect layers are suppressed'
);

console.log(JSON.stringify({
    ok: true,
    effectScatterMatchesScatter: true
}));
