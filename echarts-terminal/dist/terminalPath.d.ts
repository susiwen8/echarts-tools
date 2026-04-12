import Path from 'zrender/lib/graphic/Path.js';
import TerminalCellBuffer from './TerminalCellBuffer.js';
import type { TerminalColor } from './terminalColor.js';
export declare function paintPath(buffer: TerminalCellBuffer, el: Path, fill: TerminalColor, stroke: TerminalColor, scaleX: number, scaleY: number, fillMode?: 'solid' | 'checker', strokeMode?: 'solid' | 'under'): void;
