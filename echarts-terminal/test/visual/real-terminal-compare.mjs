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
const terminalDir = path.join(visualDir, 'terminal-app');
const iterm2Dir = path.join(visualDir, 'iterm2');
const terminalArtifactDir = path.join(artifactsDir, 'terminal-app');
const iterm2ArtifactDir = path.join(artifactsDir, 'iterm2');
const terminalAlignedDir = path.join(artifactsDir, 'terminal-aligned');
const iterm2AlignedDir = path.join(artifactsDir, 'iterm2-aligned');
const diffDir = path.join(artifactsDir, 'diff');
const reportPath = path.join(artifactsDir, 'report.html');
const ACTIVE_THRESHOLD = 22;
const BLACK_THRESHOLD = 14;
const CHROME_SCAN_BLACK_RATIO = 0.88;
const CONTENT_PADDING = 12;

async function ensureCleanDir(dir) {
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.mkdir(dir, { recursive: true });
}

function padPng(png, width, height) {
    if (png.width === width && png.height === height) {
        return png;
    }
    const next = new PNG({ width, height });
    PNG.bitblt(png, next, 0, 0, png.width, png.height, 0, 0);
    return next;
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

async function compareImages(terminalPath, iterm2Path, terminalAlignedPath, iterm2AlignedPath, diffPath) {
    const terminalImage = PNG.sync.read(await fsp.readFile(terminalPath));
    const iterm2Image = PNG.sync.read(await fsp.readFile(iterm2Path));
    const terminalContent = extractChartContent(terminalImage);
    const iterm2Content = extractChartContent(iterm2Image);
    const width = Math.max(terminalContent.png.width, iterm2Content.png.width);
    const height = Math.max(terminalContent.png.height, iterm2Content.png.height);
    const terminalAligned = resizeContainNearest(terminalContent.png, width, height);
    const iterm2Aligned = resizeContainNearest(iterm2Content.png, width, height);
    await fsp.writeFile(terminalAlignedPath, PNG.sync.write(terminalAligned));
    await fsp.writeFile(iterm2AlignedPath, PNG.sync.write(iterm2Aligned));
    const diffImage = new PNG({ width, height });
    const diffPixels = pixelmatch(
        terminalAligned.data,
        iterm2Aligned.data,
        diffImage.data,
        width,
        height,
        { threshold: 0.1 }
    );
    await fsp.writeFile(diffPath, PNG.sync.write(diffImage));
    return {
        diffPixels,
        terminalWidth: terminalImage.width,
        terminalHeight: terminalImage.height,
        iterm2Width: iterm2Image.width,
        iterm2Height: iterm2Image.height,
        terminalCropWidth: terminalContent.png.width,
        terminalCropHeight: terminalContent.png.height,
        iterm2CropWidth: iterm2Content.png.width,
        iterm2CropHeight: iterm2Content.png.height,
        terminalTopInset: terminalContent.topInset,
        iterm2TopInset: iterm2Content.topInset,
        alignedWidth: width,
        alignedHeight: height
    };
}

async function collectIds(dir) {
    const existing = await fsp.readdir(dir).catch(() => []);
    return existing
        .filter(name => name.endsWith('.png'))
        .map(name => path.basename(name, '.png'))
        .sort();
}

function renderReport(results) {
    const cards = results.map(result => {
        const status = result.missingTerminal || result.missingITerm2
            ? 'missing'
            : result.diffPixels > 0
                ? 'changed'
                : 'clean';
        const details = result.missingTerminal || result.missingITerm2
            ? `missing | terminal=${!result.missingTerminal} iTerm2=${!result.missingITerm2}`
            : `changed=${result.diffPixels > 0} | diffPixels=${result.diffPixels} | terminal=${result.terminalWidth}x${result.terminalHeight} -> ${result.terminalCropWidth}x${result.terminalCropHeight} | iTerm2=${result.iterm2Width}x${result.iterm2Height} -> ${result.iterm2CropWidth}x${result.iterm2CropHeight} | aligned=${result.alignedWidth}x${result.alignedHeight}`;
        return `
            <section class="card ${status}">
                <h2>${result.id}</h2>
                <p>${details}</p>
                <div class="raw-grid">
                    <figure><figcaption>Terminal.app</figcaption>${result.missingTerminal ? '<div class="empty">missing</div>' : `<img src="./terminal-app/${result.id}.png" />`}</figure>
                    <figure><figcaption>iTerm2</figcaption>${result.missingITerm2 ? '<div class="empty">missing</div>' : `<img src="./iterm2/${result.id}.png" />`}</figure>
                </div>
                <div class="aligned-grid">
                    <figure><figcaption>Terminal.app aligned</figcaption>${result.missingTerminal ? '<div class="empty">n/a</div>' : `<img src="./terminal-aligned/${result.id}.png" />`}</figure>
                    <figure><figcaption>iTerm2 aligned</figcaption>${result.missingITerm2 ? '<div class="empty">n/a</div>' : `<img src="./iterm2-aligned/${result.id}.png" />`}</figure>
                    <figure><figcaption>Diff</figcaption>${result.missingTerminal || result.missingITerm2 ? '<div class="empty">n/a</div>' : `<img src="./diff/${result.id}.png" />`}</figure>
                </div>
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
    .card { margin: 20px 0; padding: 16px; border-radius: 12px; background: #111827; border: 1px solid #334155; }
    .card.changed { border-color: #f59e0b; }
    .card.missing { border-color: #ef4444; }
    .raw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .aligned-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    figure { margin: 0; }
    figcaption { margin-bottom: 6px; color: #94a3b8; font-size: 12px; }
    img { width: 100%; border-radius: 8px; background: #000; border: 1px solid #475569; }
    .empty { display: grid; place-items: center; min-height: 180px; border-radius: 8px; background: #0b1220; border: 1px dashed #475569; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>echarts-terminal real terminal compare</h1>
  <p>Comparing real Terminal.app captures against real iTerm2 captures after removing window chrome, extracting chart content, and aligning the cropped chart region.</p>
  ${cards}
</body>
</html>`;
}

await ensureCleanDir(artifactsDir);
await fsp.mkdir(terminalArtifactDir, { recursive: true });
await fsp.mkdir(iterm2ArtifactDir, { recursive: true });
await fsp.mkdir(terminalAlignedDir, { recursive: true });
await fsp.mkdir(iterm2AlignedDir, { recursive: true });
await fsp.mkdir(diffDir, { recursive: true });

const ids = Array.from(new Set([
    ...await collectIds(terminalDir),
    ...await collectIds(iterm2Dir)
])).sort();

const results = [];
let hasMissing = false;
for (const id of ids) {
    const terminalPath = path.join(terminalDir, `${id}.png`);
    const iterm2Path = path.join(iterm2Dir, `${id}.png`);
    const terminalAlignedPath = path.join(terminalAlignedDir, `${id}.png`);
    const iterm2AlignedPath = path.join(iterm2AlignedDir, `${id}.png`);
    const diffPath = path.join(diffDir, `${id}.png`);
    const terminalExists = fs.existsSync(terminalPath);
    const iterm2Exists = fs.existsSync(iterm2Path);

    if (terminalExists) {
        await fsp.copyFile(terminalPath, path.join(terminalArtifactDir, `${id}.png`));
    }
    if (iterm2Exists) {
        await fsp.copyFile(iterm2Path, path.join(iterm2ArtifactDir, `${id}.png`));
    }

    if (!terminalExists || !iterm2Exists) {
        hasMissing = true;
        results.push({
            id,
            missingTerminal: !terminalExists,
            missingITerm2: !iterm2Exists
        });
        continue;
    }

    results.push({
        id,
        missingTerminal: false,
        missingITerm2: false,
        ...await compareImages(terminalPath, iterm2Path, terminalAlignedPath, iterm2AlignedPath, diffPath)
    });
}

await fsp.writeFile(reportPath, renderReport(results));

const changed = results.filter(result => !result.missingTerminal && !result.missingITerm2 && result.diffPixels > 0);
console.log(`Compared ${results.length} real terminal targets.`);
console.log(`Changed targets: ${changed.length}`);
console.log(`Report: ${reportPath}`);

if (hasMissing) {
    process.exitCode = 1;
}
