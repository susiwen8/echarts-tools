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
import fs from 'fs';
import { fileURLToPath } from 'url';

const visualPath = fileURLToPath(new URL('../visual/terminal-compare-visual.mjs', import.meta.url));
const visualScript = fs.readFileSync(visualPath, 'utf8');

assert.match(
    visualScript,
    /toDataURL\(['"]image\/png['"]\)/,
    'visual export should serialize the terminal frame canvas directly to PNG data'
);
assert.doesNotMatch(
    visualScript,
    /\[data-visual-panel="terminal"\][\s\S]{0,200}\.screenshot\(/,
    'visual export should not screenshot the browser terminal panel wrapper'
);
assert.match(
    visualScript,
    /docs\/readme|readmeDir/,
    'visual update should sync README preview images from the terminal export artifacts'
);

console.log(JSON.stringify({
    ok: true,
    exportMode: 'terminal-canvas'
}));
