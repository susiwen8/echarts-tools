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
import * as echarts from 'echarts/lib/export/core.js';
import { BarChart } from 'echarts/lib/export/charts.js';
import { GridComponent, TitleComponent } from 'echarts/lib/export/components.js';
import { TerminalRenderer, patchECharts, initTerminalChart } from '../../dist/index.js';

echarts.use([BarChart, GridComponent, TitleComponent, TerminalRenderer]);
const terminalEcharts = patchECharts(echarts);

const chart = initTerminalChart(terminalEcharts, null, {
    width: 60,
    height: 20
});

chart.setOption({
    title: {
        text: 'Terminal Bars'
    },
    grid: {
        top: 6,
        bottom: 3,
        left: 2,
        right: 1
    },
    xAxis: {
        type: 'category',
        data: ['A', 'B', 'C']
    },
    yAxis: {
        type: 'value'
    },
    series: [{
        type: 'bar',
        data: [2, 5, 3],
        itemStyle: {
            color: '#37A2FF'
        }
    }]
});

console.log(chart.renderToTerminalString());
chart.dispose();
