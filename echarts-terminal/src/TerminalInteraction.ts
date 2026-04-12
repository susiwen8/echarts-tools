type UnknownRecord = Record<string, unknown>;

export type TerminalInput = {
    isTTY?: boolean
    on(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown
    off?(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown
    removeListener?(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown
    resume?(): unknown
    pause?(): unknown
    setRawMode?(enabled: boolean): unknown
};

export type TerminalInteractionRenderState = {
    active: boolean
    infoText: string
    kind: 'bar' | 'point'
    x: number
    y: number
    width?: number
    height?: number
    color: [number, number, number]
};

type TerminalPainterWithInteraction = {
    setInteractionState?: (state: TerminalInteractionRenderState | null) => void
};

type TerminalChartForInteraction = {
    getModel?: () => any
    getOption?: () => UnknownRecord
};

type InteractionPoint = {
    anchorX: number
    anchorY: number
    width: number
    height: number
    seriesIndex: number
    dataIndex: number
    seriesName: string
    seriesType: string
    xText: string
    valueText: string
    color: [number, number, number]
};

type InteractionSeries = {
    seriesIndex: number
    seriesName: string
    points: InteractionPoint[]
};

type TerminalInteractionOptions = {
    chart: TerminalChartForInteraction
    input?: TerminalInput | null
    enabled?: boolean
    onUpdate: () => void
};

export type TerminalInteractionController = {
    isActive(): boolean
    prepareFrame(painter: TerminalPainterWithInteraction): void
    stop(): void
};

const SUPPORTED_SERIES = new Set(['bar', 'line', 'scatter']);
const FOCUS_COLOR: [number, number, number] = [255, 255, 255];

function isPlainObject(value: unknown): value is UnknownRecord {
    return !!value && Object.prototype.toString.call(value) === '[object Object]';
}

function formatScalar(value: unknown): string {
    if (value == null) {
        return '';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
    }
    return String(value);
}

function parseColor(color: unknown): [number, number, number] {
    if (typeof color !== 'string') {
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

function getSeriesColor(seriesOption: UnknownRecord) {
    const lineStyle = isPlainObject(seriesOption.lineStyle) ? seriesOption.lineStyle : {};
    const itemStyle = isPlainObject(seriesOption.itemStyle) ? seriesOption.itemStyle : {};
    return parseColor(lineStyle.color ?? itemStyle.color);
}

function getSeriesValue(seriesOption: UnknownRecord, dataIndex: number) {
    const data = Array.isArray(seriesOption.data) ? seriesOption.data : [];
    const item = data[dataIndex];
    if (Array.isArray(item)) {
        return item;
    }
    if (isPlainObject(item) && 'value' in item) {
        return item.value;
    }
    return item;
}

function getXAxisLabel(option: UnknownRecord, seriesOption: UnknownRecord, dataIndex: number) {
    const xAxisIndex = typeof seriesOption.xAxisIndex === 'number' ? seriesOption.xAxisIndex : 0;
    const xAxis = Array.isArray(option.xAxis) ? option.xAxis[xAxisIndex] : option.xAxis;
    if (isPlainObject(xAxis) && Array.isArray(xAxis.data)) {
        return formatScalar(xAxis.data[dataIndex]);
    }
    return String(dataIndex);
}

function getPointValueText(seriesType: string, seriesOption: UnknownRecord, dataIndex: number) {
    const rawValue = getSeriesValue(seriesOption, dataIndex);
    if (seriesType === 'scatter') {
        if (Array.isArray(rawValue)) {
            return rawValue.map(item => formatScalar(item)).join(',');
        }
        return formatScalar(rawValue);
    }
    if (Array.isArray(rawValue)) {
        return formatScalar(rawValue[rawValue.length - 1]);
    }
    return formatScalar(rawValue);
}

function buildInfoText(point: InteractionPoint) {
    const seriesLabel = point.seriesName || point.seriesType;
    return `INTERACTIVE ${seriesLabel} ${point.xText}:${point.valueText}  Esc exit`;
}

function getAnchor(seriesType: string, rect: { x: number, y: number, width: number, height: number }) {
    if (seriesType === 'bar') {
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

function collectNavigableSeries(chart: TerminalChartForInteraction): InteractionSeries[] {
    const model = chart.getModel?.();
    const option = chart.getOption?.() || {};
    if (!model) {
        return [];
    }

    const seriesList: InteractionSeries[] = [];
    model.eachSeries((seriesModel: any) => {
        if (!SUPPORTED_SERIES.has(seriesModel.subType)) {
            return;
        }
        const seriesIndex = typeof seriesModel.componentIndex === 'number' ? seriesModel.componentIndex : seriesList.length;
        const seriesOption = Array.isArray(option.series) ? option.series[seriesIndex] : option.series;
        if (!isPlainObject(seriesOption)) {
            return;
        }
        const data = seriesModel.getData();
        const points: InteractionPoint[] = [];
        for (let dataIndex = 0; dataIndex < data.count(); dataIndex++) {
            const el = data.getItemGraphicEl(dataIndex);
            if (!el || !el.getBoundingRect) {
                continue;
            }
            const rect = el.getBoundingRect().clone();
            const transform = el.getComputedTransform?.();
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
                seriesName: String(seriesOption.name || seriesModel.name || ''),
                seriesType: seriesModel.subType,
                xText: getXAxisLabel(option, seriesOption, dataIndex),
                valueText: getPointValueText(seriesModel.subType, seriesOption, dataIndex),
                color: getSeriesColor(seriesOption)
            });
        }
        if (points.length) {
            seriesList.push({
                seriesIndex,
                seriesName: String(seriesOption.name || seriesModel.name || ''),
                points
            });
        }
    });
    return seriesList;
}

function removeDataListener(input: TerminalInput, handler: (chunk: string | Uint8Array) => void) {
    if (input.off) {
        input.off('data', handler);
        return;
    }
    if (input.removeListener) {
        input.removeListener('data', handler);
    }
}

export default function createTerminalInteractionController(
    opts: TerminalInteractionOptions
): TerminalInteractionController | null {
    const input = opts.input;
    const enabled = opts.enabled !== false && !!input;
    if (!enabled || !input) {
        return null;
    }

    let active = false;
    let seriesCursor = 0;
    let dataCursor = 0;
    let disposed = false;
    let seriesList: InteractionSeries[] = [];

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

    function moveSeries(delta: number) {
        if (!active || !seriesList.length) {
            return;
        }
        seriesCursor = (seriesCursor + delta + seriesList.length) % seriesList.length;
        dataCursor = Math.min(dataCursor, seriesList[seriesCursor].points.length - 1);
        rerender();
    }

    function movePoint(delta: number) {
        if (!active || !seriesList.length) {
            return;
        }
        const points = seriesList[seriesCursor].points;
        dataCursor = Math.max(0, Math.min(points.length - 1, dataCursor + delta));
        rerender();
    }

    function handleInput(chunk: string | Uint8Array) {
        const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        if (text === '\r' || text === '\n') {
            enter();
            return;
        }
        if (text === '\u001b') {
            exit();
            return;
        }
        if (!active) {
            return;
        }
        if (text === '\u001b[A') {
            moveSeries(-1);
        }
        else if (text === '\u001b[B') {
            moveSeries(1);
        }
        else if (text === '\u001b[C') {
            movePoint(1);
        }
        else if (text === '\u001b[D') {
            movePoint(-1);
        }
    }

    if (input.setRawMode && input.isTTY !== false) {
        input.setRawMode(true);
    }
    input.resume?.();
    input.on('data', handleInput);

    return {
        isActive() {
            return active;
        },
        prepareFrame(painter: TerminalPainterWithInteraction) {
            const point = currentPoint();
            if (!point || !active) {
                painter.setInteractionState?.(null);
                return;
            }
                painter.setInteractionState?.({
                    active: true,
                    infoText: buildInfoText(point),
                    kind: point.seriesType === 'bar' ? 'bar' : 'point',
                    x: point.anchorX,
                    y: point.anchorY,
                    width: point.width,
                    height: point.height,
                    color: FOCUS_COLOR
                });
            },
        stop() {
            if (disposed) {
                return;
            }
            disposed = true;
            active = false;
            removeDataListener(input, handleInput);
            if (input.setRawMode && input.isTTY !== false) {
                input.setRawMode(false);
            }
            input.pause?.();
        }
    };
}
