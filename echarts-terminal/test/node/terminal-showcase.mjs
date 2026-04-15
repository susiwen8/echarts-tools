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
import { patchECharts, initTerminalChart } from '../../dist/index.js';
import { normalizeTerminalOption } from '../terminal-layout.mjs';
import {
    installTerminalShowcase,
    terminalShowcaseExamples
} from './terminal-showcase-data.mjs';

installTerminalShowcase(echarts);
const terminalEcharts = patchECharts(echarts);
for (const [name, option] of Object.entries(terminalShowcaseExamples)) {
    const chart = initTerminalChart(terminalEcharts, null, {
        width: 72,
        height: 22
    });
    chart.setOption(normalizeTerminalOption(option));
    console.log(`\n===== ${name.toUpperCase()} =====`);
    console.log(chart.renderToTerminalString());
    chart.dispose();
}
