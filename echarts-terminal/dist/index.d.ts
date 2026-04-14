import createTerminalPlayer from './TerminalPlayer.js';
import type { TerminalOutput, TerminalPlayer, TerminalPlayerOptions } from './TerminalPlayer.js';
export declare const TERMINAL_LAYOUT_SCALE_X = 8;
export declare const TERMINAL_LAYOUT_SCALE_Y = 16;
export declare const TerminalRenderer: {
    install(registers: {
        registerPainter(type: string, painter: unknown): void;
    }): void;
};
declare type TerminalPainterLike = {
    type: string;
    renderToString(): string;
    _terminalWidth?: number;
    _terminalHeight?: number;
    _opts?: Record<string, unknown>;
};
declare type TerminalChartLike = {
    getZr(): {
        painter: TerminalPainterLike;
    };
    setOption?: (...args: any[]) => unknown;
    resize?: (opts?: Record<string, unknown>) => void;
    dispose?: (...args: any[]) => unknown;
    renderToTerminalString?: () => string;
    createTerminalPlayer?: (opts?: TerminalPlayerOptions) => TerminalPlayer;
};
declare type TerminalEChartsLike = {
    init(dom: null, theme: unknown, opts: Record<string, unknown>): TerminalChartLike;
};
export declare function patchECharts<T extends TerminalEChartsLike>(echarts: T): T;
export declare function initTerminalChart(echarts: TerminalEChartsLike, theme?: unknown, opts?: Record<string, unknown>): TerminalChartLike;
export declare function renderToTerminalString(chart: {
    getZr(): {
        painter: {
            type: string;
            renderToString(): string;
        };
    };
}): string;
export { createTerminalPlayer, };
export type { TerminalOutput, TerminalPlayer, TerminalPlayerOptions };
