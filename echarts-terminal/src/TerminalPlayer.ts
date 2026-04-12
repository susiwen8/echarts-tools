const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';
const CLEAR_DOWN = '\u001b[0J';

export type TerminalOutput = {
    write(chunk: string): unknown
};

export type TerminalPlayerOptions = {
    output?: TerminalOutput | null
    autoRender?: boolean
    hideCursor?: boolean
    clearOnStop?: boolean
};

export type TerminalChartController = {
    renderToTerminalString?: () => string
    setOption?: (...args: any[]) => unknown
    resize?: (...args: any[]) => unknown
    dispose?: (...args: any[]) => unknown
};

export type TerminalPlayer = {
    render(): string
    clear(): void
    stop(): void
    isActive(): boolean
};

const activePlayers = new WeakMap<object, TerminalPlayer>();

function resolveDefaultOutput() {
    const processLike = (globalThis as typeof globalThis & {
        process?: {
            stdout?: TerminalOutput
        }
    }).process;
    return processLike && processLike.stdout ? processLike.stdout : null;
}

function moveToFrameStart(lineCount: number) {
    if (lineCount <= 0) {
        return '\r';
    }
    return `\u001b[${lineCount}A\r`;
}

export default function createTerminalPlayer(
    chart: TerminalChartController,
    opts: TerminalPlayerOptions = {}
): TerminalPlayer {
    const existing = activePlayers.get(chart as object);
    if (existing && existing.isActive()) {
        return existing;
    }

    const output = opts.output === undefined ? resolveDefaultOutput() : opts.output;
    const autoRender = opts.autoRender !== false;
    const hideCursor = opts.hideCursor !== false;
    const clearOnStop = opts.clearOnStop !== false;

    const rawSetOption = chart.setOption ? chart.setOption.bind(chart) : null;
    const rawResize = chart.resize ? chart.resize.bind(chart) : null;
    const rawDispose = chart.dispose ? chart.dispose.bind(chart) : null;

    let active = true;
    let cursorHidden = false;
    let rendered = false;
    let lastLineCount = 0;

    function write(chunk: string) {
        if (output && chunk) {
            output.write(chunk);
        }
    }

    function clearFrame(showCursor: boolean) {
        if (!rendered || !lastLineCount) {
            if (showCursor && hideCursor && cursorHidden) {
                write(SHOW_CURSOR);
                cursorHidden = false;
            }
            return;
        }

        let chunk = moveToFrameStart(lastLineCount) + CLEAR_DOWN;
        if (showCursor && hideCursor && cursorHidden) {
            chunk += SHOW_CURSOR;
            cursorHidden = false;
        }
        write(chunk);
        rendered = false;
        lastLineCount = 0;
    }

    const player: TerminalPlayer = {
        render() {
            if (!chart.renderToTerminalString) {
                throw new Error('createTerminalPlayer requires a terminal chart.');
            }
            const frame = chart.renderToTerminalString();
            const lineCount = frame ? frame.split('\n').length : 0;
            if (output) {
                let chunk = '';
                if (hideCursor && !cursorHidden) {
                    chunk += HIDE_CURSOR;
                    cursorHidden = true;
                }
                if (rendered && lastLineCount) {
                    chunk += moveToFrameStart(lastLineCount) + CLEAR_DOWN;
                }
                chunk += frame;
                if (lineCount) {
                    chunk += '\n';
                }
                write(chunk);
            }
            rendered = true;
            lastLineCount = lineCount;
            return frame;
        },
        clear() {
            clearFrame(false);
        },
        stop() {
            if (!active) {
                return;
            }
            active = false;
            if (autoRender) {
                if (rawSetOption) {
                    chart.setOption = rawSetOption;
                }
                if (rawResize) {
                    chart.resize = rawResize;
                }
                if (rawDispose) {
                    chart.dispose = rawDispose;
                }
            }
            if (clearOnStop) {
                clearFrame(true);
            }
            else if (hideCursor && cursorHidden) {
                write(SHOW_CURSOR);
                cursorHidden = false;
            }
            activePlayers.delete(chart as object);
        },
        isActive() {
            return active;
        }
    };

    if (autoRender) {
        if (rawSetOption) {
            chart.setOption = function patchedTerminalSetOption(...args: any[]) {
                const result = rawSetOption(...args);
                if (active) {
                    player.render();
                }
                return result;
            };
        }
        if (rawResize) {
            chart.resize = function patchedTerminalResize(...args: any[]) {
                const result = rawResize(...args);
                if (active) {
                    player.render();
                }
                return result;
            };
        }
        if (rawDispose) {
            chart.dispose = function patchedTerminalDispose(...args: any[]) {
                player.stop();
                return rawDispose(...args);
            };
        }
    }

    activePlayers.set(chart as object, player);
    return player;
}
