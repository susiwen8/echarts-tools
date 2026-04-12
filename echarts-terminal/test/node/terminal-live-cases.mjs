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
import {
    BarChart,
    LineChart,
    ScatterChart,
    HeatmapChart,
    CandlestickChart,
    BoxplotChart,
    PictorialBarChart,
    PieChart,
    RadarChart,
    GaugeChart,
    FunnelChart,
    SankeyChart,
    TreeChart,
    TreemapChart,
    SunburstChart,
    GraphChart,
    ParallelChart,
    ThemeRiverChart
} from 'echarts/charts.js';
import {
    GridComponent,
    TitleComponent,
    VisualMapComponent,
    RadarComponent,
    ParallelComponent,
    SingleAxisComponent
} from 'echarts/components.js';
import { TerminalRenderer } from '../../dist/index.js';

const BLUE = '#37A2FF';
const ORANGE = '#F59E0B';
const GREEN = '#6EE7B7';
const RED = '#EF4444';
const PURPLE = '#8B5CF6';
const SLATE = '#2F4554';

function wave(step, index, base, amplitude, divisor = 2.2, phase = 0) {
    return Math.round(base + Math.sin((step + index + phase) / divisor) * amplitude);
}

function positiveWave(step, index, base, amplitude, divisor = 2.2, phase = 0) {
    return Math.max(1, wave(step, index, base, amplitude, divisor, phase));
}

function categoryAxis(data) {
    return {
        type: 'category',
        data
    };
}

function cartesianFrame(title, categories, series, extra = {}) {
    return {
        title: { text: title },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: categoryAxis(categories),
        yAxis: { type: 'value' },
        series,
        ...extra
    };
}

export function installTerminalLiveShowcase(echarts) {
    echarts.use([
        BarChart,
        LineChart,
        ScatterChart,
        HeatmapChart,
        CandlestickChart,
        BoxplotChart,
        PictorialBarChart,
        PieChart,
        RadarChart,
        GaugeChart,
        FunnelChart,
        SankeyChart,
        TreeChart,
        TreemapChart,
        SunburstChart,
        GraphChart,
        ParallelChart,
        ThemeRiverChart,
        GridComponent,
        TitleComponent,
        VisualMapComponent,
        RadarComponent,
        ParallelComponent,
        SingleAxisComponent,
        TerminalRenderer
    ]);
}

export const terminalLiveCases = [
    {
        id: 'bar',
        frames: 4,
        getOption(step) {
            return cartesianFrame(
                `Live Bar  t=${step}`,
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                [
                    { type: 'bar', itemStyle: { color: BLUE }, data: [0, 1, 2, 3, 4].map(index => positiveWave(step, index, 130, 45, 2.5)) },
                    { type: 'bar', itemStyle: { color: ORANGE }, data: [0, 1, 2, 3, 4].map(index => positiveWave(step, index, 150, 55, 2.8, 1.4)) }
                ]
            );
        }
    },
    {
        id: 'line',
        frames: 4,
        getOption(step) {
            return cartesianFrame(
                `Live Line  t=${step}`,
                ['00', '01', '02', '03', '04', '05', '06', '07'],
                [{
                    type: 'line',
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: { width: 3, color: SLATE },
                    itemStyle: { color: BLUE },
                    data: new Array(8).fill(0).map((_, index) => positiveWave(step, index, 190, 70, 2.6, index * 0.2))
                }]
            );
        }
    },
    {
        id: 'stackedLine',
        frames: 4,
        getOption(step) {
            return cartesianFrame(
                `Live Stacked Line  t=${step}`,
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                [
                    {
                        type: 'line',
                        stack: 'total',
                        symbol: 'none',
                        lineStyle: { width: 3, color: GREEN },
                        data: new Array(7).fill(0).map((_, index) => positiveWave(step, index, 120, 35, 2.1))
                    },
                    {
                        type: 'line',
                        stack: 'total',
                        symbol: 'none',
                        lineStyle: { width: 3, color: ORANGE },
                        data: new Array(7).fill(0).map((_, index) => positiveWave(step, index, 180, 55, 2.4, 1.2))
                    }
                ]
            );
        }
    },
    {
        id: 'scatter',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Scatter  t=${step}` },
                grid: { top: 4, bottom: 3, left: 3, right: 2 },
                xAxis: { type: 'value', min: 0, max: 7 },
                yAxis: { type: 'value', min: 0, max: 7 },
                series: [{
                    type: 'scatter',
                    symbolSize: 12,
                    itemStyle: { color: BLUE },
                    data: new Array(6).fill(0).map((_, index) => [
                        +(1 + index * 0.9 + Math.sin((step + index) / 2.3) * 0.45).toFixed(2),
                        +(1.4 + (index % 3) * 1.5 + Math.cos((step + index) / 2.1) * 0.65).toFixed(2)
                    ])
                }]
            };
        }
    },
    {
        id: 'heatmap',
        frames: 4,
        getOption(step) {
            const cells = [];
            for (let x = 0; x < 3; x++) {
                for (let y = 0; y < 3; y++) {
                    cells.push([x, y, positiveWave(step, x + y * 2, 5, 4, 2.0)]);
                }
            }
            return {
                title: { text: `Live Heatmap  t=${step}` },
                grid: { top: 4, bottom: 3, left: 4, right: 2 },
                xAxis: { type: 'category', data: ['A', 'B', 'C'] },
                yAxis: { type: 'category', data: ['X', 'Y', 'Z'] },
                visualMap: {
                    min: 0,
                    max: 10,
                    show: false,
                    inRange: { color: ['#313695', '#74add1', '#fdae61', '#a50026'] }
                },
                series: [{ type: 'heatmap', data: cells }]
            };
        }
    },
    {
        id: 'candlestick',
        frames: 4,
        getOption(step) {
            const data = new Array(5).fill(0).map((_, index) => {
                const open = positiveWave(step, index, 110 + index * 8, 18, 2.4);
                const close = positiveWave(step + 1, index, 118 + index * 8, 18, 2.2);
                const low = Math.min(open, close) - 12 - (index % 2) * 3;
                const high = Math.max(open, close) + 14 + (index % 3) * 2;
                return [open, close, low, high];
            });
            return {
                title: { text: `Live Candlestick  t=${step}` },
                grid: { top: 4, bottom: 3, left: 3, right: 2 },
                xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
                yAxis: { scale: true },
                series: [{
                    type: 'candlestick',
                    itemStyle: {
                        color: RED,
                        color0: '#10B981',
                        borderColor: RED,
                        borderColor0: '#10B981'
                    },
                    data
                }]
            };
        }
    },
    {
        id: 'boxplot',
        frames: 4,
        getOption(step) {
            const data = new Array(3).fill(0).map((_, index) => {
                const min = positiveWave(step, index, 18 + index * 4, 4, 2.6);
                const q1 = min + 8 + index;
                const median = q1 + 8 + (step % 3);
                const q3 = median + 10 + (index % 2);
                const max = q3 + 11 + (step % 2);
                return [min, q1, median, q3, max];
            });
            return cartesianFrame(
                `Live Boxplot  t=${step}`,
                ['A', 'B', 'C'],
                [{
                    type: 'boxplot',
                    itemStyle: { color: '#93C5FD', borderColor: '#2563EB' },
                    data
                }]
            );
        }
    },
    {
        id: 'pictorialBar',
        frames: 4,
        getOption(step) {
            return cartesianFrame(
                `Live Pictorial Bar  t=${step}`,
                ['A', 'B', 'C'],
                [{
                    type: 'pictorialBar',
                    symbol: 'rect',
                    symbolRepeat: true,
                    symbolSize: [12, 6],
                    itemStyle: { color: PURPLE },
                    data: [0, 1, 2].map(index => positiveWave(step, index, 12, 5, 2.3))
                }]
            );
        }
    },
    {
        id: 'pie',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Pie  t=${step}` },
                series: [{
                    type: 'pie',
                    radius: ['30%', '65%'],
                    data: [
                        { name: 'A', value: positiveWave(step, 0, 36, 12, 2.5) },
                        { name: 'B', value: positiveWave(step, 1, 30, 10, 2.3) },
                        { name: 'C', value: positiveWave(step, 2, 26, 8, 2.1) }
                    ]
                }]
            };
        }
    },
    {
        id: 'radar',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Radar  t=${step}` },
                radar: {
                    indicator: [
                        { name: 'A', max: 100 },
                        { name: 'B', max: 100 },
                        { name: 'C', max: 100 },
                        { name: 'D', max: 100 },
                        { name: 'E', max: 100 }
                    ]
                },
                series: [{
                    type: 'radar',
                    data: [{
                        value: new Array(5).fill(0).map((_, index) => positiveWave(step, index, 65, 22, 2.4))
                    }]
                }]
            };
        }
    },
    {
        id: 'gauge',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Gauge  t=${step}` },
                series: [{
                    type: 'gauge',
                    progress: { show: true },
                    detail: { formatter: '{value}%' },
                    data: [{ value: positiveWave(step, 0, 62, 24, 2.0), name: 'Score' }]
                }]
            };
        }
    },
    {
        id: 'funnel',
        frames: 4,
        getOption(step) {
            const visit = positiveWave(step, 0, 100, 10, 2.5);
            const query = Math.max(visit - 18, positiveWave(step, 1, 78, 8, 2.2));
            const order = Math.max(query - 22, positiveWave(step, 2, 52, 7, 2.0));
            return {
                title: { text: `Live Funnel  t=${step}` },
                series: [{
                    type: 'funnel',
                    data: [
                        { name: 'Visit', value: visit },
                        { name: 'Query', value: query },
                        { name: 'Order', value: order }
                    ]
                }]
            };
        }
    },
    {
        id: 'sankey',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Sankey  t=${step}` },
                series: [{
                    type: 'sankey',
                    data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
                    links: [
                        { source: 'A', target: 'B', value: positiveWave(step, 0, 4, 2, 2.4) },
                        { source: 'A', target: 'C', value: positiveWave(step, 1, 3, 2, 2.0) },
                        { source: 'B', target: 'D', value: positiveWave(step, 2, 4, 2, 2.6) },
                        { source: 'C', target: 'D', value: positiveWave(step, 3, 3, 1, 2.2) }
                    ]
                }]
            };
        }
    },
    {
        id: 'tree',
        frames: 4,
        getOption(step) {
            const extraChildren = step % 2 === 0
                ? [{ name: `Leaf ${step}` }]
                : [{ name: 'Leaf' }, { name: `Bud ${step}` }];
            return {
                title: { text: `Live Tree  t=${step}` },
                series: [{
                    type: 'tree',
                    data: [{
                        name: 'Root',
                        children: [
                            { name: 'Left' },
                            { name: 'Right', children: extraChildren }
                        ]
                    }]
                }]
            };
        }
    },
    {
        id: 'treemap',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Treemap  t=${step}` },
                series: [{
                    type: 'treemap',
                    data: [
                        { name: 'A', value: positiveWave(step, 0, 6, 2, 2.2) },
                        { name: 'B', value: positiveWave(step, 1, 4, 2, 2.0) },
                        { name: 'C', value: positiveWave(step, 2, 3, 1, 2.4) }
                    ]
                }]
            };
        }
    },
    {
        id: 'sunburst',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Sunburst  t=${step}` },
                series: [{
                    type: 'sunburst',
                    data: [
                        {
                            name: 'A',
                            value: positiveWave(step, 0, 5, 2, 2.2),
                            children: [
                                { name: 'A1', value: positiveWave(step, 1, 2, 1, 2.0) },
                                { name: 'A2', value: positiveWave(step, 2, 3, 1, 2.4) }
                            ]
                        },
                        { name: 'B', value: positiveWave(step, 3, 4, 2, 2.1) }
                    ]
                }]
            };
        }
    },
    {
        id: 'graph',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Graph  t=${step}` },
                series: [{
                    type: 'graph',
                    layout: 'none',
                    roam: false,
                    data: [
                        { name: 'A', x: 60 + Math.sin(step / 2) * 16, y: 82 + Math.cos(step / 2) * 10 },
                        { name: 'B', x: 180 + Math.cos(step / 2.4) * 12, y: 120 + Math.sin(step / 2) * 16 },
                        { name: 'C', x: 120 + Math.sin(step / 2.1) * 14, y: 200 + Math.cos(step / 2.3) * 12 }
                    ],
                    links: [{ source: 0, target: 1 }, { source: 1, target: 2 }]
                }]
            };
        }
    },
    {
        id: 'parallel',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live Parallel  t=${step}` },
                parallelAxis: [
                    { dim: 0, name: 'A', max: 100 },
                    { dim: 1, name: 'B', max: 100 },
                    { dim: 2, name: 'C', max: 100 }
                ],
                series: [{
                    type: 'parallel',
                    data: [
                        [positiveWave(step, 0, 75, 15, 2.2), positiveWave(step, 1, 68, 14, 2.4), positiveWave(step, 2, 60, 18, 2.0)],
                        [positiveWave(step, 3, 58, 18, 2.1), positiveWave(step, 4, 82, 12, 2.6), positiveWave(step, 5, 48, 12, 2.3)]
                    ]
                }]
            };
        }
    },
    {
        id: 'themeRiver',
        frames: 4,
        getOption(step) {
            return {
                title: { text: `Live ThemeRiver  t=${step}` },
                singleAxis: { type: 'time' },
                series: [{
                    type: 'themeRiver',
                    data: [
                        ['2025/01/01', positiveWave(step, 0, 10, 4, 2.2), 'A'],
                        ['2025/01/02', positiveWave(step, 1, 14, 4, 2.0), 'A'],
                        ['2025/01/03', positiveWave(step, 2, 12, 5, 2.4), 'A'],
                        ['2025/01/01', positiveWave(step, 3, 8, 3, 2.1), 'B'],
                        ['2025/01/02', positiveWave(step, 4, 11, 4, 2.3), 'B'],
                        ['2025/01/03', positiveWave(step, 5, 13, 4, 2.5), 'B']
                    ]
                }]
            };
        }
    }
];
