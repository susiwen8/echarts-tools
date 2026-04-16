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
const capturePath = fileURLToPath(new URL('../visual/ghostty-capture.mjs', import.meta.url));
const corePath = fileURLToPath(new URL('../visual/real-terminal-capture-core.mjs', import.meta.url));
const captureScript = fs.existsSync(capturePath) ? fs.readFileSync(capturePath, 'utf8') : '';
const coreScript = fs.existsSync(corePath) ? fs.readFileSync(corePath, 'utf8') : '';
const combinedScript = `${captureScript}\n${coreScript}`;

assert.equal(
    packageJson.scripts['visual:update:ghostty'],
    'npm run build && node test/visual/ghostty-capture.mjs update',
    'package.json should expose a Ghostty snapshot update script'
);
assert.match(
    captureScript,
    /Ghostty/,
    'Ghostty capture script should drive Ghostty through automation'
);
assert.match(
    combinedScript,
    /osascript/,
    'Ghostty capture script should invoke osascript'
);
assert.match(
    combinedScript,
    /screencapture/,
    'Ghostty capture script should capture the real window pixels with screencapture'
);
assert.match(
    captureScript,
    /readmeDir:\s*'readme'/,
    'Ghostty capture script should sync exported images into the canonical docs/readme directory'
);
assert.match(
    combinedScript,
    /afterAll/,
    'Ghostty capture flow should support end-of-run cleanup for leftover windows or processes'
);

console.log(JSON.stringify({
    ok: true,
    script: 'visual:update:ghostty'
}));
