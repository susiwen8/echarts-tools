export function normalizeTerminalOption(option) {
    const cloned = JSON.parse(JSON.stringify(option));
    const hasLegend = !!(cloned.legend && !Array.isArray(cloned.legend));
    const hasTitle = !!(cloned.title && !Array.isArray(cloned.title));

    if (cloned.grid && !Array.isArray(cloned.grid)) {
        cloned.grid = {
            ...cloned.grid,
            top: hasLegend ? 88 : (hasTitle ? 56 : cloned.grid.top),
            bottom: 3,
            left: 3,
            right: 2
        };
    }

    if (hasTitle) {
        cloned.title = {
            ...cloned.title,
            top: 8,
            left: 3,
            textStyle: {
                ...(cloned.title.textStyle || {}),
                color: '#dbe2ea',
                fontSize: 15,
                fontWeight: 600
            }
        };
    }

    if (hasLegend) {
        const legendData = Array.isArray(cloned.legend.data) ? cloned.legend.data : [];
        cloned.legend = {
            ...cloned.legend,
            top: 28,
            left: 3,
            itemWidth: 12,
            itemHeight: 8,
            itemGap: 10,
            icon: 'roundRect',
            data: legendData.map(item => typeof item === 'string'
                ? { name: item, icon: 'roundRect' }
                : { ...item, icon: item.icon || 'roundRect' }),
            textStyle: {
                ...(cloned.legend.textStyle || {}),
                color: '#aeb7c4',
                fontSize: 12
            }
        };
    }

    return cloned;
}
