type UnknownRecord = Record<string, unknown>;

const TOP_LABEL_SERIES = new Set([
    'bar',
    'boxplot',
    'candlestick',
    'effectScatter',
    'line',
    'pictorialBar',
    'scatter'
]);

const INSIDE_LABEL_SERIES = new Set([
    'heatmap'
]);

function isPlainObject(value: unknown): value is UnknownRecord {
    return !!value && Object.prototype.toString.call(value) === '[object Object]';
}

function cloneValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(item => cloneValue(item)) as unknown as T;
    }
    if (isPlainObject(value)) {
        const cloned: UnknownRecord = {};
        for (const [key, entry] of Object.entries(value)) {
            cloned[key] = cloneValue(entry);
        }
        return cloned as T;
    }
    return value;
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

function formatSeriesValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(item => formatScalar(item)).join(',');
    }
    if (isPlainObject(value) && 'value' in value) {
        return formatSeriesValue(value.value);
    }
    return formatScalar(value);
}

function buildDefaultFormatter(seriesType: unknown) {
    return function terminalLabelFormatter(params: { name?: unknown, value?: unknown }) {
        const valueText = formatSeriesValue(params.value);
        if (seriesType === 'pie' || seriesType === 'funnel' || seriesType === 'treemap' || seriesType === 'sunburst') {
            const nameText = formatScalar(params.name);
            return nameText ? `${nameText}:${valueText}` : valueText;
        }
        return valueText;
    };
}

function normalizeSeries(series: unknown) {
    if (!isPlainObject(series)) {
        return series;
    }

    const next = cloneValue(series);
    if (next.type === 'line' && next.symbol === 'none') {
        next.symbol = 'circle';
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
            next.label.position = 'top';
        }
        else if (INSIDE_LABEL_SERIES.has(String(next.type))) {
            next.label.position = 'inside';
        }
    }

    return next;
}

export function normalizeTerminalChartOption(option: UnknownRecord) {
    const next = cloneValue(option);
    if (Array.isArray(next.series)) {
        next.series = next.series.map(series => normalizeSeries(series));
    }
    else if (next.series) {
        next.series = normalizeSeries(next.series);
    }
    return next;
}
