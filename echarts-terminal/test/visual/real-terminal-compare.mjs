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
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const visualDir = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.join(visualDir, 'artifacts', 'real-terminal-compare-latest');
const terminals = [
    {
        id: 'terminal-app',
        label: 'Terminal.app',
        latestDir: path.join(visualDir, 'terminal-app'),
        baselineDir: path.join(visualDir, 'baseline-terminal-app')
    },
    {
        id: 'iterm2',
        label: 'iTerm2',
        latestDir: path.join(visualDir, 'iterm2'),
        baselineDir: path.join(visualDir, 'baseline-iterm2')
    },
    {
        id: 'ghostty',
        label: 'Ghostty',
        latestDir: path.join(visualDir, 'ghostty'),
        baselineDir: path.join(visualDir, 'baseline-ghostty')
    }
];
const ACTIVE_THRESHOLD = 22;
const BLACK_THRESHOLD = 14;
const CHROME_SCAN_BLACK_RATIO = 0.88;
const CONTENT_PADDING = 12;

function getArtifactDir(name) {
    return path.join(artifactsDir, name);
}

async function ensureCleanDir(dir) {
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.mkdir(dir, { recursive: true });
}

function readPixel(png, x, y) {
    const idx = (png.width * y + x) * 4;
    return {
        r: png.data[idx],
        g: png.data[idx + 1],
        b: png.data[idx + 2],
        a: png.data[idx + 3]
    };
}

function isNearBlack(pixel, threshold = BLACK_THRESHOLD) {
    return pixel.a > 0
        && pixel.r <= threshold
        && pixel.g <= threshold
        && pixel.b <= threshold;
}

function isActivePixel(pixel, threshold = ACTIVE_THRESHOLD) {
    return pixel.a > 0
        && (pixel.r > threshold || pixel.g > threshold || pixel.b > threshold);
}

function rowBlackRatio(png, row) {
    let black = 0;
    for (let x = 0; x < png.width; x++) {
        if (isNearBlack(readPixel(png, x, row))) {
            black++;
        }
    }
    return png.width > 0 ? black / png.width : 0;
}

function findContentTop(png) {
    for (let y = 0; y < png.height; y++) {
        if (rowBlackRatio(png, y) >= CHROME_SCAN_BLACK_RATIO) {
            return y;
        }
    }
    return 0;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function cropPng(png, bounds) {
    const next = new PNG({ width: bounds.width, height: bounds.height });
    PNG.bitblt(png, next, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0);
    return next;
}

function findActiveBounds(png) {
    let minX = png.width;
    let minY = png.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
            if (!isActivePixel(readPixel(png, x, y))) {
                continue;
            }
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return { x: 0, y: 0, width: png.width, height: png.height };
    }

    const x = clamp(minX - CONTENT_PADDING, 0, png.width - 1);
    const y = clamp(minY - CONTENT_PADDING, 0, png.height - 1);
    const maxClampedX = clamp(maxX + CONTENT_PADDING, 0, png.width - 1);
    const maxClampedY = clamp(maxY + CONTENT_PADDING, 0, png.height - 1);
    return {
        x,
        y,
        width: maxClampedX - x + 1,
        height: maxClampedY - y + 1
    };
}

function extractChartContent(png) {
    const contentTop = findContentTop(png);
    const noChrome = cropPng(png, {
        x: 0,
        y: contentTop,
        width: png.width,
        height: Math.max(1, png.height - contentTop)
    });
    return {
        topInset: contentTop,
        png: cropPng(noChrome, findActiveBounds(noChrome))
    };
}

function resizeContainNearest(png, width, height) {
    if (png.width === width && png.height === height) {
        return png;
    }
    const scale = Math.min(width / png.width, height / png.height);
    const scaledWidth = Math.max(1, Math.round(png.width * scale));
    const scaledHeight = Math.max(1, Math.round(png.height * scale));
    const offsetX = Math.floor((width - scaledWidth) / 2);
    const offsetY = Math.floor((height - scaledHeight) / 2);
    const next = new PNG({ width, height });

    for (let y = 0; y < scaledHeight; y++) {
        const sourceY = Math.min(png.height - 1, Math.floor(y / scale));
        for (let x = 0; x < scaledWidth; x++) {
            const sourceX = Math.min(png.width - 1, Math.floor(x / scale));
            const sourceIdx = (png.width * sourceY + sourceX) * 4;
            const targetIdx = (width * (offsetY + y) + (offsetX + x)) * 4;
            next.data[targetIdx] = png.data[sourceIdx];
            next.data[targetIdx + 1] = png.data[sourceIdx + 1];
            next.data[targetIdx + 2] = png.data[sourceIdx + 2];
            next.data[targetIdx + 3] = png.data[sourceIdx + 3];
        }
    }

    return next;
}

async function collectIds(dir) {
    const existing = await fsp.readdir(dir).catch(() => []);
    return existing
        .filter(name => name.endsWith('.png'))
        .map(name => path.basename(name, '.png'))
        .sort();
}

async function comparePair(leftPng, rightPng, diffPath) {
    const diffImage = new PNG({ width: leftPng.width, height: leftPng.height });
    const diffPixels = pixelmatch(
        leftPng.data,
        rightPng.data,
        diffImage.data,
        leftPng.width,
        leftPng.height,
        { threshold: 0.1 }
    );
    await fsp.writeFile(diffPath, PNG.sync.write(diffImage));
    return diffPixels;
}

function padCenterPng(png, width, height) {
    if (png.width === width && png.height === height) {
        return png;
    }
    const next = new PNG({ width, height });
    const offsetX = Math.floor((width - png.width) / 2);
    const offsetY = Math.floor((height - png.height) / 2);
    PNG.bitblt(png, next, 0, 0, png.width, png.height, offsetX, offsetY);
    return next;
}

async function comparePreparedImages(latestPath, baselinePath, latestAlignedPath, baselineAlignedPath, diffPath) {
    const latestImage = PNG.sync.read(await fsp.readFile(latestPath));
    const baselineImage = PNG.sync.read(await fsp.readFile(baselinePath));
    const latestContent = extractChartContent(latestImage);
    const baselineContent = extractChartContent(baselineImage);
    const width = Math.max(latestContent.png.width, baselineContent.png.width);
    const height = Math.max(latestContent.png.height, baselineContent.png.height);
    const latestAligned = padCenterPng(resizeContainNearest(latestContent.png, width, height), width, height);
    const baselineAligned = padCenterPng(resizeContainNearest(baselineContent.png, width, height), width, height);
    await fsp.writeFile(latestAlignedPath, PNG.sync.write(latestAligned));
    await fsp.writeFile(baselineAlignedPath, PNG.sync.write(baselineAligned));
    return {
        diffPixels: await comparePair(latestAligned, baselineAligned, diffPath),
        latestWidth: latestImage.width,
        latestHeight: latestImage.height,
        baselineWidth: baselineImage.width,
        baselineHeight: baselineImage.height,
        latestCropWidth: latestContent.png.width,
        latestCropHeight: latestContent.png.height,
        baselineCropWidth: baselineContent.png.width,
        baselineCropHeight: baselineContent.png.height,
        latestTopInset: latestContent.topInset,
        baselineTopInset: baselineContent.topInset,
        alignedWidth: width,
        alignedHeight: height
    };
}

function renderSummary(results) {
    const total = results.length;
    const perTerminal = terminals.map(terminal => {
        const comparable = results.filter(result => !result.terminals[terminal.id].missing).length;
        const changed = results.filter(result => !result.terminals[terminal.id].missing && result.terminals[terminal.id].diffPixels > 0).length;
        return `<li><strong>${terminal.label}</strong>: ${changed}/${comparable} targets changed</li>`;
    }).join('');
    return `
        <section class="summary">
            <p>Targets: ${total}</p>
            <ul>${perTerminal}</ul>
        </section>
    `;
}

function renderReport(results) {
    const cards = results.map(result => {
        const latestFigures = terminals.map(terminal => {
            const data = result.terminals[terminal.id];
            return `<figure><figcaption>${terminal.label} latest aligned</figcaption>${data.missing ? '<div class="empty">missing</div>' : `<img src="./${terminal.id}-latest-aligned/${result.id}.png" />`}</figure>`;
        }).join('');
        const baselineFigures = terminals.map(terminal => {
            const data = result.terminals[terminal.id];
            return `<figure><figcaption>${terminal.label} baseline aligned</figcaption>${data.missing ? '<div class="empty">missing</div>' : `<img src="./${terminal.id}-baseline-aligned/${result.id}.png" />`}</figure>`;
        }).join('');
        const diffFigures = terminals.map(terminal => {
            const data = result.terminals[terminal.id];
            return `<figure><figcaption>${terminal.label} vs baseline</figcaption>${data.missing ? '<div class="empty">missing</div>' : `<img src="./diff-${terminal.id}/${result.id}.png" />`}</figure>`;
        }).join('');
        const detailLine = terminals.map(terminal => {
            const data = result.terminals[terminal.id];
            return data.missing
                ? `${terminal.label}=missing`
                : `${terminal.label}: latest=${data.latestWidth}x${data.latestHeight}->${data.latestCropWidth}x${data.latestCropHeight}, baseline=${data.baselineWidth}x${data.baselineHeight}->${data.baselineCropWidth}x${data.baselineCropHeight}, diff=${data.diffPixels}`;
        }).join(' | ');
        const status = Object.values(result.terminals).some(item => item.missing)
            ? 'missing'
            : Object.values(result.terminals).some(item => item.diffPixels > 0)
                ? 'changed'
                : 'clean';
        return `
            <section class="card ${status}">
                <h2>${result.id}</h2>
                <p>${detailLine}</p>
                <div class="latest-grid">${latestFigures}</div>
                <div class="baseline-grid">${baselineFigures}</div>
                <div class="diff-grid">${diffFigures}</div>
            </section>
        `;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>echarts-terminal real terminal compare</title>
  <style>
    body { margin: 24px; font-family: ui-sans-serif, system-ui; background: #0f172a; color: #e5e7eb; }
    .summary { margin: 20px 0; padding: 16px; border-radius: 12px; background: #111827; border: 1px solid #334155; }
    .summary ul { margin: 12px 0 0; padding-left: 18px; color: #cbd5e1; }
    .card { margin: 20px 0; padding: 16px; border-radius: 12px; background: #111827; border: 1px solid #334155; }
    .card.changed { border-color: #f59e0b; }
    .card.missing { border-color: #ef4444; }
    .latest-grid, .baseline-grid, .diff-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
    figure { margin: 0; }
    figcaption { margin-bottom: 6px; color: #94a3b8; font-size: 12px; }
    img { width: 100%; border-radius: 8px; background: #000; border: 1px solid #475569; }
    .empty { display: grid; place-items: center; min-height: 180px; border-radius: 8px; background: #0b1220; border: 1px dashed #475569; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>echarts-terminal real terminal compare</h1>
  <p>Comparing each terminal's latest screenshot folder against its dedicated baseline folder.</p>
  ${renderSummary(results)}
  ${cards}
</body>
</html>`;
}

await ensureCleanDir(artifactsDir);
for (const terminal of terminals) {
    await fsp.mkdir(getArtifactDir(terminal.id), { recursive: true });
    await fsp.mkdir(getArtifactDir(`${terminal.id}-latest-aligned`), { recursive: true });
    await fsp.mkdir(getArtifactDir(`${terminal.id}-baseline-aligned`), { recursive: true });
    await fsp.mkdir(getArtifactDir(`diff-${terminal.id}`), { recursive: true });
}

const ids = Array.from(new Set((await Promise.all([
    ...terminals.map(terminal => collectIds(terminal.latestDir)),
    ...terminals.map(terminal => collectIds(terminal.baselineDir))
])).flat())).sort();

const results = [];
let hasMissing = false;

for (const id of ids) {
    const perTerminal = {};
    for (const terminal of terminals) {
        const latestPath = path.join(terminal.latestDir, `${id}.png`);
        const baselinePath = path.join(terminal.baselineDir, `${id}.png`);
        const latestExists = fs.existsSync(latestPath);
        const baselineExists = fs.existsSync(baselinePath);
        if (latestExists) {
            await fsp.copyFile(latestPath, path.join(getArtifactDir(terminal.id), `${id}.png`));
        }
        if (!latestExists || !baselineExists) {
            hasMissing = true;
            perTerminal[terminal.id] = { missing: true, diffPixels: -1 };
            continue;
        }
        perTerminal[terminal.id] = {
            missing: false,
            ...await comparePreparedImages(
                latestPath,
                baselinePath,
                path.join(getArtifactDir(`${terminal.id}-latest-aligned`), `${id}.png`),
                path.join(getArtifactDir(`${terminal.id}-baseline-aligned`), `${id}.png`),
                path.join(getArtifactDir(`diff-${terminal.id}`), `${id}.png`)
            )
        };
    }
    results.push({ id, terminals: perTerminal });
}

await fsp.writeFile(path.join(artifactsDir, 'report.html'), renderReport(results));

const summary = terminals.map(terminal => {
    const comparable = results.filter(result => !result.terminals[terminal.id].missing).length;
    const changed = results.filter(result => !result.terminals[terminal.id].missing && result.terminals[terminal.id].diffPixels > 0).length;
    return `${terminal.label}: ${changed}/${comparable}`;
});
console.log(`Compared ${results.length} targets.`);
console.log(`Changed targets: ${summary.join(' | ')}`);
console.log(`Report: ${path.join(artifactsDir, 'report.html')}`);

if (hasMissing) {
    process.exitCode = 1;
}
