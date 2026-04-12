import Storage from 'zrender/lib/Storage.js';
import Displayable from 'zrender/lib/graphic/Displayable.js';
import Path from 'zrender/lib/graphic/Path.js';
import TerminalCellBuffer from './TerminalCellBuffer.js';
import { paintPath } from './terminalPath.js';
import { resolveTerminalColor } from './terminalColor.js';

type PathLikeDisplayable = Displayable & Path & {
    getUpdatedPathProxy: () => unknown
};

export default class TerminalPainter {
    type = 'terminal';
    ssrOnly = true;
    storage: Storage;
    root?: HTMLElement;

    private _width = 0;
    private _height = 0;
    private _terminalWidth = 0;
    private _terminalHeight = 0;
    private _opts: Record<string, unknown>;
    private _lastRenderResult = '';
    private _interactiveTinyMarkers = new Set<string>();

    constructor(root: HTMLElement, storage: Storage, opts: Record<string, unknown> = {}) {
        this.root = root || undefined;
        this.storage = storage || new Storage();
        this._opts = opts;
        this.resize(opts.width as number, opts.height as number);
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
        this._interactiveTinyMarkers = this._collectInteractiveTinyMarkers(list, scaleX, scaleY);

        for (let i = 0; i < list.length; i++) {
            this._paintDisplayable(buffer, list[i], scaleX, scaleY);
        }

        this._lastRenderResult = buffer.toString();
        return this._lastRenderResult;
    }

    getLastRenderResult() {
        return this._lastRenderResult;
    }

    resize(width?: number | string, height?: number | string) {
        if (width != null && width !== 'auto') {
            this._opts.width = width;
        }
        if (height != null && height !== 'auto') {
            this._opts.height = height;
        }
        this._width = Math.max(0, Math.round(+(this._opts.width as number) || 0));
        this._height = Math.max(0, Math.round(+(this._opts.height as number) || 0));
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

    refreshHover() {}
    configLayer() {}
    setBackgroundColor() {}

    private _paintDisplayable(buffer: TerminalCellBuffer, el: Displayable, scaleX: number, scaleY: number) {
        if (!el || el.invisible || el.ignore) {
            return;
        }

        if (this._isPathLike(el)) {
            const pathEl = el as PathLikeDisplayable;
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
            paintPath(
                buffer,
                pathEl,
                fill,
                stroke,
                scaleX,
                scaleY,
                this._getFillMode(pathEl),
                this._getStrokeMode(pathEl)
            );
            return;
        }

        if (this._isTextLike(el)) {
            const style = el.style || {};
            const text = style.text == null ? '' : String(style.text);
            if (!text) {
                return;
            }
            const rect = this._getGlobalRect(el);
            buffer.drawText(
                Math.max(0, Math.round(rect.x / scaleX)),
                Math.max(0, Math.round(rect.y / (scaleY * 2))),
                text,
                resolveTerminalColor(style.fill || style.stroke, {
                    opacity: style.opacity,
                    minLuminance: 128
                })
            );
        }
    }

    private _isPathLike(el: Displayable): el is PathLikeDisplayable {
        return el instanceof Path
            || (typeof (el as PathLikeDisplayable).getUpdatedPathProxy === 'function'
                && typeof (el as PathLikeDisplayable).buildPath === 'function');
    }

    private _isTextLike(el: Displayable): el is Displayable & { style: { text?: string } } {
        const style = (el as Displayable & { style?: { text?: string } }).style;
        return !!(style && style.text != null) || el.type === 'tspan' || el.type === 'text';
    }

    private _shouldSkipPath(el: PathLikeDisplayable) {
        return el.type === 'rect'
            && !resolveTerminalColor(el.style && el.style.fill, { opacity: el.style && el.style.opacity })
            && !!(el.style && el.style.stroke);
    }

    private _getStrokeOpacity(el: PathLikeDisplayable) {
        if (el.silent && el.style && el.style.lineWidth === 1) {
            return (el.style.opacity == null ? 1 : el.style.opacity) * 0.22;
        }
        return el.style && el.style.opacity;
    }

    private _getStrokeMinLuminance(el: PathLikeDisplayable) {
        if (el.silent && el.style && el.style.lineWidth === 1) {
            return 42;
        }
        return 92;
    }

    private _getStrokeMode(el: PathLikeDisplayable) {
        if (el.silent && el.style && el.style.lineWidth === 1) {
            return 'under' as const;
        }
        return 'solid' as const;
    }

    private _getFillOpacity(el: PathLikeDisplayable) {
        const opacity = el.style && el.style.opacity;
        if (el.constructor && el.constructor.name === 'SankeyPath') {
            return (opacity == null ? 1 : opacity) * 0.28;
        }
        return opacity;
    }

    private _getFillMode(el: PathLikeDisplayable) {
        if (el.constructor && el.constructor.name === 'SankeyPath') {
            return 'checker' as const;
        }
        return 'solid' as const;
    }

    private _paintTinyMarker(
        buffer: TerminalCellBuffer,
        el: PathLikeDisplayable,
        color: ReturnType<typeof resolveTerminalColor>,
        scaleX: number,
        scaleY: number
    ) {
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

    private _paintCompactSwatch(
        buffer: TerminalCellBuffer,
        el: PathLikeDisplayable,
        fill: ReturnType<typeof resolveTerminalColor>,
        stroke: ReturnType<typeof resolveTerminalColor>,
        scaleX: number,
        scaleY: number
    ) {
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

    private _collectInteractiveTinyMarkers(list: Displayable[], scaleX: number, scaleY: number) {
        const markers = new Set<string>();
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

    private _isDuplicateEffectTinyMarker(el: PathLikeDisplayable, scaleX: number, scaleY: number) {
        const key = this._getTinyMarkerKey(el, scaleX, scaleY);
        return !!key && this._interactiveTinyMarkers.has(key);
    }

    private _getTinyMarkerKey(el: PathLikeDisplayable, scaleX: number, scaleY: number) {
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
        return `${cx}:${cy}:${fill ? fill.join(',') : ''}:${stroke ? stroke.join(',') : ''}`;
    }

    private _getGlobalRect(el: Displayable) {
        const rect = el.getBoundingRect().clone();
        const transform = (el as Displayable & { getComputedTransform: () => number[] }).getComputedTransform();
        if (transform) {
            rect.applyTransform(transform);
        }
        return rect;
    }
}
