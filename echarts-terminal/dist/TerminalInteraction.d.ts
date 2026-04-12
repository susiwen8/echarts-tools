declare type UnknownRecord = Record<string, unknown>;
export declare type TerminalInput = {
    isTTY?: boolean;
    on(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
    off?(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
    removeListener?(event: 'data', listener: (chunk: string | Uint8Array) => void): unknown;
    resume?(): unknown;
    pause?(): unknown;
    setRawMode?(enabled: boolean): unknown;
};
export declare type TerminalInteractionRenderState = {
    active: boolean;
    infoText: string;
    kind: 'bar' | 'point';
    x: number;
    y: number;
    width?: number;
    height?: number;
    color: [number, number, number];
};
declare type TerminalPainterWithInteraction = {
    setInteractionState?: (state: TerminalInteractionRenderState | null) => void;
};
declare type TerminalChartForInteraction = {
    getModel?: () => any;
    getOption?: () => UnknownRecord;
};
declare type TerminalInteractionOptions = {
    chart: TerminalChartForInteraction;
    input?: TerminalInput | null;
    enabled?: boolean;
    onUpdate: () => void;
};
export declare type TerminalInteractionController = {
    isActive(): boolean;
    prepareFrame(painter: TerminalPainterWithInteraction): void;
    stop(): void;
};
export default function createTerminalInteractionController(opts: TerminalInteractionOptions): TerminalInteractionController | null;
export {};
