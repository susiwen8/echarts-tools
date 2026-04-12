import { TerminalInput } from './TerminalInteraction.js';
export declare type TerminalOutput = {
    write(chunk: string): unknown;
};
export declare type TerminalPlayerOptions = {
    output?: TerminalOutput | null;
    input?: TerminalInput | null;
    autoRender?: boolean;
    hideCursor?: boolean;
    clearOnStop?: boolean;
    interactive?: boolean;
};
export declare type TerminalChartController = {
    renderToTerminalString?: () => string;
    setOption?: (...args: any[]) => unknown;
    resize?: (...args: any[]) => unknown;
    dispose?: (...args: any[]) => unknown;
    getModel?: () => unknown;
    getOption?: () => Record<string, unknown>;
    getZr(): {
        painter: {
            type: string;
            setInteractionState?: (state: unknown) => void;
        };
    };
};
export declare type TerminalPlayer = {
    render(): string;
    clear(): void;
    stop(): void;
    isActive(): boolean;
};
export default function createTerminalPlayer(chart: TerminalChartController, opts?: TerminalPlayerOptions): TerminalPlayer;
