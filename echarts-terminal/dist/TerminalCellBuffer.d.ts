import type { TerminalColor } from './terminalColor.js';
export default class TerminalCellBuffer {
    readonly width: number;
    readonly height: number;
    readonly logicalHeight: number;
    private _foregroundPixels;
    private _backgroundPixels;
    private _text;
    constructor(width: number, height: number);
    setPixel(x: number, y: number, color: TerminalColor, overwrite?: boolean): void;
    private _cellHasForeground;
    drawText(x: number, y: number, text: string, color: TerminalColor): void;
    private _resolveTextRow;
    private _canPlaceText;
    toString(): string;
}
