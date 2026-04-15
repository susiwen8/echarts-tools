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
    BoxplotChart,
    CandlestickChart,
    FunnelChart,
    GaugeChart,
    GraphChart,
    HeatmapChart,
    LineChart,
    ParallelChart,
    PieChart,
    PictorialBarChart,
    RadarChart,
    SankeyChart,
    ScatterChart,
    SunburstChart,
    ThemeRiverChart,
    TreeChart,
    TreemapChart
} from 'echarts/charts.js';
import {
    GridComponent,
    LegendComponent,
    ParallelComponent,
    RadarComponent,
    SingleAxisComponent,
    TitleComponent,
    VisualMapComponent
} from 'echarts/components.js';
import { TerminalRenderer } from '../../dist/index.js';

export function installTerminalShowcase(echarts) {
    echarts.use([
        BarChart,
        BoxplotChart,
        CandlestickChart,
        FunnelChart,
        GaugeChart,
        GraphChart,
        HeatmapChart,
        LineChart,
        ParallelChart,
        PieChart,
        PictorialBarChart,
        RadarChart,
        SankeyChart,
        ScatterChart,
        SunburstChart,
        ThemeRiverChart,
        TreeChart,
        TreemapChart,
        GridComponent,
        LegendComponent,
        ParallelComponent,
        RadarComponent,
        SingleAxisComponent,
        TitleComponent,
        VisualMapComponent,
        TerminalRenderer
    ]);
}

export const terminalShowcaseExamples = {
    bar: {
        title: { text: 'Grouped Bars' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        yAxis: { type: 'value' },
        series: [
            { type: 'bar', itemStyle: { color: '#37A2FF' }, data: [120, 200, 150, 80, 70] },
            { type: 'bar', itemStyle: { color: '#F59E0B' }, data: [90, 140, 110, 160, 210] }
        ]
    },
    legend: {
        title: { text: 'Legend Layout' },
        legend: {
            top: 1,
            data: ['Revenue', 'Forecast', 'Target']
        },
        grid: { top: 7, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        yAxis: { type: 'value' },
        series: [
            { name: 'Revenue', type: 'line', symbol: 'circle', symbolSize: 8, lineStyle: { width: 4, color: '#37A2FF' }, itemStyle: { color: '#37A2FF' }, data: [120, 182, 151, 234, 290, 330, 310] },
            { name: 'Forecast', type: 'line', symbol: 'none', lineStyle: { width: 3, color: '#F59E0B' }, data: [110, 160, 170, 220, 260, 300, 320] },
            { name: 'Target', type: 'line', symbol: 'none', lineStyle: { width: 2, color: '#6EE7B7' }, data: [100, 140, 180, 220, 260, 300, 340] }
        ]
    },
    line: {
        title: { text: 'Weekly Revenue Trend' },
        legend: { top: 2, data: ['Revenue', 'Forecast'] },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        yAxis: { type: 'value' },
        series: [
            { name: 'Revenue', type: 'line', symbol: 'circle', symbolSize: 9, lineStyle: { width: 4, color: '#2F4554' }, itemStyle: { color: '#37A2FF' }, data: [120, 182, 151, 234, 290, 330, 310] },
            { name: 'Forecast', type: 'line', symbol: 'none', lineStyle: { width: 3, color: '#F59E0B' }, data: [110, 160, 170, 220, 260, 300, 320] }
        ]
    },
    stackedLine: {
        title: { text: 'Stacked Lines' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        yAxis: { type: 'value' },
        series: [
            { type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#6EE7B7' }, data: [120, 132, 101, 134, 90, 230, 210] },
            { type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#F59E0B' }, data: [220, 182, 191, 234, 290, 330, 310] }
        ]
    },
    scatter: {
        title: { text: 'Scatter' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'value' },
        yAxis: { type: 'value' },
        series: [{ type: 'scatter', symbolSize: 12, itemStyle: { color: '#37A2FF' }, data: [[1, 2], [2, 5], [3, 3], [4, 6], [5, 4]] }]
    },
    heatmap: {
        title: { text: 'Heatmap' },
        grid: { top: 4, bottom: 3, left: 4, right: 2 },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'category', data: ['X', 'Y', 'Z'] },
        visualMap: { min: 0, max: 10, show: false, inRange: { color: ['#313695', '#74add1', '#fdae61', '#a50026'] } },
        series: [{ type: 'heatmap', data: [[0, 0, 1], [1, 0, 4], [2, 0, 2], [0, 1, 6], [1, 1, 8], [2, 1, 5], [0, 2, 9], [1, 2, 10], [2, 2, 7]] }]
    },
    candlestick: {
        title: { text: 'Candlestick' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        yAxis: { scale: true },
        series: [{ type: 'candlestick', itemStyle: { color: '#ef4444', color0: '#10b981', borderColor: '#ef4444', borderColor0: '#10b981' }, data: [[100, 120, 90, 130], [120, 110, 100, 125], [110, 140, 105, 145], [140, 130, 120, 150], [130, 150, 125, 160]] }]
    },
    boxplot: {
        title: { text: 'Boxplot' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', itemStyle: { color: '#93c5fd', borderColor: '#2563eb' }, data: [[20, 30, 40, 50, 60], [25, 35, 45, 55, 65], [30, 38, 46, 58, 70]] }]
    },
    pictorialBar: {
        title: { text: 'Pictorial Bar' },
        grid: { top: 4, bottom: 3, left: 3, right: 2 },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [{ type: 'pictorialBar', symbol: 'rect', symbolRepeat: true, symbolSize: [12, 6], itemStyle: { color: '#8b5cf6' }, data: [12, 18, 9] }]
    },
    pie: {
        title: { text: 'Pie' },
        series: [{ type: 'pie', radius: ['30%', '65%'], data: [{ name: 'A', value: 40 }, { name: 'B', value: 32 }, { name: 'C', value: 28 }] }]
    },
    radar: {
        title: { text: 'Radar' },
        radar: { indicator: [{ name: 'A', max: 100 }, { name: 'B', max: 100 }, { name: 'C', max: 100 }, { name: 'D', max: 100 }, { name: 'E', max: 100 }] },
        series: [{ type: 'radar', data: [{ value: [80, 65, 90, 70, 60] }] }]
    },
    gauge: {
        title: { text: 'Gauge' },
        series: [{ type: 'gauge', progress: { show: true }, detail: { formatter: '{value}%' }, data: [{ value: 68, name: 'Score' }] }]
    },
    funnel: {
        title: { text: 'Funnel' },
        series: [{ type: 'funnel', data: [{ name: 'Visit', value: 100 }, { name: 'Query', value: 80 }, { name: 'Order', value: 50 }] }]
    },
    sankey: {
        title: { text: 'Sankey' },
        series: [{ type: 'sankey', data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], links: [{ source: 'A', target: 'B', value: 3 }, { source: 'B', target: 'C', value: 2 }] }]
    },
    tree: {
        title: { text: 'Tree' },
        series: [{ type: 'tree', data: [{ name: 'Root', children: [{ name: 'Left' }, { name: 'Right', children: [{ name: 'Leaf' }] }] }] }]
    },
    treemap: {
        title: { text: 'Treemap' },
        series: [{ type: 'treemap', data: [{ name: 'A', value: 6 }, { name: 'B', value: 4 }, { name: 'C', value: 3 }] }]
    },
    sunburst: {
        title: { text: 'Sunburst' },
        series: [{ type: 'sunburst', data: [{ name: 'A', value: 5, children: [{ name: 'A1', value: 2 }, { name: 'A2', value: 3 }] }, { name: 'B', value: 4 }] }]
    },
    graph: {
        title: { text: 'Graph' },
        series: [{ type: 'graph', layout: 'none', roam: false, data: [{ name: 'A', x: 60, y: 80 }, { name: 'B', x: 180, y: 120 }, { name: 'C', x: 120, y: 200 }], links: [{ source: 0, target: 1 }, { source: 1, target: 2 }] }]
    },
    parallel: {
        title: { text: 'Parallel' },
        parallelAxis: [{ dim: 0, name: 'A', max: 100 }, { dim: 1, name: 'B', max: 100 }, { dim: 2, name: 'C', max: 100 }],
        series: [{ type: 'parallel', data: [[80, 70, 60], [60, 90, 50]] }]
    },
    themeRiver: {
        title: { text: 'ThemeRiver' },
        singleAxis: { type: 'time' },
        series: [{ type: 'themeRiver', data: [['2025/01/01', 10, 'A'], ['2025/01/02', 15, 'A'], ['2025/01/01', 8, 'B'], ['2025/01/02', 11, 'B']] }]
    }
};

export const terminalShowcaseIds = Object.keys(terminalShowcaseExamples);
