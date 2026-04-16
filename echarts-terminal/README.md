# echarts-terminal

Render Apache ECharts inside a terminal.

## Preview

These images are real terminal-rendered outputs:

| Bar | Line |
| --- | --- |
| ![Bar chart rendered in terminal](./docs/readme/bar.png) | ![Line chart rendered in terminal](./docs/readme/line.png) |

| Stacked Line | Scatter |
| --- | --- |
| ![Stacked line chart rendered in terminal](./docs/readme/stacked.png) | ![Scatter chart rendered in terminal](./docs/readme/scatter.png) |

| Heatmap | Candlestick |
| --- | --- |
| ![Heatmap rendered in terminal](./docs/readme/heatmap.png) | ![Candlestick chart rendered in terminal](./docs/readme/candlestick.png) |

| Boxplot | Pictorial Bar |
| --- | --- |
| ![Boxplot rendered in terminal](./docs/readme/boxplot.png) | ![Pictorial bar chart rendered in terminal](./docs/readme/pictorial-bar.png) |

| Pie | Radar |
| --- | --- |
| ![Pie chart rendered in terminal](./docs/readme/pie.png) | ![Radar chart rendered in terminal](./docs/readme/radar.png) |

| Gauge | Funnel |
| --- | --- |
| ![Gauge chart rendered in terminal](./docs/readme/gauge.png) | ![Funnel chart rendered in terminal](./docs/readme/funnel.png) |

| Sankey | Tree |
| --- | --- |
| ![Sankey chart rendered in terminal](./docs/readme/sankey.png) | ![Tree chart rendered in terminal](./docs/readme/tree.png) |

| Treemap | Sunburst |
| --- | --- |
| ![Treemap rendered in terminal](./docs/readme/treemap.png) | ![Sunburst chart rendered in terminal](./docs/readme/sunburst.png) |

| Graph | Parallel |
| --- | --- |
| ![Graph chart rendered in terminal](./docs/readme/graph.png) | ![Parallel chart rendered in terminal](./docs/readme/parallel.png) |

| Theme River | Legend Layout |
| --- | --- |
| ![Theme river chart rendered in terminal](./docs/readme/theme-river.png) | ![Legend layout rendered in terminal](./docs/readme/legend.png) |

## Basic usage

```js
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TitleComponent } from 'echarts/components';
import {
  TerminalRenderer,
  patchECharts,
  initTerminalChart
} from 'echarts-terminal';

echarts.use([BarChart, LineChart, GridComponent, TitleComponent, TerminalRenderer]);

const terminalEcharts = patchECharts(echarts);
const chart = initTerminalChart(terminalEcharts, null, { width: 72, height: 22 });

chart.setOption({
  title: { text: 'Hello terminal' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [3, 5, 2] }]
});

console.log(chart.renderToTerminalString());
```

## Live updates

```js
const player = chart.createTerminalPlayer({
  output: process.stdout
});

chart.setOption({
  title: { text: 'Tick 1' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [2, 4, 3] }]
});

chart.setOption({
  title: { text: 'Tick 2' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [4, 3, 5] }]
});

player.stop();
```

## Keyboard interaction

Press `Enter` to enter interaction mode.

- `Left / Right`: move across data points
- `Up / Down`: switch series
- `Esc`: exit interaction mode

Try it:

```bash
npm run showcase:interactive
```

## Development

For development commands, screenshot workflows, and baseline comparison:

- [docs/development.md](./docs/development.md)
