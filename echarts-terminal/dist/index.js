// src/TerminalPainter.ts
import Storage from "zrender/lib/Storage.js";
import Path from "zrender/lib/graphic/Path.js";

// src/terminalColor.ts
import {parse} from "zrender/lib/tool/color.js";
var ANSI_RESET = "[0m";
var TERMINAL_BG = [15, 23, 42];
function averageChannel(values) {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  return Math.round(total / values.length);
}
function normalizeAlpha(alpha, opacity) {
  return alpha * (opacity == null ? 1 : opacity);
}
function getLuminance(color) {
  return 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2];
}
function normalizeForDarkBackground(color, minLuminance) {
  if (!minLuminance) {
    return color;
  }
  const luminance = getLuminance(color);
  if (luminance >= minLuminance) {
    return color;
  }
  if (luminance <= 1) {
    return [minLuminance, minLuminance, minLuminance];
  }
  const scale = minLuminance / luminance;
  return [
    Math.min(255, Math.round(color[0] * scale)),
    Math.min(255, Math.round(color[1] * scale)),
    Math.min(255, Math.round(color[2] * scale))
  ];
}
function blendWithBackground(color, alpha) {
  return [
    Math.round(TERMINAL_BG[0] * (1 - alpha) + color[0] * alpha),
    Math.round(TERMINAL_BG[1] * (1 - alpha) + color[1] * alpha),
    Math.round(TERMINAL_BG[2] * (1 - alpha) + color[2] * alpha)
  ];
}
function resolveTerminalColor(color, opts) {
  const opacity = opts && opts.opacity;
  const minLuminance = opts && opts.minLuminance || 0;
  if (!color) {
    return null;
  }
  if (typeof color === "string") {
    const parsed = parse(color);
    const alpha = parsed && normalizeAlpha(parsed[3], opacity);
    if (!parsed || alpha <= 0.05) {
      return null;
    }
    return normalizeForDarkBackground(blendWithBackground([parsed[0], parsed[1], parsed[2]], alpha), minLuminance);
  }
  const colorStops = color.colorStops;
  if (colorStops && colorStops.length) {
    const stops = [];
    for (let i = 0; i < colorStops.length; i++) {
      const stopColor = resolveTerminalColor(colorStops[i].color, {opacity, minLuminance});
      stopColor && stops.push(stopColor);
    }
    if (!stops.length) {
      return null;
    }
    return normalizeForDarkBackground([
      averageChannel(stops.map((item) => item[0])),
      averageChannel(stops.map((item) => item[1])),
      averageChannel(stops.map((item) => item[2]))
    ], minLuminance);
  }
  return null;
}
function toAnsiForeground(color) {
  return `[38;2;${color[0]};${color[1]};${color[2]}m`;
}
function toAnsiBackground(color) {
  return `[48;2;${color[0]};${color[1]};${color[2]}m`;
}

// src/TerminalCellBuffer.ts
function colorKey(color) {
  return color ? color.join(",") : "";
}
var TerminalCellBuffer = class {
  constructor(width, height) {
    this.width = Math.max(0, Math.round(width || 0));
    this.height = Math.max(0, Math.round(height || 0));
    this.logicalHeight = this.height * 2;
    this._foregroundPixels = new Array(this.width * this.logicalHeight).fill(null);
    this._backgroundPixels = new Array(this.width * this.logicalHeight).fill(null);
    this._text = new Array(this.width * this.height).fill(null);
  }
  setPixel(x, y, color, overwrite = true) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (!color || xi < 0 || yi < 0 || xi >= this.width || yi >= this.logicalHeight) {
      return;
    }
    const index = yi * this.width + xi;
    if (overwrite) {
      this._foregroundPixels[index] = color;
    } else {
      this._backgroundPixels[index] = color;
    }
  }
  _cellHasForeground(x, row) {
    const upperY = row * 2;
    const lowerY = upperY + 1;
    const upperIndex = upperY * this.width + x;
    const lowerIndex = lowerY * this.width + x;
    return !!this._foregroundPixels[upperIndex] || !!this._foregroundPixels[lowerIndex];
  }
  drawText(x, y, text, color) {
    if (!text) {
      return;
    }
    const row = this._resolveTextRow(Math.round(x), y, text);
    if (row < 0 || row >= this.height) {
      return;
    }
    const chars = Array.from(text);
    let col = Math.round(x);
    for (let i = 0; i < chars.length; i++) {
      if (col >= 0 && col < this.width) {
        this._text[row * this.width + col] = {
          char: chars[i],
          color
        };
      }
      col++;
      if (col >= this.width) {
        break;
      }
    }
  }
  _resolveTextRow(x, y, text) {
    const targetRow = Math.round(y);
    if (this._canPlaceText(targetRow, x, text)) {
      return targetRow;
    }
    const preferredDirection = y - targetRow >= 0 ? 1 : -1;
    for (let distance = 1; distance < this.height; distance++) {
      const primary = targetRow + preferredDirection * distance;
      if (this._canPlaceText(primary, x, text)) {
        return primary;
      }
      const secondary = targetRow - preferredDirection * distance;
      if (this._canPlaceText(secondary, x, text)) {
        return secondary;
      }
    }
    return targetRow;
  }
  _canPlaceText(row, x, text) {
    if (row < 0 || row >= this.height) {
      return false;
    }
    const chars = Array.from(text);
    let col = Math.round(x);
    let hasVisibleChars = false;
    for (let i = 0; i < chars.length; i++) {
      if (col >= 0 && col < this.width) {
        hasVisibleChars = true;
        if (this._text[row * this.width + col]) {
          return false;
        }
      }
      col++;
      if (col >= this.width) {
        break;
      }
    }
    return hasVisibleChars;
  }
  toString() {
    const lines = [];
    for (let row = 0; row < this.height; row++) {
      let line = "";
      let currentFg = "";
      let currentBg = "";
      for (let col = 0; col < this.width; col++) {
        const textOverlay = this._text[row * this.width + col];
        if (textOverlay) {
          const nextFg2 = colorKey(textOverlay.color);
          if (nextFg2 !== currentFg || currentBg) {
            line += ANSI_RESET;
            currentBg = "";
            currentFg = "";
          }
          if (nextFg2 && nextFg2 !== currentFg) {
            line += toAnsiForeground(textOverlay.color);
            currentFg = nextFg2;
          }
          line += textOverlay.char;
          continue;
        }
        const topForeground = this._foregroundPixels[row * 2 * this.width + col];
        const bottomForeground = this._foregroundPixels[(row * 2 + 1) * this.width + col];
        const hasForeground = this._cellHasForeground(col, row);
        const top = hasForeground ? topForeground : this._backgroundPixels[row * 2 * this.width + col];
        const bottom = hasForeground ? bottomForeground : this._backgroundPixels[(row * 2 + 1) * this.width + col];
        const topKey = colorKey(top);
        const bottomKey = colorKey(bottom);
        let glyph = " ";
        let nextFg = "";
        let nextBg = "";
        if (top && bottom) {
          if (topKey === bottomKey) {
            glyph = "\u2588";
            nextFg = topKey;
          } else {
            glyph = "\u2580";
            nextFg = topKey;
            nextBg = bottomKey;
          }
        } else if (top) {
          glyph = "\u2580";
          nextFg = topKey;
        } else if (bottom) {
          glyph = "\u2584";
          nextFg = bottomKey;
        }
        if (nextFg !== currentFg || nextBg !== currentBg) {
          line += ANSI_RESET;
          currentFg = "";
          currentBg = "";
          if (nextFg) {
            line += toAnsiForeground(nextFg === topKey ? top || bottom : bottom);
            currentFg = nextFg;
          }
          if (nextBg) {
            line += toAnsiBackground(bottom);
            currentBg = nextBg;
          }
        }
        line += glyph;
      }
      lines.push(line + ANSI_RESET);
    }
    return lines.join("\n");
  }
};
var TerminalCellBuffer_default = TerminalCellBuffer;

// src/terminalPath.ts
import {
  applyTransform
} from "zrender/lib/core/vector.js";
import {cubicAt, quadraticAt} from "zrender/lib/core/curve.js";
import PathProxy from "zrender/lib/core/PathProxy.js";
import {contain as polygonContain} from "zrender/lib/contain/polygon.js";
import {pathToPolygons} from "zrender/lib/tool/convertPath.js";
var CMD = PathProxy.CMD;
function transformPointWithScale(el, x, y, scaleX, scaleY) {
  const transformed = [x, y];
  const matrix = el.getComputedTransform();
  if (matrix) {
    applyTransform(transformed, transformed, matrix);
  }
  transformed[0] /= scaleX;
  transformed[1] /= scaleY;
  return transformed;
}
function toPoints(el, polygon, scaleX, scaleY) {
  const points = [];
  for (let i = 0; i < polygon.length; i += 2) {
    points.push(transformPointWithScale(el, polygon[i], polygon[i + 1], scaleX, scaleY));
  }
  return points;
}
function drawLineWithMode(buffer, from, to, color, mode) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    buffer.setPixel(from[0] + dx * t, from[1] + dy * t, color, mode !== "under");
  }
}
function strokePolylineWithMode(buffer, points, color, mode) {
  for (let i = 1; i < points.length; i++) {
    drawLineWithMode(buffer, points[i - 1], points[i], color, mode);
  }
}
function sampleQuadraticPoints(from, control, to) {
  const points = [from];
  const steps = Math.max(8, Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) / 2));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    points.push([
      quadraticAt(from[0], control[0], to[0], t),
      quadraticAt(from[1], control[1], to[1], t)
    ]);
  }
  return points;
}
function sampleCubicPoints(from, control1, control2, to) {
  const points = [from];
  const steps = Math.max(10, Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) / 2));
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    points.push([
      cubicAt(from[0], control1[0], control2[0], to[0], t),
      cubicAt(from[1], control1[1], control2[1], to[1], t)
    ]);
  }
  return points;
}
function sampleArcPoints(cx, cy, rx, ry, startAngle, delta, el, scaleX, scaleY) {
  const points = [];
  const endAngle = startAngle + delta;
  const steps = Math.max(12, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push(transformPointWithScale(el, cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, scaleX, scaleY));
  }
  return points;
}
function fillPolygonWithMode(buffer, points, color, mode) {
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
        if (mode === "checker" && (x + y) % 2 === 1) {
          continue;
        }
        buffer.setPixel(x, y, color);
      }
    }
  }
}
function shouldFillPath(el) {
  const path = el.getUpdatedPathProxy();
  const data = path.data;
  const len = path.len();
  for (let i = 0; i < len; ) {
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
function strokePath(buffer, el, color, scaleX, scaleY, mode) {
  const path = el.getUpdatedPathProxy();
  const data = path.data;
  const len = path.len();
  let current = [0, 0];
  let subpathStart = [0, 0];
  for (let i = 0; i < len; ) {
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
function paintPath(buffer, el, fill, stroke, scaleX, scaleY, fillMode = "solid", strokeMode = "solid") {
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

// src/TerminalPainter.ts
var TerminalPainter = class {
  constructor(root, storage, opts = {}) {
    this.type = "terminal";
    this.ssrOnly = true;
    this._width = 0;
    this._height = 0;
    this._terminalWidth = 0;
    this._terminalHeight = 0;
    this._lastRenderResult = "";
    this._interactiveTinyMarkers = new Set();
    this._interactionState = null;
    this.root = root || void 0;
    this.storage = storage || new Storage();
    this._opts = opts;
    this.resize(opts.width, opts.height);
  }
  getType() {
    return this.type;
  }
  getViewportRoot() {
    return this.root;
  }
  getViewportRootOffset() {
    return {offsetLeft: 0, offsetTop: 0};
  }
  refresh() {
    this._lastRenderResult = this.renderToString();
  }
  clear() {
    this._lastRenderResult = "";
  }
  setInteractionState(state) {
    this._interactionState = state;
  }
  renderToString() {
    const buffer = new TerminalCellBuffer_default(this._terminalWidth, this._terminalHeight);
    const list = this.storage.getDisplayList(true);
    const scaleX = this._terminalWidth > 0 ? this._width / this._terminalWidth : 1;
    const scaleY = this._terminalHeight > 0 ? this._height / (this._terminalHeight * 2) : 1;
    this._interactiveTinyMarkers = this._collectInteractiveTinyMarkers(list, scaleX, scaleY);
    for (let i = 0; i < list.length; i++) {
      this._paintDisplayable(buffer, list[i], scaleX, scaleY);
    }
    this._paintInteractionOverlay(buffer, scaleX, scaleY);
    this._lastRenderResult = buffer.toString();
    return this._lastRenderResult;
  }
  getLastRenderResult() {
    return this._lastRenderResult;
  }
  resize(width, height) {
    if (width != null && width !== "auto") {
      this._opts.width = width;
    }
    if (height != null && height !== "auto") {
      this._opts.height = height;
    }
    this._width = Math.max(0, Math.round(+this._opts.width || 0));
    this._height = Math.max(0, Math.round(+this._opts.height || 0));
    this._terminalWidth = Math.max(0, Math.round(+(this._opts.terminalWidth == null ? this._opts.width : this._opts.terminalWidth) || 0));
    this._terminalHeight = Math.max(0, Math.round(+(this._opts.terminalHeight == null ? this._opts.height : this._opts.terminalHeight) || 0));
  }
  getWidth() {
    return this._width;
  }
  getHeight() {
    return this._height;
  }
  dispose() {
    this.clear();
  }
  refreshHover() {
  }
  configLayer() {
  }
  setBackgroundColor() {
  }
  _paintDisplayable(buffer, el, scaleX, scaleY) {
    if (!el || el.invisible || el.ignore) {
      return;
    }
    if (this._isPathLike(el)) {
      const pathEl = el;
      if (this._shouldSkipPath(pathEl)) {
        return;
      }
      if (pathEl.silent && this._isDuplicateEffectTinyMarker(pathEl, scaleX, scaleY)) {
        return;
      }
      const fill = resolveTerminalColor(pathEl.style && pathEl.style.fill, {
        opacity: this._getFillOpacity(pathEl),
        minLuminance: 0
      });
      const stroke = resolveTerminalColor(pathEl.style && pathEl.style.stroke, {
        opacity: this._getStrokeOpacity(pathEl),
        minLuminance: this._getStrokeMinLuminance(pathEl)
      });
      if (!fill && !stroke) {
        return;
      }
      if (this._paintCompactSwatch(buffer, pathEl, fill, stroke, scaleX, scaleY)) {
        return;
      }
      if (this._paintTinyMarker(buffer, pathEl, fill || stroke, scaleX, scaleY)) {
        return;
      }
      paintPath(buffer, pathEl, fill, stroke, scaleX, scaleY, this._getFillMode(pathEl), this._getStrokeMode(pathEl));
      return;
    }
    if (this._isTextLike(el)) {
      const style = el.style || {};
      const text = style.text == null ? "" : String(style.text);
      if (!text) {
        return;
      }
      const rect = this._getGlobalRect(el);
      buffer.drawText(Math.max(0, Math.round(rect.x / scaleX)), Math.max(0, Math.round(rect.y / (scaleY * 2))), text, resolveTerminalColor(style.fill || style.stroke, {
        opacity: style.opacity,
        minLuminance: 128
      }));
    }
  }
  _isPathLike(el) {
    return el instanceof Path || typeof el.getUpdatedPathProxy === "function" && typeof el.buildPath === "function";
  }
  _isTextLike(el) {
    const style = el.style;
    return !!(style && style.text != null) || el.type === "tspan" || el.type === "text";
  }
  _shouldSkipPath(el) {
    return el.type === "rect" && !resolveTerminalColor(el.style && el.style.fill, {opacity: el.style && el.style.opacity}) && !!(el.style && el.style.stroke);
  }
  _getStrokeOpacity(el) {
    if (el.silent && el.style && el.style.lineWidth === 1) {
      return (el.style.opacity == null ? 1 : el.style.opacity) * 0.22;
    }
    return el.style && el.style.opacity;
  }
  _getStrokeMinLuminance(el) {
    if (el.silent && el.style && el.style.lineWidth === 1) {
      return 42;
    }
    return 92;
  }
  _getStrokeMode(el) {
    if (el.silent && el.style && el.style.lineWidth === 1) {
      return "under";
    }
    return "solid";
  }
  _getFillOpacity(el) {
    const opacity = el.style && el.style.opacity;
    if (el.constructor && el.constructor.name === "SankeyPath") {
      return (opacity == null ? 1 : opacity) * 0.28;
    }
    return opacity;
  }
  _getFillMode(el) {
    if (el.constructor && el.constructor.name === "SankeyPath") {
      return "checker";
    }
    return "solid";
  }
  _paintTinyMarker(buffer, el, color, scaleX, scaleY) {
    if (!color) {
      return false;
    }
    const rect = this._getGlobalRect(el);
    const width = rect.width / scaleX;
    const height = rect.height / scaleY;
    if (width > 2.5 || height > 2.5) {
      return false;
    }
    const cx = rect.x / scaleX + width / 2;
    const cy = rect.y / scaleY + height / 2;
    buffer.setPixel(cx - 1, cy, color);
    buffer.setPixel(cx, cy, color);
    buffer.setPixel(cx + 1, cy, color);
    buffer.setPixel(cx, cy - 1, color);
    buffer.setPixel(cx, cy + 1, color);
    return true;
  }
  _paintCompactSwatch(buffer, el, fill, stroke, scaleX, scaleY) {
    if (!el.silent || !fill || stroke) {
      return false;
    }
    const rect = this._getGlobalRect(el);
    const width = rect.width / scaleX;
    const height = rect.height / scaleY;
    if (width > 2.5 || height > 1.5) {
      return false;
    }
    const left = Math.max(0, Math.round(rect.x / scaleX));
    const rowBase = Math.max(0, Math.floor((rect.y / scaleY + height / 2) / 2) * 2);
    const pixelWidth = Math.max(2, Math.ceil(width));
    for (let offset = 0; offset < pixelWidth; offset++) {
      buffer.setPixel(left + offset, rowBase, fill);
      buffer.setPixel(left + offset, rowBase + 1, fill);
    }
    return true;
  }
  _collectInteractiveTinyMarkers(list, scaleX, scaleY) {
    const markers = new Set();
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (!this._isPathLike(el) || el.silent || el.invisible || el.ignore) {
        continue;
      }
      const key = this._getTinyMarkerKey(el, scaleX, scaleY);
      if (key) {
        markers.add(key);
      }
    }
    return markers;
  }
  _isDuplicateEffectTinyMarker(el, scaleX, scaleY) {
    const key = this._getTinyMarkerKey(el, scaleX, scaleY);
    return !!key && this._interactiveTinyMarkers.has(key);
  }
  _getTinyMarkerKey(el, scaleX, scaleY) {
    const rect = this._getGlobalRect(el);
    const width = rect.width / scaleX;
    const height = rect.height / scaleY;
    if (width > 2.5 || height > 2.5) {
      return null;
    }
    const cx = Math.round(rect.x / scaleX + width / 2);
    const cy = Math.round(rect.y / scaleY + height / 2);
    const fill = resolveTerminalColor(el.style && el.style.fill, {
      opacity: this._getFillOpacity(el),
      minLuminance: 0
    });
    const stroke = resolveTerminalColor(el.style && el.style.stroke, {
      opacity: this._getStrokeOpacity(el),
      minLuminance: this._getStrokeMinLuminance(el)
    });
    return `${cx}:${cy}:${fill ? fill.join(",") : ""}:${stroke ? stroke.join(",") : ""}`;
  }
  _paintInteractionOverlay(buffer, scaleX, scaleY) {
    if (!this._interactionState || !this._interactionState.active) {
      return;
    }
    buffer.drawText(0, 0, this._interactionState.infoText, this._interactionState.color);
    if (this._interactionState.kind === "bar") {
      this._paintInteractionBar(buffer, scaleX, scaleY);
      return;
    }
    this._paintInteractionPoint(buffer, scaleX, scaleY);
  }
  _paintInteractionBar(buffer, scaleX, scaleY) {
    const state = this._interactionState;
    if (!state || state.width == null || state.height == null) {
      return;
    }
    const left = Math.max(0, Math.floor((state.x - state.width / 2) / scaleX));
    const right = Math.min(buffer.width - 1, Math.ceil((state.x + state.width / 2) / scaleX));
    const top = Math.max(0, Math.floor(state.y / scaleY));
    const bottom = Math.min(buffer.logicalHeight - 1, Math.ceil((state.y + state.height) / scaleY));
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        buffer.setPixel(x, y, state.color);
      }
    }
  }
  _paintInteractionPoint(buffer, scaleX, scaleY) {
    const state = this._interactionState;
    if (!state) {
      return;
    }
    const cx = state.x / scaleX;
    const cy = state.y / scaleY;
    buffer.setPixel(cx - 1, cy, state.color);
    buffer.setPixel(cx, cy, state.color);
    buffer.setPixel(cx + 1, cy, state.color);
    buffer.setPixel(cx, cy - 1, state.color);
    buffer.setPixel(cx, cy + 1, state.color);
  }
  _getGlobalRect(el) {
    const rect = el.getBoundingRect().clone();
    const transform = el.getComputedTransform();
    if (transform) {
      rect.applyTransform(transform);
    }
    return rect;
  }
};
var TerminalPainter_default = TerminalPainter;

// src/normalizeTerminalChartOption.ts
var TOP_LABEL_SERIES = new Set([
  "bar",
  "boxplot",
  "candlestick",
  "effectScatter",
  "line",
  "pictorialBar",
  "scatter"
]);
var INSIDE_LABEL_SERIES = new Set([
  "heatmap"
]);
function isPlainObject(value) {
  return !!value && Object.prototype.toString.call(value) === "[object Object]";
}
function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (isPlainObject(value)) {
    const cloned = {};
    for (const [key, entry] of Object.entries(value)) {
      cloned[key] = cloneValue(entry);
    }
    return cloned;
  }
  return value;
}
function formatScalar(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
  }
  return String(value);
}
function formatSeriesValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => formatScalar(item)).join(",");
  }
  if (isPlainObject(value) && "value" in value) {
    return formatSeriesValue(value.value);
  }
  return formatScalar(value);
}
function buildDefaultFormatter(seriesType) {
  return function terminalLabelFormatter(params) {
    const valueText = formatSeriesValue(params.value);
    if (seriesType === "pie" || seriesType === "funnel" || seriesType === "treemap" || seriesType === "sunburst") {
      const nameText = formatScalar(params.name);
      return nameText ? `${nameText}:${valueText}` : valueText;
    }
    return valueText;
  };
}
function normalizeSeries(series) {
  if (!isPlainObject(series)) {
    return series;
  }
  const next = cloneValue(series);
  if (next.type === "line" && next.symbol === "none") {
    next.symbol = "circle";
    if (next.symbolSize == null) {
      next.symbolSize = 1;
    }
    const itemStyle = isPlainObject(next.itemStyle) ? next.itemStyle : {};
    next.itemStyle = {
      ...itemStyle,
      opacity: itemStyle.opacity == null ? 0 : itemStyle.opacity
    };
  }
  const label = isPlainObject(next.label) ? next.label : {};
  next.label = {
    ...label,
    show: true
  };
  if (next.label && isPlainObject(next.label) && next.label.formatter == null) {
    next.label.formatter = buildDefaultFormatter(next.type);
  }
  if (next.label && isPlainObject(next.label) && next.label.position == null) {
    if (TOP_LABEL_SERIES.has(String(next.type))) {
      next.label.position = "top";
    } else if (INSIDE_LABEL_SERIES.has(String(next.type))) {
      next.label.position = "inside";
    }
  }
  return next;
}
function normalizeTerminalChartOption(option) {
  const next = cloneValue(option);
  if (Array.isArray(next.series)) {
    next.series = next.series.map((series) => normalizeSeries(series));
  } else if (next.series) {
    next.series = normalizeSeries(next.series);
  }
  return next;
}

// src/TerminalInteraction.ts
var SUPPORTED_SERIES = new Set(["bar", "line", "scatter"]);
var FOCUS_COLOR = [255, 255, 255];
function isPlainObject2(value) {
  return !!value && Object.prototype.toString.call(value) === "[object Object]";
}
function formatScalar2(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
  }
  return String(value);
}
function parseColor(color) {
  if (typeof color !== "string") {
    return [255, 255, 255];
  }
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }
  return [255, 255, 255];
}
function getSeriesColor(seriesOption) {
  var _a;
  const lineStyle = isPlainObject2(seriesOption.lineStyle) ? seriesOption.lineStyle : {};
  const itemStyle = isPlainObject2(seriesOption.itemStyle) ? seriesOption.itemStyle : {};
  return parseColor((_a = lineStyle.color) != null ? _a : itemStyle.color);
}
function getSeriesValue(seriesOption, dataIndex) {
  const data = Array.isArray(seriesOption.data) ? seriesOption.data : [];
  const item = data[dataIndex];
  if (Array.isArray(item)) {
    return item;
  }
  if (isPlainObject2(item) && "value" in item) {
    return item.value;
  }
  return item;
}
function getXAxisLabel(option, seriesOption, dataIndex) {
  const xAxisIndex = typeof seriesOption.xAxisIndex === "number" ? seriesOption.xAxisIndex : 0;
  const xAxis = Array.isArray(option.xAxis) ? option.xAxis[xAxisIndex] : option.xAxis;
  if (isPlainObject2(xAxis) && Array.isArray(xAxis.data)) {
    return formatScalar2(xAxis.data[dataIndex]);
  }
  return String(dataIndex);
}
function getPointValueText(seriesType, seriesOption, dataIndex) {
  const rawValue = getSeriesValue(seriesOption, dataIndex);
  if (seriesType === "scatter") {
    if (Array.isArray(rawValue)) {
      return rawValue.map((item) => formatScalar2(item)).join(",");
    }
    return formatScalar2(rawValue);
  }
  if (Array.isArray(rawValue)) {
    return formatScalar2(rawValue[rawValue.length - 1]);
  }
  return formatScalar2(rawValue);
}
function buildInfoText(point) {
  const seriesLabel = point.seriesName || point.seriesType;
  return `INTERACTIVE ${seriesLabel} ${point.xText}:${point.valueText}  Esc exit`;
}
function getAnchor(seriesType, rect) {
  if (seriesType === "bar") {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y
    };
  }
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}
function collectNavigableSeries(chart) {
  var _a, _b;
  const model = (_a = chart.getModel) == null ? void 0 : _a.call(chart);
  const option = ((_b = chart.getOption) == null ? void 0 : _b.call(chart)) || {};
  if (!model) {
    return [];
  }
  const seriesList = [];
  model.eachSeries((seriesModel) => {
    var _a2;
    if (!SUPPORTED_SERIES.has(seriesModel.subType)) {
      return;
    }
    const seriesIndex = typeof seriesModel.componentIndex === "number" ? seriesModel.componentIndex : seriesList.length;
    const seriesOption = Array.isArray(option.series) ? option.series[seriesIndex] : option.series;
    if (!isPlainObject2(seriesOption)) {
      return;
    }
    const data = seriesModel.getData();
    const points = [];
    for (let dataIndex = 0; dataIndex < data.count(); dataIndex++) {
      const el = data.getItemGraphicEl(dataIndex);
      if (!el || !el.getBoundingRect) {
        continue;
      }
      const rect = el.getBoundingRect().clone();
      const transform = (_a2 = el.getComputedTransform) == null ? void 0 : _a2.call(el);
      if (transform) {
        rect.applyTransform(transform);
      }
      const anchor = getAnchor(seriesModel.subType, rect);
      points.push({
        anchorX: anchor.x,
        anchorY: anchor.y,
        width: rect.width,
        height: rect.height,
        seriesIndex,
        dataIndex,
        seriesName: String(seriesOption.name || seriesModel.name || ""),
        seriesType: seriesModel.subType,
        xText: getXAxisLabel(option, seriesOption, dataIndex),
        valueText: getPointValueText(seriesModel.subType, seriesOption, dataIndex),
        color: getSeriesColor(seriesOption)
      });
    }
    if (points.length) {
      seriesList.push({
        seriesIndex,
        seriesName: String(seriesOption.name || seriesModel.name || ""),
        points
      });
    }
  });
  return seriesList;
}
function removeDataListener(input, handler) {
  if (input.off) {
    input.off("data", handler);
    return;
  }
  if (input.removeListener) {
    input.removeListener("data", handler);
  }
}
function createTerminalInteractionController(opts) {
  var _a;
  const input = opts.input;
  const enabled = opts.enabled !== false && !!input;
  if (!enabled || !input) {
    return null;
  }
  let active = false;
  let seriesCursor = 0;
  let dataCursor = 0;
  let disposed = false;
  let seriesList = [];
  function syncPoints() {
    seriesList = collectNavigableSeries(opts.chart);
    if (!seriesList.length) {
      active = false;
      seriesCursor = 0;
      dataCursor = 0;
      return;
    }
    if (seriesCursor >= seriesList.length) {
      seriesCursor = seriesList.length - 1;
    }
    const pointCount = seriesList[seriesCursor].points.length;
    if (dataCursor >= pointCount) {
      dataCursor = pointCount - 1;
    }
  }
  function currentPoint() {
    syncPoints();
    if (!active || !seriesList.length) {
      return null;
    }
    return seriesList[seriesCursor].points[dataCursor] || null;
  }
  function rerender() {
    if (!disposed) {
      opts.onUpdate();
    }
  }
  function enter() {
    syncPoints();
    if (!seriesList.length) {
      return;
    }
    active = true;
    seriesCursor = 0;
    dataCursor = 0;
    rerender();
  }
  function exit() {
    if (!active) {
      return;
    }
    active = false;
    rerender();
  }
  function moveSeries(delta) {
    if (!active || !seriesList.length) {
      return;
    }
    seriesCursor = (seriesCursor + delta + seriesList.length) % seriesList.length;
    dataCursor = Math.min(dataCursor, seriesList[seriesCursor].points.length - 1);
    rerender();
  }
  function movePoint(delta) {
    if (!active || !seriesList.length) {
      return;
    }
    const points = seriesList[seriesCursor].points;
    dataCursor = Math.max(0, Math.min(points.length - 1, dataCursor + delta));
    rerender();
  }
  function handleInput(chunk) {
    const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    if (text === "\r" || text === "\n") {
      enter();
      return;
    }
    if (text === "") {
      exit();
      return;
    }
    if (!active) {
      return;
    }
    if (text === "[A") {
      moveSeries(-1);
    } else if (text === "[B") {
      moveSeries(1);
    } else if (text === "[C") {
      movePoint(1);
    } else if (text === "[D") {
      movePoint(-1);
    }
  }
  if (input.setRawMode && input.isTTY !== false) {
    input.setRawMode(true);
  }
  (_a = input.resume) == null ? void 0 : _a.call(input);
  input.on("data", handleInput);
  return {
    isActive() {
      return active;
    },
    prepareFrame(painter) {
      var _a2, _b;
      const point = currentPoint();
      if (!point || !active) {
        (_a2 = painter.setInteractionState) == null ? void 0 : _a2.call(painter, null);
        return;
      }
      (_b = painter.setInteractionState) == null ? void 0 : _b.call(painter, {
        active: true,
        infoText: buildInfoText(point),
        kind: point.seriesType === "bar" ? "bar" : "point",
        x: point.anchorX,
        y: point.anchorY,
        width: point.width,
        height: point.height,
        color: FOCUS_COLOR
      });
    },
    stop() {
      var _a2;
      if (disposed) {
        return;
      }
      disposed = true;
      active = false;
      removeDataListener(input, handleInput);
      if (input.setRawMode && input.isTTY !== false) {
        input.setRawMode(false);
      }
      (_a2 = input.pause) == null ? void 0 : _a2.call(input);
    }
  };
}

// src/TerminalPlayer.ts
var HIDE_CURSOR = "[?25l";
var SHOW_CURSOR = "[?25h";
var CLEAR_DOWN = "[0J";
var activePlayers = new WeakMap();
function resolveDefaultOutput() {
  const processLike = globalThis.process;
  return processLike && processLike.stdout ? processLike.stdout : null;
}
function resolveDefaultInput() {
  const processLike = globalThis.process;
  return processLike && processLike.stdin ? processLike.stdin : null;
}
function moveToFrameStart(lineCount) {
  if (lineCount <= 0) {
    return "\r";
  }
  return `[${lineCount}A\r`;
}
function createTerminalPlayer(chart, opts = {}) {
  const existing = activePlayers.get(chart);
  if (existing && existing.isActive()) {
    return existing;
  }
  const output = opts.output === void 0 ? resolveDefaultOutput() : opts.output;
  const input = opts.input === void 0 ? resolveDefaultInput() : opts.input;
  const autoRender = opts.autoRender !== false;
  const hideCursor = opts.hideCursor !== false;
  const clearOnStop = opts.clearOnStop !== false;
  const interactive = opts.interactive !== false;
  const rawSetOption = chart.setOption ? chart.setOption.bind(chart) : null;
  const rawResize = chart.resize ? chart.resize.bind(chart) : null;
  const rawDispose = chart.dispose ? chart.dispose.bind(chart) : null;
  let active = true;
  let cursorHidden = false;
  let rendered = false;
  let lastLineCount = 0;
  let interactionController = null;
  function write(chunk) {
    if (output && chunk) {
      output.write(chunk);
    }
  }
  function clearFrame(showCursor) {
    if (!rendered || !lastLineCount) {
      if (showCursor && hideCursor && cursorHidden) {
        write(SHOW_CURSOR);
        cursorHidden = false;
      }
      return;
    }
    let chunk = moveToFrameStart(lastLineCount) + CLEAR_DOWN;
    if (showCursor && hideCursor && cursorHidden) {
      chunk += SHOW_CURSOR;
      cursorHidden = false;
    }
    write(chunk);
    rendered = false;
    lastLineCount = 0;
  }
  const player = {
    render() {
      if (!chart.renderToTerminalString) {
        throw new Error("createTerminalPlayer requires a terminal chart.");
      }
      interactionController == null ? void 0 : interactionController.prepareFrame(chart.getZr().painter);
      const frame = chart.renderToTerminalString();
      const lineCount = frame ? frame.split("\n").length : 0;
      if (output) {
        let chunk = "";
        if (hideCursor && !cursorHidden) {
          chunk += HIDE_CURSOR;
          cursorHidden = true;
        }
        if (rendered && lastLineCount) {
          chunk += moveToFrameStart(lastLineCount) + CLEAR_DOWN;
        }
        chunk += frame;
        if (lineCount) {
          chunk += "\n";
        }
        write(chunk);
      }
      rendered = true;
      lastLineCount = lineCount;
      return frame;
    },
    clear() {
      clearFrame(false);
    },
    stop() {
      if (!active) {
        return;
      }
      active = false;
      if (autoRender) {
        if (rawSetOption) {
          chart.setOption = rawSetOption;
        }
        if (rawResize) {
          chart.resize = rawResize;
        }
        if (rawDispose) {
          chart.dispose = rawDispose;
        }
      }
      interactionController == null ? void 0 : interactionController.stop();
      if (clearOnStop) {
        clearFrame(true);
      } else if (hideCursor && cursorHidden) {
        write(SHOW_CURSOR);
        cursorHidden = false;
      }
      activePlayers.delete(chart);
    },
    isActive() {
      return active;
    }
  };
  interactionController = createTerminalInteractionController({
    chart,
    input,
    enabled: interactive,
    onUpdate() {
      if (active) {
        player.render();
      }
    }
  });
  if (autoRender) {
    if (rawSetOption) {
      chart.setOption = function patchedTerminalSetOption(...args) {
        const result = rawSetOption(...args);
        if (active) {
          player.render();
        }
        return result;
      };
    }
    if (rawResize) {
      chart.resize = function patchedTerminalResize(...args) {
        const result = rawResize(...args);
        if (active) {
          player.render();
        }
        return result;
      };
    }
    if (rawDispose) {
      chart.dispose = function patchedTerminalDispose(...args) {
        player.stop();
        return rawDispose(...args);
      };
    }
  }
  activePlayers.set(chart, player);
  return player;
}

// src/index.ts
var TERMINAL_LAYOUT_SCALE_X = 8;
var TERMINAL_LAYOUT_SCALE_Y = 16;
var patchedEChartsCache = new WeakMap();
var patchedCharts = new WeakSet();
var TerminalRenderer = {
  install(registers) {
    registers.registerPainter("terminal", TerminalPainter_default);
  }
};
function normalizeTerminalDimension(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "" && value !== "auto") {
    const numericValue = +value;
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return fallback;
}
function normalizeTerminalInitOpts(opts = {}) {
  var _a, _b;
  const terminalWidth = normalizeTerminalDimension((_a = opts.terminalWidth) != null ? _a : opts.width, 72);
  const terminalHeight = normalizeTerminalDimension((_b = opts.terminalHeight) != null ? _b : opts.height, 22);
  return {
    ...opts,
    renderer: "terminal",
    ssr: true,
    width: terminalWidth * TERMINAL_LAYOUT_SCALE_X,
    height: terminalHeight * TERMINAL_LAYOUT_SCALE_Y,
    terminalWidth,
    terminalHeight
  };
}
function normalizeTerminalResizeOpts(painter, opts = {}) {
  var _a, _b, _c, _d;
  const terminalWidth = normalizeTerminalDimension((_a = opts.terminalWidth) != null ? _a : opts.width, (_b = painter._terminalWidth) != null ? _b : 72);
  const terminalHeight = normalizeTerminalDimension((_c = opts.terminalHeight) != null ? _c : opts.height, (_d = painter._terminalHeight) != null ? _d : 22);
  return {
    ...opts,
    width: terminalWidth * TERMINAL_LAYOUT_SCALE_X,
    height: terminalHeight * TERMINAL_LAYOUT_SCALE_Y,
    terminalWidth,
    terminalHeight
  };
}
function applyTerminalDimensions(painter, terminalWidth, terminalHeight) {
  painter._terminalWidth = terminalWidth;
  painter._terminalHeight = terminalHeight;
  if (painter._opts) {
    painter._opts.terminalWidth = terminalWidth;
    painter._opts.terminalHeight = terminalHeight;
  }
}
function attachTerminalChart(chart) {
  if (patchedCharts.has(chart)) {
    return chart;
  }
  patchedCharts.add(chart);
  const painter = chart.getZr().painter;
  if (chart.resize) {
    const rawResize = chart.resize.bind(chart);
    chart.resize = function patchedTerminalResize(resizeOpts) {
      if (painter.type !== "terminal") {
        return rawResize(resizeOpts);
      }
      const normalizedResizeOpts = normalizeTerminalResizeOpts(painter, resizeOpts);
      const result = rawResize(normalizedResizeOpts);
      applyTerminalDimensions(painter, normalizedResizeOpts.terminalWidth, normalizedResizeOpts.terminalHeight);
      return result;
    };
  }
  if (chart.setOption) {
    const rawSetOption = chart.setOption.bind(chart);
    chart.setOption = function patchedTerminalSetOption(option, ...args) {
      if (painter.type !== "terminal" || !option || typeof option !== "object") {
        return rawSetOption(option, ...args);
      }
      return rawSetOption(normalizeTerminalChartOption(option), ...args);
    };
  }
  if (!chart.renderToTerminalString) {
    chart.renderToTerminalString = function renderToTerminalStringMethod() {
      return renderToTerminalString(chart);
    };
  }
  if (!chart.createTerminalPlayer) {
    chart.createTerminalPlayer = function createTerminalPlayerMethod(opts) {
      return createTerminalPlayer(chart, opts);
    };
  }
  return chart;
}
function patchECharts(echarts) {
  if (!echarts || typeof echarts !== "object" && typeof echarts !== "function") {
    return echarts;
  }
  const cacheKey = echarts;
  const cached = patchedEChartsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const source = echarts;
  const rawInit = source.init.bind(source);
  const target = new Proxy(source, {
    get(currentTarget, key, receiver) {
      if (key === "init") {
        return function patchedTerminalInit(dom, theme, opts = {}) {
          const actualOpts = opts && opts.renderer === "terminal" ? normalizeTerminalInitOpts(opts) : opts;
          const chart = rawInit(dom, theme, actualOpts);
          const terminalChart = attachTerminalChart(chart);
          if (actualOpts.renderer === "terminal") {
            applyTerminalDimensions(terminalChart.getZr().painter, actualOpts.terminalWidth, actualOpts.terminalHeight);
          }
          return terminalChart;
        };
      }
      return Reflect.get(currentTarget, key, receiver);
    }
  });
  patchedEChartsCache.set(cacheKey, target);
  return target;
}
function initTerminalChart(echarts, theme = null, opts = {}) {
  const patched = patchECharts(echarts);
  return patched.init(null, theme, {
    ...opts,
    renderer: "terminal"
  });
}
function renderToTerminalString(chart) {
  const painter = chart.getZr().painter;
  if (painter.type !== "terminal") {
    throw new Error("renderToTerminalString can only be used in the terminal renderer.");
  }
  return painter.renderToString();
}
export {
  TERMINAL_LAYOUT_SCALE_X,
  TERMINAL_LAYOUT_SCALE_Y,
  TerminalRenderer,
  createTerminalPlayer,
  initTerminalChart,
  patchECharts,
  renderToTerminalString
};
