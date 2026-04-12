import * as vector from 'zrender/lib/core/vector.js';
import { cubicAt, quadraticAt } from 'zrender/lib/core/curve.js';
import PathProxy from 'zrender/lib/core/PathProxy.js';
import { contain as polygonContain } from 'zrender/lib/contain/polygon.js';
import Path from 'zrender/lib/graphic/Path.js';
import { pathToPolygons } from 'zrender/lib/tool/convertPath.js';
import TerminalCellBuffer from './TerminalCellBuffer.js';
import type { TerminalColor } from './terminalColor.js';

type Point = [number, number];
const CMD = PathProxy.CMD;

function transformPointWithScale(el: Path, x: number, y: number, scaleX: number, scaleY: number): Point {
    const transformed = [x, y] as Point;
    const matrix = el.getComputedTransform();
    if (matrix) {
        vector.applyTransform(transformed, transformed, matrix);
    }
    transformed[0] /= scaleX;
    transformed[1] /= scaleY;
    return transformed;
}

function toPoints(el: Path, polygon: number[], scaleX: number, scaleY: number): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < polygon.length; i += 2) {
        points.push(transformPointWithScale(el, polygon[i], polygon[i + 1], scaleX, scaleY));
    }
    return points;
}

function drawLineWithMode(
    buffer: TerminalCellBuffer,
    from: Point,
    to: Point,
    color: TerminalColor,
    mode: 'solid' | 'under'
) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        buffer.setPixel(from[0] + dx * t, from[1] + dy * t, color, mode !== 'under');
    }
}

function strokePolylineWithMode(
    buffer: TerminalCellBuffer,
    points: Point[],
    color: TerminalColor,
    mode: 'solid' | 'under'
) {
    for (let i = 1; i < points.length; i++) {
        drawLineWithMode(buffer, points[i - 1], points[i], color, mode);
    }
}

function sampleQuadraticPoints(from: Point, control: Point, to: Point) {
    const points: Point[] = [from];
    const steps = Math.max(
        8,
        Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) / 2)
    );
    for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        points.push([
            quadraticAt(from[0], control[0], to[0], t),
            quadraticAt(from[1], control[1], to[1], t)
        ]);
    }
    return points;
}

function sampleCubicPoints(from: Point, control1: Point, control2: Point, to: Point) {
    const points: Point[] = [from];
    const steps = Math.max(
        10,
        Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) / 2)
    );
    for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        points.push([
            cubicAt(from[0], control1[0], control2[0], to[0], t),
            cubicAt(from[1], control1[1], control2[1], to[1], t)
        ]);
    }
    return points;
}

function sampleArcPoints(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startAngle: number,
    delta: number,
    el: Path,
    scaleX: number,
    scaleY: number
) {
    const points: Point[] = [];
    const endAngle = startAngle + delta;
    const steps = Math.max(12, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
    for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const angle = startAngle + (endAngle - startAngle) * t;
        points.push(transformPointWithScale(
            el,
            cx + Math.cos(angle) * rx,
            cy + Math.sin(angle) * ry,
            scaleX,
            scaleY
        ));
    }
    return points;
}

function fillPolygonWithMode(
    buffer: TerminalCellBuffer,
    points: Point[],
    color: TerminalColor,
    mode: 'solid' | 'checker'
) {
    if (points.length < 3) {
        return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i][0]);
        maxX = Math.max(maxX, points[i][0]);
        minY = Math.min(minY, points[i][1]);
        maxY = Math.max(maxY, points[i][1]);
    }

    const startX = Math.max(0, Math.floor(minX));
    const endX = Math.min(buffer.width - 1, Math.ceil(maxX));
    const startY = Math.max(0, Math.floor(minY));
    const endY = Math.min(buffer.logicalHeight - 1, Math.ceil(maxY));

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (polygonContain(points, x + 0.5, y + 0.5)) {
                if (mode === 'checker' && (x + y) % 2 === 1) {
                    continue;
                }
                buffer.setPixel(x, y, color);
            }
        }
    }
}

function shouldFillPath(el: Path) {
    const path = el.getUpdatedPathProxy();
    const data = path.data;
    const len = path.len();
    for (let i = 0; i < len;) {
        const cmd = data[i++];
        switch (cmd) {
            case CMD.Z:
            case CMD.R:
                return true;
            case CMD.M:
            case CMD.L:
                i += 2;
                break;
            case CMD.C:
                i += 6;
                break;
            case CMD.Q:
                i += 4;
                break;
            case CMD.A:
                i += 8;
                break;
        }
    }
    return false;
}

function strokePath(
    buffer: TerminalCellBuffer,
    el: Path,
    color: TerminalColor,
    scaleX: number,
    scaleY: number,
    mode: 'solid' | 'under'
) {
    const path = el.getUpdatedPathProxy();
    const data = path.data;
    const len = path.len();

    let current = [0, 0] as Point;
    let subpathStart = [0, 0] as Point;

    for (let i = 0; i < len;) {
        const cmd = data[i++];
        switch (cmd) {
            case CMD.M: {
                current = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                subpathStart = current;
                break;
            }
            case CMD.L: {
                const to = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                drawLineWithMode(buffer, current, to, color, mode);
                current = to;
                break;
            }
            case CMD.C: {
                const c1 = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                const c2 = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                const to = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                strokePolylineWithMode(buffer, sampleCubicPoints(current, c1, c2, to), color, mode);
                current = to;
                break;
            }
            case CMD.Q: {
                const c = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                const to = transformPointWithScale(el, data[i++], data[i++], scaleX, scaleY);
                strokePolylineWithMode(buffer, sampleQuadraticPoints(current, c, to), color, mode);
                current = to;
                break;
            }
            case CMD.A: {
                const cx = data[i++];
                const cy = data[i++];
                const rx = data[i++];
                const ry = data[i++];
                const startAngle = data[i++];
                const delta = data[i++];
                i += 2;
                const points = sampleArcPoints(cx, cy, rx, ry, startAngle, delta, el, scaleX, scaleY);
                strokePolylineWithMode(buffer, points, color, mode);
                current = points[points.length - 1];
                break;
            }
            case CMD.R: {
                const x = data[i++];
                const y = data[i++];
                const w = data[i++];
                const h = data[i++];
                const points = [
                    transformPointWithScale(el, x, y, scaleX, scaleY),
                    transformPointWithScale(el, x + w, y, scaleX, scaleY),
                    transformPointWithScale(el, x + w, y + h, scaleX, scaleY),
                    transformPointWithScale(el, x, y + h, scaleX, scaleY),
                    transformPointWithScale(el, x, y, scaleX, scaleY)
                ];
                strokePolylineWithMode(buffer, points, color, mode);
                current = points[0];
                subpathStart = points[0];
                break;
            }
            case CMD.Z: {
                drawLineWithMode(buffer, current, subpathStart, color, mode);
                current = subpathStart;
                break;
            }
        }
    }
}

export function paintPath(
    buffer: TerminalCellBuffer,
    el: Path,
    fill: TerminalColor,
    stroke: TerminalColor,
    scaleX: number,
    scaleY: number,
    fillMode: 'solid' | 'checker' = 'solid',
    strokeMode: 'solid' | 'under' = 'solid'
) {
    if (fill && shouldFillPath(el)) {
        const polygons = pathToPolygons(el.getUpdatedPathProxy(), 1);
        for (let i = 0; i < polygons.length; i++) {
            const points = toPoints(el, polygons[i], scaleX, scaleY);
            fillPolygonWithMode(buffer, points, fill, fillMode);
        }
    }
    if (stroke) {
        strokePath(buffer, el, stroke, scaleX, scaleY, strokeMode);
    }
}
