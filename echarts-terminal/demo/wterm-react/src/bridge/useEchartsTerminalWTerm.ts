import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components';
import {
    TerminalRenderer,
    initTerminalChart,
    patchECharts
} from 'echarts-terminal';
import type { EChartsCoreOption } from 'echarts/core';
import type { TerminalPlayer } from 'echarts-terminal';
import WTermInputAdapter from './WTermInputAdapter';
import createWTermOutput from './createWTermOutput';

type TerminalChart = {
    createTerminalPlayer?: (options: Record<string, unknown>) => TerminalPlayer
    setOption?: (option: EChartsCoreOption, notMerge?: boolean) => void
    resize?: (options: Record<string, unknown>) => void
    dispose?: () => void
};

type UseEchartsTerminalWTermOptions = {
    cols: number
    rows: number
    option: EChartsCoreOption
    terminalReady: boolean
    write: (data: string | Uint8Array) => void
    input: WTermInputAdapter
};

type UseEchartsTerminalWTermResult = {
    rerender: () => void
    resetSession: () => void
};

let terminalInstalled = false;

function getTerminalEcharts() {
    if (!terminalInstalled) {
        echarts.use([
            BarChart,
            LineChart,
            ScatterChart,
            GridComponent,
            LegendComponent,
            TitleComponent,
            TerminalRenderer
        ]);
        terminalInstalled = true;
    }
    return echarts;
}

const CLEAR_SCREEN = '\u001b[2J\u001b[H';

export function useEchartsTerminalWTerm(
    opts: UseEchartsTerminalWTermOptions
): UseEchartsTerminalWTermResult {
    const chartRef = useRef<TerminalChart | null>(null);
    const playerRef = useRef<TerminalPlayer | null>(null);
    const latestOptionsRef = useRef(opts);
    const skipNextOptionSyncRef = useRef(false);
    const skipNextResizeSyncRef = useRef(false);
    const terminalEcharts = useMemo(() => patchECharts(getTerminalEcharts() as never), []);

    useEffect(() => {
        latestOptionsRef.current = opts;
    }, [opts]);

    const destroySession = useCallback(() => {
        playerRef.current?.stop();
        playerRef.current = null;
        chartRef.current?.dispose?.();
        chartRef.current = null;
    }, []);

    const createSession = useCallback(() => {
        const current = latestOptionsRef.current;
        if (!current.terminalReady) {
            return;
        }
        destroySession();
        current.input.resume();
        current.write(CLEAR_SCREEN);
        const chart = initTerminalChart(terminalEcharts, null, {
            width: current.cols,
            height: current.rows
        }) as TerminalChart;
        if (!chart.createTerminalPlayer) {
            throw new Error('Terminal chart bridge requires createTerminalPlayer support.');
        }
        const player = chart.createTerminalPlayer({
            output: createWTermOutput(current.write),
            input: current.input,
            hideCursor: false,
            clearOnStop: false,
            interactive: true
        });
        chartRef.current = chart;
        playerRef.current = player;
        skipNextOptionSyncRef.current = true;
        skipNextResizeSyncRef.current = true;
        chart.setOption?.(current.option, true);
    }, [destroySession, terminalEcharts]);

    useEffect(() => {
        if (!opts.terminalReady) {
            return;
        }
        createSession();
        return destroySession;
    }, [createSession, destroySession, opts.terminalReady]);

    useEffect(() => {
        if (!chartRef.current || !opts.terminalReady) {
            return;
        }
        if (skipNextOptionSyncRef.current) {
            skipNextOptionSyncRef.current = false;
            return;
        }
        chartRef.current.setOption?.(opts.option, true);
    }, [opts.option, opts.terminalReady]);

    useEffect(() => {
        if (!chartRef.current || !opts.terminalReady) {
            return;
        }
        if (skipNextResizeSyncRef.current) {
            skipNextResizeSyncRef.current = false;
            return;
        }
        if (!chartRef.current.resize) {
            return;
        }
        chartRef.current.resize({
            width: opts.cols,
            height: opts.rows
        });
    }, [opts.cols, opts.rows, opts.terminalReady]);

    return {
        rerender: () => {
            if (!playerRef.current) {
                createSession();
                return;
            }
            playerRef.current.render();
        },
        resetSession: () => {
            createSession();
        }
    };
}

export default useEchartsTerminalWTerm;
