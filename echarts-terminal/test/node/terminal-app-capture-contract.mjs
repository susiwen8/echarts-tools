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
const capturePath = fileURLToPath(new URL('../visual/terminal-app-capture.mjs', import.meta.url));
const corePath = fileURLToPath(new URL('../visual/real-terminal-capture-core.mjs', import.meta.url));
const captureScript = fs.existsSync(capturePath) ? fs.readFileSync(capturePath, 'utf8') : '';
const coreScript = fs.existsSync(corePath) ? fs.readFileSync(corePath, 'utf8') : '';
const combinedScript = `${captureScript}\n${coreScript}`;

assert.equal(
    packageJson.scripts['visual:update:tty'],
    'npm run build && node test/visual/terminal-app-capture.mjs update',
    'package.json should expose a Terminal.app snapshot update script'
);
assert.match(
    captureScript,
    /Terminal/,
    'Terminal.app capture script should drive Terminal via AppleScript'
);
assert.match(
    combinedScript,
    /osascript/,
    'Terminal.app capture script should invoke osascript'
);
assert.match(
    combinedScript,
    /screencapture/,
    'Terminal.app capture script should capture the real window pixels with screencapture'
);
assert.doesNotMatch(
    captureScript,
    /readme-terminal-app/,
    'Terminal.app capture script should not sync docs screenshots directly'
);
assert.match(
    captureScript,
    /number of columns of/,
    'Terminal.app capture script should read the live tab width so it can converge to a tight 72x22 capture window'
);
assert.match(
    captureScript,
    /number of rows of/,
    'Terminal.app capture script should read the live tab height so it can converge to a tight 72x22 capture window'
);
assert.match(
    combinedScript,
    /afterAll/,
    'Terminal.app capture flow should support end-of-run cleanup for leftover windows'
);

console.log(JSON.stringify({
    ok: true,
    script: 'visual:update:tty'
}));
