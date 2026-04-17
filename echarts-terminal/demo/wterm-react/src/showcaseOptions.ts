import type { EChartsCoreOption } from 'echarts/core';

export type ShowcaseOption = {
    id: string
    label: string
    description: string
    option: EChartsCoreOption
};

export const showcaseOptions: ShowcaseOption[] = [
    {
        id: 'bar',
        label: 'Grouped bar',
        description: 'Two series with clear categories for left/right and up/down interaction.',
        option: {
            title: { text: 'Grouped Bars' },
            grid: { top: 4, bottom: 3, left: 3, right: 2 },
            xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            yAxis: { type: 'value' },
            series: [
                { name: 'North', type: 'bar', itemStyle: { color: '#37A2FF' }, data: [120, 200, 150, 80, 70] },
                { name: 'South', type: 'bar', itemStyle: { color: '#F59E0B' }, data: [90, 140, 110, 160, 210] }
            ]
        }
    },
    {
        id: 'line',
        label: 'Dual line',
        description: 'Line focus makes point navigation obvious and keeps labels legible.',
        option: {
            title: { text: 'Weekly Revenue Trend' },
            legend: { top: 2, data: ['Revenue', 'Forecast'] },
            grid: { top: 4, bottom: 3, left: 3, right: 2 },
            xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            yAxis: { type: 'value' },
            series: [
                { name: 'Revenue', type: 'line', symbol: 'circle', symbolSize: 9, lineStyle: { width: 4, color: '#2F4554' }, itemStyle: { color: '#37A2FF' }, data: [120, 182, 151, 234, 290, 330, 310] },
                { name: 'Forecast', type: 'line', symbol: 'none', lineStyle: { width: 3, color: '#F59E0B' }, data: [110, 160, 170, 220, 260, 300, 320] }
            ]
        }
    },
    {
        id: 'stackedLine',
        label: 'Stacked line',
        description: 'Shows stacked values while keeping arrow-key navigation responsive.',
        option: {
            title: { text: 'Stacked Lines' },
            grid: { top: 4, bottom: 3, left: 3, right: 2 },
            xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            yAxis: { type: 'value' },
            series: [
                { name: 'Signal', type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#6EE7B7' }, data: [120, 132, 101, 134, 90, 230, 210] },
                { name: 'Load', type: 'line', stack: 'total', symbol: 'none', lineStyle: { width: 4, color: '#F59E0B' }, data: [220, 182, 191, 234, 290, 330, 310] }
            ]
        }
    },
    {
        id: 'scatter',
        label: 'Scatter',
        description: 'Good for checking non-bar point focus movement inside the browser terminal.',
        option: {
            title: { text: 'Scatter' },
            grid: { top: 4, bottom: 3, left: 3, right: 2 },
            xAxis: { type: 'value' },
            yAxis: { type: 'value' },
            series: [
                { name: 'Samples', type: 'scatter', symbolSize: 12, itemStyle: { color: '#37A2FF' }, data: [[1, 2], [2, 5], [3, 3], [4, 6], [5, 4]] }
            ]
        }
    },
    {
        id: 'legend',
        label: 'Legend layout',
        description: 'Adds a legend row so the demo covers richer text layout too.',
        option: {
            title: { text: 'Legend Layout' },
            legend: { top: 1, data: ['Revenue', 'Forecast', 'Target'] },
            grid: { top: 7, bottom: 3, left: 3, right: 2 },
            xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            yAxis: { type: 'value' },
            series: [
                { name: 'Revenue', type: 'line', symbol: 'circle', symbolSize: 8, lineStyle: { width: 4, color: '#37A2FF' }, itemStyle: { color: '#37A2FF' }, data: [120, 182, 151, 234, 290, 330, 310] },
                { name: 'Forecast', type: 'line', symbol: 'none', lineStyle: { width: 3, color: '#F59E0B' }, data: [110, 160, 170, 220, 260, 300, 320] },
                { name: 'Target', type: 'line', symbol: 'none', lineStyle: { width: 2, color: '#6EE7B7' }, data: [100, 140, 180, 220, 260, 300, 340] }
            ]
        }
    }
];

export const sizePresets = [
    { id: 'compact', label: 'Compact', cols: 60, rows: 18 },
    { id: 'standard', label: 'Standard', cols: 72, rows: 22 },
    { id: 'wide', label: 'Wide', cols: 96, rows: 28 }
] as const;

export const terminalThemes = [
    { id: 'default', label: 'Default', theme: undefined },
    { id: 'solarized-dark', label: 'Solarized Dark', theme: 'solarized-dark' },
    { id: 'monokai', label: 'Monokai', theme: 'monokai' },
    { id: 'light', label: 'Light', theme: 'light' }
] as const;
