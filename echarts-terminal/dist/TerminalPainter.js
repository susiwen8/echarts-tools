import Storage from 'zrender/lib/Storage.js';
import Path from 'zrender/lib/graphic/Path.js';
import TSpan from 'zrender/lib/graphic/TSpan.js';
import ZRText from 'zrender/lib/graphic/Text.js';
import TerminalCellBuffer from './TerminalCellBuffer.js';
import { paintPath } from './terminalPath.js';
import { resolveTerminalColor } from './terminalColor.js';
export default class TerminalPainter {
    constructor(root, storage, opts = {}) {
        this.type = 'terminal';
        this.ssrOnly = true;
        this._width = 0;
        this._height = 0;
        this._terminalWidth = 0;
        this._terminalHeight = 0;
        this._lastRenderResult = '';
        this.root = root || undefined;
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
        return { offsetLeft: 0, offsetTop: 0 };
    }
    refresh() {
        this._lastRenderResult = this.renderToString();
    }
    clear() {
        this._lastRenderResult = '';
    }
    renderToString() {
        const buffer = new TerminalCellBuffer(this._terminalWidth, this._terminalHeight);
        const list = this.storage.getDisplayList(true);
        const scaleX = this._terminalWidth > 0 ? this._width / this._terminalWidth : 1;
        const scaleY = this._terminalHeight > 0 ? this._height / (this._terminalHeight * 2) : 1;
        for (let i = 0; i < list.length; i++) {
            this._paintDisplayable(buffer, list[i], scaleX, scaleY);
        }
        this._lastRenderResult = buffer.toString();
        return this._lastRenderResult;
    }
    getLastRenderResult() {
        return this._lastRenderResult;
    }
    resize(width, height) {
        if (width != null && width !== 'auto') {
            this._opts.width = width;
        }
        if (height != null && height !== 'auto') {
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
    refreshHover() { }
    configLayer() { }
    setBackgroundColor() { }
    _paintDisplayable(buffer, el, scaleX, scaleY) {
        if (!el || el.invisible || el.ignore) {
            return;
        }
        if (this._isPathLike(el)) {
            const pathEl = el;
            if (this._shouldSkipPath(pathEl)) {
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
            if (this._paintTinyMarker(buffer, pathEl, fill || stroke, scaleX, scaleY)) {
                return;
            }
            paintPath(buffer, pathEl, fill, stroke, scaleX, scaleY, this._getFillMode(pathEl), this._getStrokeMode(pathEl));
            return;
        }
        if (el instanceof ZRText || el instanceof TSpan) {
            const style = el.style || {};
            const text = style.text == null ? '' : String(style.text);
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
        return el instanceof Path
            || (typeof el.getUpdatedPathProxy === 'function'
                && typeof el.buildPath === 'function');
    }
    _shouldSkipPath(el) {
        return el.type === 'rect'
            && !resolveTerminalColor(el.style && el.style.fill, { opacity: el.style && el.style.opacity })
            && !!(el.style && el.style.stroke);
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
            return 'under';
        }
        return 'solid';
    }
    _getFillOpacity(el) {
        const opacity = el.style && el.style.opacity;
        if (el.constructor && el.constructor.name === 'SankeyPath') {
            return (opacity == null ? 1 : opacity) * 0.28;
        }
        return opacity;
    }
    _getFillMode(el) {
        if (el.constructor && el.constructor.name === 'SankeyPath') {
            return 'checker';
        }
        return 'solid';
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
    _getGlobalRect(el) {
        const rect = el.getBoundingRect().clone();
        const transform = el.getComputedTransform();
        if (transform) {
            rect.applyTransform(transform);
        }
        return rect;
    }
}
