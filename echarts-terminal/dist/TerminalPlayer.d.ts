export declare type TerminalOutput = {
    write(chunk: string): unknown;
};
export declare type TerminalPlayerOptions = {
    output?: TerminalOutput | null;
    autoRender?: boolean;
    hideCursor?: boolean;
    clearOnStop?: boolean;
};
export declare type TerminalChartController = {
    renderToTerminalString?: () => string;
    setOption?: (...args: any[]) => unknown;
    resize?: (...args: any[]) => unknown;
    dispose?: (...args: any[]) => unknown;
};
export declare type TerminalPlayer = {
    render(): string;
    clear(): void;
    stop(): void;
    isActive(): boolean;
};
export default function createTerminalPlayer(chart: TerminalChartController, opts?: TerminalPlayerOptions): TerminalPlayer;
