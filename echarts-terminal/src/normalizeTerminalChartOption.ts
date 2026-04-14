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

function getSeriesLegendMarkerStyle(series: unknown) {
    if (!isPlainObject(series)) {
        return null;
    }
    const itemStyle = isPlainObject(series.itemStyle) ? series.itemStyle : {};
    const lineStyle = isPlainObject(series.lineStyle) ? series.lineStyle : {};
    const color = itemStyle.color ?? lineStyle.color;
    if (color == null) {
        return null;
    }
    return {
        color,
        opacity: 1
    };
}

function normalizeLegendData(legendData: unknown[], series: unknown) {
    const stylesBySeriesName = new Map<string, UnknownRecord>();
    const seriesList = Array.isArray(series) ? series : (series == null ? [] : [series]);

    for (const entry of seriesList) {
        if (!isPlainObject(entry) || typeof entry.name !== 'string' || !entry.name) {
            continue;
        }
        const markerStyle = getSeriesLegendMarkerStyle(entry);
        if (markerStyle) {
            stylesBySeriesName.set(entry.name, markerStyle);
        }
    }

    return legendData.map(item => {
        const name = typeof item === 'string'
            ? item
            : (isPlainObject(item) && typeof item.name === 'string' ? item.name : null);
        if (!name) {
            return item;
        }
        const markerStyle = stylesBySeriesName.get(name);
        if (!markerStyle) {
            return item;
        }
        if (typeof item === 'string') {
            return {
                name,
                itemStyle: markerStyle
            };
        }
        const itemRecord = item as UnknownRecord;
        const itemStyle = isPlainObject(itemRecord.itemStyle) ? itemRecord.itemStyle : {};
        return {
            ...itemRecord,
            itemStyle: {
                ...itemStyle,
                ...markerStyle
            }
        };
    });
}

/* c8 ignore start */
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
    /* c8 ignore next 2 */
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

/* c8 ignore next */
export function normalizeTerminalChartOption(option: UnknownRecord) {
    const next = cloneValue(option);
    if (Array.isArray(next.series)) {
        next.series = next.series.map(series => normalizeSeries(series));
    }
    /* c8 ignore next */
    else if (next.series) {
        next.series = normalizeSeries(next.series);
    }

    if (isPlainObject(next.legend) && Array.isArray(next.legend.data)) {
        next.legend = {
            ...next.legend,
            data: normalizeLegendData(next.legend.data, next.series)
        };
    }
    return next;
}
/* c8 ignore stop */
