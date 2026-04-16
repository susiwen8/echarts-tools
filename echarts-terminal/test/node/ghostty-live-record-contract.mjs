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
const scriptPath = fileURLToPath(new URL('../visual/ghostty-live-record.mjs', import.meta.url));
const scriptText = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';

assert.equal(
    packageJson.scripts['showcase:record:ghostty'],
    'npm run build && node test/visual/ghostty-live-record.mjs',
    'package.json should expose a Ghostty live recording command'
);
assert.match(
    scriptText,
    /Ghostty/,
    'Ghostty live recording script should launch Ghostty'
);
assert.match(
    scriptText,
    /ScreenCaptureKit|record-window\.swift|swift/,
    'Ghostty live recording script should use the native window recorder'
);
assert.match(
    scriptText,
    /terminal-live\.mjs/,
    'Ghostty live recording script should run the existing live showcase'
);
assert.match(
    scriptText,
    /record-window\.swift/,
    'Ghostty live recording script should capture a real Ghostty window instead of stitching image frames'
);

console.log(JSON.stringify({
    ok: true,
    script: 'showcase:record:ghostty'
}));
