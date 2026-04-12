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
import {
    patchECharts,
    initTerminalChart
} from '../../dist/index.js';
import {
    installTerminalLiveShowcase,
    terminalLiveCases
} from './terminal-live-cases.mjs';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const terminalEcharts = patchECharts(echarts);
installTerminalLiveShowcase(terminalEcharts);

const chart = initTerminalChart(terminalEcharts, null, {
    width: 72,
    height: 20
});
const player = chart.createTerminalPlayer({
    output: process.stdout
});

for (const config of terminalLiveCases) {
    const frames = config.frames == null ? 3 : config.frames;
    for (let step = 0; step < frames; step++) {
        chart.setOption(config.getOption(step), true);
        await sleep(180);
    }
    await sleep(120);
}

player.stop();
chart.dispose();
console.log(`terminal live demo complete (${terminalLiveCases.length} chart families)`);
