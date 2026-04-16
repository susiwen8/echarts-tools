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

const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url));
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const comparePath = fileURLToPath(new URL('../visual/real-terminal-compare.mjs', import.meta.url));
const compareScript = fs.existsSync(comparePath) ? fs.readFileSync(comparePath, 'utf8') : '';

assert.equal(
    packageJson.scripts['visual:compare:real'],
    'node test/visual/real-terminal-compare.mjs',
    'package.json should expose a real-terminal comparison report command'
);
assert.equal(
    packageJson.scripts['visual:update:real-baseline'],
    'node test/visual/real-terminal-baseline-update.mjs',
    'package.json should expose an explicit real-terminal baseline update command'
);
assert.match(
    compareScript,
    /terminal-app/,
    'real-terminal comparison should read Terminal.app captures'
);
assert.match(
    compareScript,
    /iterm2/,
    'real-terminal comparison should read iTerm2 captures'
);
assert.match(
    compareScript,
    /ghostty/,
    'real-terminal comparison should read Ghostty captures'
);
assert.match(
    compareScript,
    /pixelmatch/,
    'real-terminal comparison should produce per-image diffs'
);
assert.match(
    compareScript,
    /real-terminal-compare-latest/,
    'real-terminal comparison should write artifacts to a dedicated report directory'
);
assert.match(
    compareScript,
    /baseline-terminal-app/,
    'real-terminal comparison should read the Terminal.app baseline directory'
);
assert.match(
    compareScript,
    /baseline-iterm2/,
    'real-terminal comparison should read the iTerm2 baseline directory'
);
assert.match(
    compareScript,
    /baseline-ghostty/,
    'real-terminal comparison should read the Ghostty baseline directory'
);
assert.match(
    compareScript,
    /latest aligned/,
    'real-terminal comparison report should render the latest aligned screenshots'
);
assert.match(
    compareScript,
    /baseline aligned/,
    'real-terminal comparison report should render the baseline aligned screenshots'
);
assert.match(
    compareScript,
    /vs baseline/,
    'real-terminal comparison should diff latest screenshots against baseline screenshots'
);

console.log(JSON.stringify({
    ok: true,
    script: 'visual:compare:real'
}));
