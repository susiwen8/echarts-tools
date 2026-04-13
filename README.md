# echarts-tools

`echarts-tools` 是一组围绕 Apache ECharts 的实用工具，目前包含两个子包：

| 包 | 作用 | 适合谁 |
| --- | --- | --- |
| `echarts-cli` | 在命令行里离线查询 ECharts 图表、组件、特性、renderer、option 和示例 | 想快速查资料、写配置、找示例的 ECharts 使用者 |
| `echarts-terminal` | 把 ECharts 图表渲染成终端里的 ANSI 彩色输出，并支持实时刷新与键盘交互 | 想在 Node.js CLI / TUI / 终端 Dashboard 里直接展示图表的开发者 |

如果你经常在终端里开发或调试 ECharts，这个仓库的典型用法是：

1. 用 `echarts-cli` 查某个图表/组件的名字、Option 类型和对应示例。
2. 用 `echarts-terminal` 把同一份 ECharts option 直接渲染到终端里。

## 功能概览

### `echarts-cli`

- 离线查询 ECharts 元数据，不依赖浏览器
- 支持列出图表、组件、特性、renderer
- 支持查看某个条目的导出名、源码位置、Option 类型、Option 路径
- 支持搜索示例，并直接打印示例 HTML 源码
- 支持 `text`、`json`、`markdown` 三种输出格式
- 优先读取打包好的 `data/metadata.json`，在仓库开发环境里也能回退到源码提取

主要命令：

- `echarts list`
- `echarts info <name>`
- `echarts example <query> [id]`
- `echarts option [name]`

### `echarts-terminal`

- 以 ECharts renderer/plugin 的方式接入，而不是单独造一套图表 DSL
- 支持把图表输出为 ANSI 字符串：`chart.renderToTerminalString()`
- 支持用 `createTerminalPlayer()` / `chart.createTerminalPlayer()` 做原地刷新
- 支持在真实 TTY 中通过键盘交互浏览数据点
- 终端场景下默认尽量把数值直接渲染出来，减少对 hover tooltip 的依赖
- 仓库内带有 smoke、showcase、interactive demo 和 live gallery 脚本

常见适用场景：

- 终端 dashboard
- 本地调试脚本里的图表预览
- Node.js CLI / TUI 工具
- 无浏览器环境下的 ECharts 渲染实验

## 仓库结构

```text
echarts-tools/
├── echarts-cli/       # 离线知识查询 CLI
└── echarts-terminal/  # 终端渲染插件
```

每个子目录都是一个独立 npm 包，分别安装和运行。

## 怎么用

### 1. 使用 `echarts-cli`

先安装依赖并生成/刷新元数据：

```bash
cd echarts-cli
npm install
npm run build:data
```

常用命令：

```bash
# 列出所有已知条目
npm run cli -- list

# 只看 chart，并输出成 markdown 表格
npm run cli -- list --kind chart --format markdown

# 查看某个图表或组件的详细信息
npm run cli -- info line
npm run cli -- info tooltip --format json

# 搜索示例
npm run cli -- example line

# 打印具体示例源码
npm run cli -- example line line

# 查看 option 入口或某个条目的 option 信息
npm run cli -- option
npm run cli -- option line
```

你可以把它当成一个“ECharts 离线速查表”：

- 想知道 `line` 对应什么 `Option Type`，用 `info`
- 想知道有哪些顶层 option 键，先跑 `option`
- 想找官方示例片段，跑 `example`

更多说明见 [echarts-cli/README.md](./echarts-cli/README.md)。

### 2. 使用 `echarts-terminal`

先安装依赖并构建：

```bash
cd echarts-terminal
npm install
npm run build
```

最小示例：

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
const chart = initTerminalChart(terminalEcharts, null, {
  width: 72,
  height: 22
});

chart.setOption({
  title: { text: 'Hello terminal' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [3, 5, 2] }]
});

console.log(chart.renderToTerminalString());
```

如果你想在终端里持续刷新同一个图表：

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

交互模式（真实 TTY 中）：

- `Enter`：进入交互模式
- `Left / Right`：切换数据点
- `Up / Down`：在同一类目下切换 series
- `Esc`：退出交互模式

常用本地演示命令：

```bash
# 合约/能力验证
npm run smoke:contract

# 基础 smoke
npm run smoke

# 输出静态 showcase
npm run showcase

# 终端交互 demo
npm run showcase:interactive

# 轮播 live gallery
npm run showcase:live
```

更多说明见 [echarts-terminal/README.md](./echarts-terminal/README.md)。

## 开发建议

### `echarts-cli`

```bash
cd echarts-cli
npm test
```

### `echarts-terminal`

```bash
cd echarts-terminal
npm run smoke:contract
```

如果你正在修改终端渲染效果，建议优先跑：

- `npm run showcase`
- `npm run showcase:interactive`
- `npm run showcase:live`

这样比只看单个 smoke case 更容易发现布局、文字、颜色和交互退化。

## 当前状态

- `echarts-cli` 更偏向“离线查询工具”和“开发辅助工具”。
- `echarts-terminal` 属于实验性终端 renderer，目标是让 ECharts 在终端里“可用且直观”，而不是像浏览器那样做到像素级一致。
- 两个子包都已经自带各自的 README、测试或 smoke 脚本；顶层 README 主要负责帮助你快速理解仓库和第一次上手。

## License

Apache-2.0
