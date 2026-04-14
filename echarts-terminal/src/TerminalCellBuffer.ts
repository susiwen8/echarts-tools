import { ANSI_RESET, toAnsiBackground, toAnsiForeground } from './terminalColor.js';
import type { TerminalColor } from './terminalColor.js';

/* c8 ignore start */
type TextOverlay = {
    char: string
    color: TerminalColor
};

function colorKey(color: TerminalColor): string {
    return color ? color.join(',') : '';
}

export default class TerminalCellBuffer {

    readonly width: number;
    readonly height: number;
    readonly logicalHeight: number;

    private _foregroundPixels: TerminalColor[];
    private _backgroundPixels: TerminalColor[];
    private _text: TextOverlay[];
/* c8 ignore stop */

    /* c8 ignore start */
    constructor(width: number, height: number) {
        this.width = Math.max(0, Math.round(width || 0));
        this.height = Math.max(0, Math.round(height || 0));
        this.logicalHeight = this.height * 2;
        this._foregroundPixels = new Array(this.width * this.logicalHeight).fill(null);
        this._backgroundPixels = new Array(this.width * this.logicalHeight).fill(null);
        this._text = new Array(this.width * this.height).fill(null);
    }
    /* c8 ignore stop */

    /* c8 ignore next */
    setPixel(x: number, y: number, color: TerminalColor, overwrite = true) {
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

    private _cellHasForeground(x: number, row: number) {
        const upperY = row * 2;
        const lowerY = upperY + 1;
        const upperIndex = upperY * this.width + x;
        const lowerIndex = lowerY * this.width + x;
        return !!this._foregroundPixels[upperIndex] || !!this._foregroundPixels[lowerIndex];
    }

    drawText(x: number, y: number, text: string, color: TerminalColor) {
        if (!text) {
            return;
        }
        const row = this._resolveTextRow(Math.round(x), y, text);
        if (row < 0 || row >= this.height) {
            return;
        }
        const chars = Array.from(text);
        let col = Math.round(x);
        for (let i = 0; i < chars.length; i++) {
            if (col >= 0 && col < this.width) {
                /* c8 ignore start */
                this._text[row * this.width + col] = {
                    char: chars[i],
                    color
                };
                /* c8 ignore stop */
            }
            col++;
            if (col >= this.width) {
                break;
            }
        }
    }

    private _resolveTextRow(x: number, y: number, text: string) {
        const targetRow = Math.round(y);
        if (this._canPlaceText(targetRow, x, text)) {
            return targetRow;
        }

        const preferredDirection = y - targetRow >= 0 ? 1 : -1;
        for (let distance = 1; distance < this.height; distance++) {
            const primary = targetRow + preferredDirection * distance;
            if (this._canPlaceText(primary, x, text)) {
                return primary;
            }
            const secondary = targetRow - preferredDirection * distance;
            if (this._canPlaceText(secondary, x, text)) {
                return secondary;
            }
        }

        return targetRow;
    }

    private _canPlaceText(row: number, x: number, text: string) {
        if (row < 0 || row >= this.height) {
            return false;
        }

        const chars = Array.from(text);
        let col = Math.round(x);
        let hasVisibleChars = false;

        for (let i = 0; i < chars.length; i++) {
            if (col >= 0 && col < this.width) {
                hasVisibleChars = true;
                if (this._text[row * this.width + col]) {
                    return false;
                }
            }
            col++;
            if (col >= this.width) {
                break;
            }
        }

        return hasVisibleChars;
    }

    toString() {
        const lines: string[] = [];
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
                        /* c8 ignore next */
                        line += toAnsiForeground(nextFg === topKey ? (top || bottom) as TerminalColor : bottom as TerminalColor);
                        currentFg = nextFg;
                    }
                    if (nextBg) {
                        line += toAnsiBackground(bottom as TerminalColor);
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
