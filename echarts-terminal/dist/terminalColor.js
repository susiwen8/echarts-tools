import { parse } from 'zrender/lib/tool/color.js';
export const ANSI_RESET = '\u001b[0m';
const TERMINAL_BG = [15, 23, 42];
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
export function resolveTerminalColor(color, opts) {
    const opacity = opts && opts.opacity;
    const minLuminance = opts && opts.minLuminance || 0;
    if (!color) {
        return null;
    }
    if (typeof color === 'string') {
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
            const stopColor = resolveTerminalColor(colorStops[i].color, { opacity, minLuminance });
            stopColor && stops.push(stopColor);
        }
        if (!stops.length) {
            return null;
        }
        return normalizeForDarkBackground([
            averageChannel(stops.map(item => item[0])),
            averageChannel(stops.map(item => item[1])),
            averageChannel(stops.map(item => item[2]))
        ], minLuminance);
    }
    return null;
}
export function toAnsiForeground(color) {
    return `\u001b[38;2;${color[0]};${color[1]};${color[2]}m`;
}
export function toAnsiBackground(color) {
    return `\u001b[48;2;${color[0]};${color[1]};${color[2]}m`;
}
