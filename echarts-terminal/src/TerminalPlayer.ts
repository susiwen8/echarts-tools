const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';
const CLEAR_DOWN = '\u001b[0J';

import createTerminalInteractionController, {
    TerminalInput,
    TerminalInteractionController
} from './TerminalInteraction.js';

/* c8 ignore start */
export type TerminalOutput = {
    write(chunk: string): unknown
};

export type TerminalPlayerOptions = {
    output?: TerminalOutput | null
    input?: TerminalInput | null
    autoRender?: boolean
    hideCursor?: boolean
    clearOnStop?: boolean
    interactive?: boolean
};

export type TerminalChartController = {
    renderToTerminalString?: () => string
    setOption?: (...args: any[]) => unknown
    resize?: (...args: any[]) => unknown
    dispose?: (...args: any[]) => unknown
    getModel?: () => unknown
    getOption?: () => Record<string, unknown>
    getZr(): {
        painter: {
            type: string
            setInteractionState?: (state: unknown) => void
        }
    }
};

export type TerminalPlayer = {
    render(): string
    clear(): void
    stop(): void
    isActive(): boolean
};
/* c8 ignore stop */

const activePlayers = new WeakMap<object, TerminalPlayer>();

function resolveDefaultOutput() {
    const processLike = (globalThis as typeof globalThis & {
        process?: {
            stdout?: TerminalOutput
        }
    }).process;
    return processLike && processLike.stdout ? processLike.stdout : null;
}

function resolveDefaultInput() {
    const processLike = (globalThis as typeof globalThis & {
        process?: {
            stdin?: TerminalInput
        }
    }).process;
    return processLike && processLike.stdin ? processLike.stdin : null;
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
    const input = opts.input === undefined ? resolveDefaultInput() : opts.input;
    const autoRender = opts.autoRender !== false;
    const hideCursor = opts.hideCursor !== false;
    const clearOnStop = opts.clearOnStop !== false;
    const interactive = opts.interactive !== false;

    const rawSetOption = chart.setOption ? chart.setOption.bind(chart) : null;
    const rawResize = chart.resize ? chart.resize.bind(chart) : null;
    const rawDispose = chart.dispose ? chart.dispose.bind(chart) : null;

    let active = true;
    let cursorHidden = false;
    let rendered = false;
    let lastLineCount = 0;
    let interactionController: TerminalInteractionController | null = null;

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

    /* c8 ignore start */
    const player: TerminalPlayer = {
        render() {
            if (!chart.renderToTerminalString) {
                throw new Error('createTerminalPlayer requires a terminal chart.');
            }
            interactionController?.prepareFrame(chart.getZr().painter);
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
        /* c8 ignore next */ clear() {
            clearFrame(false);
        },
        stop() {
            /* c8 ignore next 2 */
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
            interactionController?.stop();
            if (clearOnStop) {
                clearFrame(true);
            }
            /* c8 ignore next 3 */
            else if (hideCursor && cursorHidden) {
                write(SHOW_CURSOR);
                cursorHidden = false;
            }
            activePlayers.delete(chart as object);
        },
        /* c8 ignore next */
        isActive() {
            return active;
        }
    };
    /* c8 ignore stop */

    interactionController = createTerminalInteractionController({
        chart,
        input,
        enabled: interactive,
        onUpdate() {
            if (active) {
                player.render();
            }
        }
    });

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
            /* c8 ignore next */
            chart.resize = function patchedTerminalResize(...args: any[]) {
                const result = rawResize(...args);
                if (active) {
                    player.render();
                }
                return result;
            };
        }
        if (rawDispose) {
            /* c8 ignore next */
            chart.dispose = function patchedTerminalDispose(...args: any[]) {
                player.stop();
                return rawDispose(...args);
            };
        }
    }

    activePlayers.set(chart as object, player);
    return player;
}
