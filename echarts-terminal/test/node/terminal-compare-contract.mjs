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

const comparePath = fileURLToPath(new URL('../terminal-compare.html', import.meta.url));
const compareHtml = fs.readFileSync(comparePath, 'utf8');

assert.match(
    compareHtml,
    /id:\s*'legend'/,
    'terminal-compare should include a dedicated legend comparison case'
);
assert.match(
    compareHtml,
    /title:\s*'Legend Layout'/,
    'terminal-compare should include the legend comparison section title'
);
assert.match(
    compareHtml,
    /data:\s*\['Revenue',\s*'Forecast',\s*'Target'\]/,
    'terminal-compare legend case should expose the expected legend labels'
);
assert.doesNotMatch(
    compareHtml,
    /compare-legend/,
    'terminal-compare should keep title and legend inside the chart instead of rendering an external legend strip'
);
assert.doesNotMatch(
    compareHtml,
    /delete cloned\.title;/,
    'terminal-compare should preserve chart titles in the rendered chart option'
);
assert.doesNotMatch(
    compareHtml,
    /delete cloned\.legend;/,
    'terminal-compare should preserve chart legends in the rendered chart option'
);
assert.match(
    compareHtml,
    /import\s*\{\s*normalizeTerminalOption\s*\}\s*from\s*['"]\.\/terminal-layout\.mjs['"]/,
    'terminal-compare should import the shared terminal layout helper'
);
assert.match(
    compareHtml,
    /terminalChart\.setOption\(normalizeTerminalOption\(config\.option\)\)/,
    'terminal-compare should apply the shared terminal layout helper to terminal charts'
);
assert.match(
    compareHtml,
    /class="terminal-grid"/,
    'terminal-compare should render terminal frames into a dedicated cell grid container'
);
assert.doesNotMatch(
    compareHtml,
    /<pre id="terminal-[^"]+-chart"><\/pre>/,
    'terminal-compare should not rely on preformatted text for terminal screenshots'
);
assert.match(
    compareHtml,
    /id:\s*'legend'[\s\S]*title:\s*'Legend Layout'/,
    'terminal-compare should keep the legend comparison case wired through the shared layout flow'
);
assert.doesNotMatch(
    compareHtml,
    /id:\s*'effect-scatter'|title:\s*'Effect Scatter'/,
    'terminal-compare should not keep a dedicated Effect Scatter example once it matches scatter in terminal output'
);

console.log(JSON.stringify({
    ok: true,
    hasLegendCase: true
}));
