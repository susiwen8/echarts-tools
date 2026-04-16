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

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoDir = path.resolve(packageDir, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const workflowPath = path.join(repoDir, '.github', 'workflows', 'publish-echarts-terminal.yml');
const workflowText = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';

assert.equal(
    packageJson.repository?.url,
    'git+https://github.com/susiwen8/echarts-tools.git',
    'package.json should expose the GitHub repository URL required by npm provenance and future trusted publishing'
);
assert.equal(
    packageJson.repository?.directory,
    'echarts-terminal',
    'package.json should point repository.directory at the echarts-terminal package'
);
assert.ok(fs.existsSync(workflowPath), 'the GitHub Actions npm publish workflow should exist');
assert.match(
    workflowText,
    /publish-echarts-terminal/i,
    'the publish workflow should use a stable echarts-terminal specific filename and job context'
);
assert.match(
    workflowText,
    /echarts-terminal-v\*/,
    'the publish workflow should trigger only for echarts-terminal release tags'
);
assert.match(
    workflowText,
    /id-token:\s*write/,
    'the publish workflow should request OIDC permissions for npm provenance generation'
);
assert.match(
    workflowText,
    /working-directory:\s*echarts-terminal/,
    'the publish workflow should run inside the echarts-terminal package directory'
);
assert.match(
    workflowText,
    /registry-url:\s*['"]https:\/\/registry\.npmjs\.org['"]/,
    'the publish workflow should publish to the npm registry'
);
assert.match(
    workflowText,
    /npm run smoke:contract/,
    'the publish workflow should verify the smoke contract suite before publishing'
);
assert.match(
    workflowText,
    /node test\/node\/npm-publish-contract\.mjs/,
    'the publish workflow should verify the dedicated npm publish contract before publishing'
);
assert.match(
    workflowText,
    /npm publish --provenance --access public/,
    'the publish workflow should publish with provenance enabled'
);
assert.match(
    workflowText,
    /npm pack --dry-run/,
    'the publish workflow should verify the npm package contents before publishing'
);
assert.match(
    workflowText,
    /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/,
    'the publish workflow should authenticate against npm with the NPM_TOKEN secret'
);
assert.match(
    workflowText,
    /GITHUB_REF_NAME#echarts-terminal-v/,
    'the publish workflow should verify the tag version prefix against package.json'
);

console.log(JSON.stringify({
    ok: true,
    workflow: path.relative(repoDir, workflowPath)
}));
