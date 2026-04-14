import TerminalPainter from './TerminalPainter.js';
import { normalizeTerminalChartOption } from './normalizeTerminalChartOption.js';
import createTerminalPlayer from './TerminalPlayer.js';
import type {
    TerminalOutput,
    TerminalPlayer,
    TerminalPlayerOptions
} from './TerminalPlayer.js';

export const TERMINAL_LAYOUT_SCALE_X = 8;
export const TERMINAL_LAYOUT_SCALE_Y = 16;
const patchedEChartsCache = new WeakMap<object, TerminalEChartsLike>();
const patchedCharts = new WeakSet<object>();

export const TerminalRenderer = {
    /* c8 ignore next */
    install(registers: { registerPainter(type: string, painter: unknown): void }) {
        registers.registerPainter('terminal', TerminalPainter);
    }
};

/* c8 ignore start */
type TerminalPainterLike = {
    type: string
    renderToString(): string
    _terminalWidth?: number
    _terminalHeight?: number
    _opts?: Record<string, unknown>
};

type TerminalChartLike = {
    getZr(): {
        painter: TerminalPainterLike
    }
    setOption?: (...args: any[]) => unknown
    resize?: (opts?: Record<string, unknown>) => void
    dispose?: (...args: any[]) => unknown
    renderToTerminalString?: () => string
    createTerminalPlayer?: (opts?: TerminalPlayerOptions) => TerminalPlayer
};

type TerminalEChartsLike = {
    init(dom: null, theme: unknown, opts: Record<string, unknown>): TerminalChartLike
};
/* c8 ignore stop */

/* c8 ignore start */
function normalizeTerminalDimension(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value !== '' && value !== 'auto') {
        const numericValue = +value;
        if (Number.isFinite(numericValue)) {
            return numericValue;
        }
    }
    return fallback;
}

function normalizeTerminalInitOpts(opts: Record<string, unknown> = {}) {
    const terminalWidth = normalizeTerminalDimension(opts.terminalWidth ?? opts.width, 72);
    const terminalHeight = normalizeTerminalDimension(opts.terminalHeight ?? opts.height, 22);
    return {
        ...opts,
        renderer: 'terminal',
        ssr: true,
        width: terminalWidth * TERMINAL_LAYOUT_SCALE_X,
        height: terminalHeight * TERMINAL_LAYOUT_SCALE_Y,
        terminalWidth,
        terminalHeight
    };
}

function normalizeTerminalResizeOpts(
    painter: TerminalPainterLike,
    opts: Record<string, unknown> = {}
) {
    const terminalWidth = normalizeTerminalDimension(opts.terminalWidth ?? opts.width, painter._terminalWidth ?? 72);
    const terminalHeight = normalizeTerminalDimension(opts.terminalHeight ?? opts.height, painter._terminalHeight ?? 22);
    return {
        ...opts,
        width: terminalWidth * TERMINAL_LAYOUT_SCALE_X,
        height: terminalHeight * TERMINAL_LAYOUT_SCALE_Y,
        terminalWidth,
        terminalHeight
    };
}

function applyTerminalDimensions(
    painter: TerminalPainterLike,
    terminalWidth: number,
    terminalHeight: number
) {
    painter._terminalWidth = terminalWidth;
    painter._terminalHeight = terminalHeight;
    if (painter._opts) {
        painter._opts.terminalWidth = terminalWidth;
        painter._opts.terminalHeight = terminalHeight;
    }
}

function attachTerminalChart<T extends TerminalChartLike>(chart: T) {
    if (patchedCharts.has(chart as object)) {
        return chart;
    }
    patchedCharts.add(chart as object);

    const painter = chart.getZr().painter;
    if (chart.resize) {
        const rawResize = chart.resize.bind(chart);
        chart.resize = function patchedTerminalResize(resizeOpts?: Record<string, unknown>) {
            /* c8 ignore next 2 */
            if (painter.type !== 'terminal') {
                return rawResize(resizeOpts);
            }
            const normalizedResizeOpts = normalizeTerminalResizeOpts(painter, resizeOpts);
            const result = rawResize(normalizedResizeOpts);
            applyTerminalDimensions(
                painter,
                normalizedResizeOpts.terminalWidth as number,
                normalizedResizeOpts.terminalHeight as number
            );
            return result;
        };
    }
    if (chart.setOption) {
        const rawSetOption = chart.setOption.bind(chart);
        chart.setOption = function patchedTerminalSetOption(option: Record<string, unknown>, ...args: any[]) {
            if (painter.type !== 'terminal' || !option || typeof option !== 'object') {
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
        chart.createTerminalPlayer = function createTerminalPlayerMethod(opts?: TerminalPlayerOptions) {
            return createTerminalPlayer(chart, opts);
        };
    }
    return chart;
}
/* c8 ignore stop */

/* c8 ignore start */
export function patchECharts<T extends TerminalEChartsLike>(echarts: T): T {
    /* c8 ignore next */
    if (!echarts || (typeof echarts !== 'object' && typeof echarts !== 'function')) {
        return echarts;
    }
    const cacheKey = echarts as unknown as object;
    const cached = patchedEChartsCache.get(cacheKey);
    if (cached) {
        return cached as unknown as T;
    }

    const source = echarts;
    const rawInit = source.init.bind(source);
    const target = new Proxy(source as object, {
        get(currentTarget, key, receiver) {
            if (key === 'init') {
                return function patchedTerminalInit(dom: null, theme: unknown, opts: Record<string, unknown> = {}) {
                    const actualOpts = opts && opts.renderer === 'terminal'
                        ? normalizeTerminalInitOpts(opts)
                        : opts;
                    const chart = rawInit(dom, theme, actualOpts);
                    const terminalChart = attachTerminalChart(chart);
                    if (actualOpts.renderer === 'terminal') {
                        applyTerminalDimensions(
                            terminalChart.getZr().painter,
                            actualOpts.terminalWidth as number,
                            actualOpts.terminalHeight as number
                        );
                    }
                    return terminalChart;
                };
            }
            /* c8 ignore next */
            return Reflect.get(currentTarget, key, receiver);
        }
    }) as T & TerminalEChartsLike;
    patchedEChartsCache.set(cacheKey, target);

    return target;
}
/* c8 ignore stop */

export function initTerminalChart(
    echarts: TerminalEChartsLike,
    theme: unknown = null,
    opts: Record<string, unknown> = {}
) {
    const patched = patchECharts(echarts);
    return patched.init(null, theme, {
        ...opts,
        renderer: 'terminal'
    });
}

/* c8 ignore next */
export function renderToTerminalString(chart: {
    getZr(): {
        painter: {
            type: string
            renderToString(): string
        }
    }
}) {
    const painter = chart.getZr().painter;
    /* c8 ignore next 3 */
    if (painter.type !== 'terminal') {
        throw new Error('renderToTerminalString can only be used in the terminal renderer.');
    }
    return painter.renderToString();
}

export {
    createTerminalPlayer,
};
/* c8 ignore start */
export type {
    TerminalOutput,
    TerminalPlayer,
    TerminalPlayerOptions
};
/* c8 ignore stop */
