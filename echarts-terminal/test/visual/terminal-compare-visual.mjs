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
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const mode = process.argv[2] === 'update' ? 'update' : 'test';
const visualDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(visualDir, '..', '..');
const baselineDir = path.join(visualDir, 'baseline');
const artifactsDir = path.join(visualDir, 'artifacts', 'latest');
const baselineArtifactsDir = path.join(artifactsDir, 'baseline');
const actualDir = path.join(artifactsDir, 'actual');
const diffDir = path.join(artifactsDir, 'diff');
const comparePagePath = '/test/terminal-compare.html';

function resolveChromePath() {
    const candidates = [
        process.env.CHROME_BIN,
        process.env.GOOGLE_CHROME_BIN,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
    return candidates.find(candidate => {
        try {
            return !!candidate && fs.existsSync(candidate);
        }
        catch {
            return false;
        }
    });
}

function getContentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.png')) return 'image/png';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
}

async function ensureCleanDir(dir) {
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.mkdir(dir, { recursive: true });
}

function startStaticServer(rootDir) {
    const server = http.createServer(async (req, res) => {
        const requestPath = new URL(req.url, 'http://127.0.0.1').pathname;
        const relativePath = requestPath === '/' ? 'test/terminal-compare.html' : requestPath.slice(1);
        const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(rootDir, safePath);

        try {
            const stat = await fsp.stat(filePath);
            if (stat.isDirectory()) {
                res.statusCode = 404;
                res.end('Not found');
                return;
            }
            res.setHeader('Content-Type', getContentType(filePath));
            res.end(await fsp.readFile(filePath));
        }
        catch {
            res.statusCode = 404;
            res.end('Not found');
        }
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({
                server,
                url: `http://127.0.0.1:${address.port}${comparePagePath}`
            });
        });
    });
}

function padPng(png, width, height) {
    if (png.width === width && png.height === height) {
        return png;
    }
    const next = new PNG({ width, height });
    PNG.bitblt(png, next, 0, 0, png.width, png.height, 0, 0);
    return next;
}

async function compareImages(baselinePath, actualPath, diffPath) {
    const baseline = PNG.sync.read(await fsp.readFile(baselinePath));
    const actual = PNG.sync.read(await fsp.readFile(actualPath));
    const width = Math.max(baseline.width, actual.width);
    const height = Math.max(baseline.height, actual.height);
    const baselineImage = padPng(baseline, width, height);
    const actualImage = padPng(actual, width, height);
    const diffImage = new PNG({ width, height });
    const diffPixels = pixelmatch(
        baselineImage.data,
        actualImage.data,
        diffImage.data,
        width,
        height,
        { threshold: 0.1 }
    );
    await fsp.writeFile(diffPath, PNG.sync.write(diffImage));
    return diffPixels;
}

function renderReport(results) {
    const cards = results.map(result => {
        const status = result.missingBaseline
            ? 'missing-baseline'
            : result.diffPixels > 0
                ? 'changed'
                : 'clean';
        return `
            <section class="card ${status}">
                <h2>${result.id}</h2>
                <p>${status} | diffPixels=${result.diffPixels}</p>
                <div class="grid">
                    <figure><figcaption>terminal baseline</figcaption><img src="./baseline/${result.id}.png" /></figure>
                    <figure><figcaption>terminal actual</figcaption><img src="./actual/${result.id}.png" /></figure>
                    <figure><figcaption>terminal diff</figcaption><img src="./diff/${result.id}.png" /></figure>
                </div>
            </section>
        `;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>echarts-terminal terminal visual diff</title>
  <style>
    body { margin: 24px; font-family: ui-sans-serif, system-ui; background: #0f172a; color: #e5e7eb; }
    .card { margin: 20px 0; padding: 16px; border-radius: 12px; background: #111827; border: 1px solid #334155; }
    .card.changed { border-color: #f59e0b; }
    .card.missing-baseline { border-color: #ef4444; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    figure { margin: 0; }
    figcaption { margin-bottom: 6px; color: #94a3b8; font-size: 12px; }
    img { width: 100%; border-radius: 8px; background: white; border: 1px solid #475569; }
  </style>
</head>
<body>
  <h1>echarts-terminal terminal-only visual diff</h1>
  <p>Mode: ${mode}. Report only compares terminal renderer snapshots.</p>
  ${cards}
</body>
</html>`;
}

async function collectTargets(page) {
    const ids = await page.locator('.compare-block[data-visual-id]').evaluateAll(
        nodes => nodes.map(node => node.getAttribute('data-visual-id')).filter(Boolean)
    );
    return ids;
}

async function captureTargets(page, targets) {
    const captures = [];
    for (const id of targets) {
        const filePath = path.join(actualDir, `${id}.png`);
        await page.locator(`.compare-block[data-visual-id="${id}"] [data-visual-panel="terminal"]`).screenshot({ path: filePath });
        captures.push({ id, filePath });
    }
    return captures;
}

async function removeStaleBaselines(currentIds) {
    await fsp.mkdir(baselineDir, { recursive: true });
    const existing = await fsp.readdir(baselineDir);
    await Promise.all(existing
        .filter(name => name.endsWith('.png') && !currentIds.has(path.basename(name, '.png')))
        .map(name => fsp.rm(path.join(baselineDir, name), { force: true })));
}

const chromePath = resolveChromePath();
if (!chromePath) {
    throw new Error('Unable to locate Chrome. Set CHROME_BIN to a valid executable path.');
}

await ensureCleanDir(artifactsDir);
await fsp.mkdir(baselineDir, { recursive: true });
await fsp.mkdir(baselineArtifactsDir, { recursive: true });
await fsp.mkdir(actualDir, { recursive: true });
await fsp.mkdir(diffDir, { recursive: true });

const { server, url } = await startStaticServer(pkgDir);
const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
});

try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 2200 },
        colorScheme: 'light'
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.compare-block[data-visual-id]');
    await page.addStyleTag({
        content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }'
    });

    const targets = await collectTargets(page);
    const targetIds = new Set(targets);
    const captures = await captureTargets(page, targets);

    if (mode === 'update') {
        await removeStaleBaselines(targetIds);
        await Promise.all(captures.map(async ({ id, filePath }) => {
            const baselinePath = path.join(baselineDir, `${id}.png`);
            await fsp.copyFile(filePath, baselinePath);
            await fsp.copyFile(filePath, path.join(baselineArtifactsDir, `${id}.png`));
            await fsp.copyFile(filePath, path.join(diffDir, `${id}.png`));
        }));
        await fsp.writeFile(
            path.join(artifactsDir, 'report.html'),
            renderReport(captures.map(({ id }) => ({ id, diffPixels: 0, missingBaseline: false })))
        );
        console.log(`Updated visual baselines for ${captures.length} targets.`);
        console.log(`Artifacts: ${path.join(artifactsDir, 'report.html')}`);
    }
    else {
        const results = [];
        let hasFailure = false;
        for (const { id, filePath } of captures) {
            const baselinePath = path.join(baselineDir, `${id}.png`);
            const baselineArtifactPath = path.join(baselineArtifactsDir, `${id}.png`);
            const diffPath = path.join(diffDir, `${id}.png`);
            const baselineExists = await fsp.stat(baselinePath).then(() => true).catch(() => false);
            if (!baselineExists) {
                hasFailure = true;
                await fsp.copyFile(filePath, diffPath);
                results.push({ id, diffPixels: -1, missingBaseline: true });
                continue;
            }

            await fsp.copyFile(baselinePath, baselineArtifactPath);
            const diffPixels = await compareImages(baselinePath, filePath, diffPath);
            if (diffPixels > 0) {
                hasFailure = true;
            }
            results.push({ id, diffPixels, missingBaseline: false });
        }

        await fsp.writeFile(path.join(artifactsDir, 'report.html'), renderReport(results));
        console.log(`Visual report: ${path.join(artifactsDir, 'report.html')}`);
        const changed = results.filter(item => item.missingBaseline || item.diffPixels > 0);
        const blocking = changed.filter(item => item.id !== 'full-page');
        if (changed.length) {
            console.log(`Changed targets: ${changed.map(item => item.id).join(', ')}`);
        }
        if (blocking.length) {
            process.exitCode = 1;
        }
        else {
            console.log(`All ${results.length} visual targets match baseline.`);
        }
    }
}
finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
}
