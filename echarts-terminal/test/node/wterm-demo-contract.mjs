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
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const demoDir = path.join(rootDir, 'demo', 'wterm-react');
const demoPackagePath = path.join(demoDir, 'package.json');
const appPath = path.join(demoDir, 'src', 'App.tsx');
const inputAdapterPath = path.join(demoDir, 'src', 'bridge', 'WTermInputAdapter.ts');
const hookPath = path.join(demoDir, 'src', 'bridge', 'useEchartsTerminalWTerm.ts');

assert.equal(
    packageJson.scripts['demo:wterm:dev'],
    'npm run build && npm --prefix demo/wterm-react run dev',
    'package.json should expose a root script for starting the wterm React demo'
);
assert.equal(
    packageJson.scripts['demo:wterm:build'],
    'npm run build && npm --prefix demo/wterm-react run build',
    'package.json should expose a root script for building the wterm React demo'
);
assert.ok(fs.existsSync(demoPackagePath), 'the wterm React demo package should exist');

const demoPackage = JSON.parse(fs.readFileSync(demoPackagePath, 'utf8'));
assert.ok(demoPackage.dependencies.react, 'the demo should depend on react');
assert.ok(demoPackage.dependencies['@wterm/react'], 'the demo should depend on @wterm/react');
assert.ok(demoPackage.devDependencies.vite, 'the demo should depend on vite');

const appText = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const inputAdapterText = fs.existsSync(inputAdapterPath) ? fs.readFileSync(inputAdapterPath, 'utf8') : '';
const hookText = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf8') : '';

assert.match(appText, /<Terminal/, 'the demo app should render wterm');
assert.match(appText, /onData=/, 'the demo app should forward terminal input into the bridge');
assert.match(inputAdapterText, /class WTermInputAdapter/, 'the bridge should define a reusable wterm input adapter');
assert.match(inputAdapterText, /emit\(/, 'the input adapter should expose an emit method for browser terminal input');
assert.match(hookText, /createTerminalPlayer|chart\.createTerminalPlayer/, 'the bridge hook should reuse the terminal player');
assert.match(hookText, /resize\(/, 'the bridge hook should synchronize terminal and chart resizing');

console.log(JSON.stringify({
    ok: true,
    script: 'demo:wterm:dev'
}));
