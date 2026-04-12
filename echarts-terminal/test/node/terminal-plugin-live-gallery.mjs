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
import {
    installTerminalLiveShowcase,
    terminalLiveCases
} from './terminal-live-cases.mjs';
import { patchECharts, initTerminalChart } from '../../dist/index.js';

const terminalEcharts = patchECharts(echarts);
installTerminalLiveShowcase(terminalEcharts);

assert.ok(terminalLiveCases.length >= 15, 'live gallery should cover the major chart families');

const outputChunks = [];
const chart = initTerminalChart(terminalEcharts, null, {
    width: 72,
    height: 20
});
const player = chart.createTerminalPlayer({
    output: {
        write(chunk) {
            outputChunks.push(chunk);
        }
    }
});

for (const config of terminalLiveCases) {
    const before = outputChunks.length;
    chart.setOption(config.getOption(0), true);
    chart.setOption(config.getOption(1), true);
    assert.equal(outputChunks.length, before + 2, `${config.id} should repaint on each update`);
}

player.stop();
chart.dispose();

console.log(JSON.stringify({
    ok: true,
    cases: terminalLiveCases.length,
    writes: outputChunks.length
}));
