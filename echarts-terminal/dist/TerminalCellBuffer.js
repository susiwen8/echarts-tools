import { ANSI_RESET, toAnsiBackground, toAnsiForeground } from './terminalColor.js';
function colorKey(color) {
    return color ? color.join(',') : '';
}
export default class TerminalCellBuffer {
    constructor(width, height) {
        this.width = Math.max(0, Math.round(width || 0));
        this.height = Math.max(0, Math.round(height || 0));
        this.logicalHeight = this.height * 2;
        this._foregroundPixels = new Array(this.width * this.logicalHeight).fill(null);
        this._backgroundPixels = new Array(this.width * this.logicalHeight).fill(null);
        this._text = new Array(this.width * this.height).fill(null);
    }
    setPixel(x, y, color, overwrite = true) {
        const xi = Math.round(x);
        const yi = Math.round(y);
        if (!color || xi < 0 || yi < 0 || xi >= this.width || yi >= this.logicalHeight) {
            return;
        }
        const index = yi * this.width + xi;
        if (overwrite) {
            this._foregroundPixels[index] = color;
        }
        else {
            this._backgroundPixels[index] = color;
        }
    }
    _cellHasForeground(x, row) {
        const upperY = row * 2;
        const lowerY = upperY + 1;
        const upperIndex = upperY * this.width + x;
        const lowerIndex = lowerY * this.width + x;
        return !!this._foregroundPixels[upperIndex] || !!this._foregroundPixels[lowerIndex];
    }
    drawText(x, y, text, color) {
        if (!text) {
            return;
        }
        const row = Math.round(y);
        if (row < 0 || row >= this.height) {
            return;
        }
        const chars = Array.from(text);
        let col = Math.round(x);
        for (let i = 0; i < chars.length; i++) {
            if (col >= 0 && col < this.width) {
                this._text[row * this.width + col] = {
                    char: chars[i],
                    color
                };
            }
            col++;
            if (col >= this.width) {
                break;
            }
        }
    }
    toString() {
        const lines = [];
        for (let row = 0; row < this.height; row++) {
            let line = '';
            let currentFg = '';
            let currentBg = '';
            for (let col = 0; col < this.width; col++) {
                const textOverlay = this._text[row * this.width + col];
                if (textOverlay) {
                    const nextFg = colorKey(textOverlay.color);
                    if (nextFg !== currentFg || currentBg) {
                        line += ANSI_RESET;
                        currentBg = '';
                        currentFg = '';
                    }
                    if (nextFg && nextFg !== currentFg) {
                        line += toAnsiForeground(textOverlay.color);
                        currentFg = nextFg;
                    }
                    line += textOverlay.char;
                    continue;
                }
                const topForeground = this._foregroundPixels[(row * 2) * this.width + col];
                const bottomForeground = this._foregroundPixels[(row * 2 + 1) * this.width + col];
                const hasForeground = this._cellHasForeground(col, row);
                const top = hasForeground
                    ? topForeground
                    : this._backgroundPixels[(row * 2) * this.width + col];
                const bottom = hasForeground
                    ? bottomForeground
                    : this._backgroundPixels[(row * 2 + 1) * this.width + col];
                const topKey = colorKey(top);
                const bottomKey = colorKey(bottom);
                let glyph = ' ';
                let nextFg = '';
                let nextBg = '';
                if (top && bottom) {
                    if (topKey === bottomKey) {
                        glyph = '█';
                        nextFg = topKey;
                    }
                    else {
                        glyph = '▀';
                        nextFg = topKey;
                        nextBg = bottomKey;
                    }
                }
                else if (top) {
                    glyph = '▀';
                    nextFg = topKey;
                }
                else if (bottom) {
                    glyph = '▄';
                    nextFg = bottomKey;
                }
                if (nextFg !== currentFg || nextBg !== currentBg) {
                    line += ANSI_RESET;
                    currentFg = '';
                    currentBg = '';
                    if (nextFg) {
                        line += toAnsiForeground(nextFg === topKey ? (top || bottom) : bottom);
                        currentFg = nextFg;
                    }
                    if (nextBg) {
                        line += toAnsiBackground(bottom);
                        currentBg = nextBg;
                    }
                }
                line += glyph;
            }
            lines.push(line + ANSI_RESET);
        }
        return lines.join('\n');
    }
}
