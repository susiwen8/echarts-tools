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
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const visualDir = path.dirname(fileURLToPath(import.meta.url));
const terminals = [
    ['terminal-app', 'baseline-terminal-app'],
    ['iterm2', 'baseline-iterm2'],
    ['ghostty', 'baseline-ghostty']
];

for (const [latestDirName, baselineDirName] of terminals) {
    const latestDir = path.join(visualDir, latestDirName);
    const baselineDir = path.join(visualDir, baselineDirName);
    await fs.rm(baselineDir, { recursive: true, force: true });
    await fs.mkdir(baselineDir, { recursive: true });
    const entries = await fs.readdir(latestDir).catch(() => []);
    for (const entry of entries) {
        if (!entry.endsWith('.png')) {
            continue;
        }
        await fs.copyFile(path.join(latestDir, entry), path.join(baselineDir, entry));
    }
}

console.log('Updated terminal-app / iterm2 / ghostty baselines from latest screenshot folders.');
