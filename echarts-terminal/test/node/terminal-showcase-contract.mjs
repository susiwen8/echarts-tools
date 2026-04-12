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
import { spawnSync } from 'child_process';

const result = spawnSync(process.execPath, ['test/node/terminal-showcase.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8'
});

assert.equal(result.status, 0, result.stderr || `terminal-showcase exited with ${result.status}`);

const plain = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
assert.equal(
    plain.includes('===== EFFECTSCATTER ====='),
    false,
    'terminal-showcase should not keep a dedicated EFFECTSCATTER example once it matches scatter'
);
const legendStart = plain.indexOf('===== LEGEND =====');
assert.notEqual(legendStart, -1, 'terminal-showcase should print a LEGEND section');

const legendBlock = plain.slice(legendStart).split('===== LINE =====')[0].trimEnd();
const legendLines = legendBlock.split('\n').slice(1, 5);

assert.ok(
    legendLines[1]?.includes('Legend Layout'),
    'terminal-showcase LEGEND section should render the title in the reserved header row'
);
assert.ok(
    legendLines[2]?.includes('Revenue') && legendLines[2]?.includes('Forecast') && legendLines[2]?.includes('Target'),
    'terminal-showcase LEGEND section should render the legend labels in the header row'
);
assert.equal(
    legendLines[3]?.trim(),
    '',
    'terminal-showcase LEGEND section should not spill the legend header into the plot rows'
);

console.log(JSON.stringify({
    ok: true,
    legendHeaderAligned: true
}));
