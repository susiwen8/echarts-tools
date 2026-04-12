export declare type TerminalColor = [number, number, number];
declare type ResolveTerminalColorOpts = {
    opacity?: number;
    minLuminance?: number;
};
export declare const ANSI_RESET = "\u001B[0m";
export declare function resolveTerminalColor(color: unknown, opts?: ResolveTerminalColorOpts): TerminalColor;
export declare function toAnsiForeground(color: TerminalColor): string;
export declare function toAnsiBackground(color: TerminalColor): string;
export {};
