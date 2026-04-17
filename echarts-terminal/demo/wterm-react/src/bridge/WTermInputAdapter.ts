type TerminalChunk = string | Uint8Array;
type DataListener = (chunk: TerminalChunk) => void;

export class WTermInputAdapter {
    isTTY = true;
    private readonly listeners = new Set<DataListener>();
    private paused = false;

    on(event: 'data', listener: DataListener) {
        if (event === 'data') {
            this.listeners.add(listener);
        }
        return this;
    }

    off(event: 'data', listener: DataListener) {
        if (event === 'data') {
            this.listeners.delete(listener);
        }
        return this;
    }

    removeListener(event: 'data', listener: DataListener) {
        return this.off(event, listener);
    }

    resume() {
        this.paused = false;
        return this;
    }

    pause() {
        this.paused = true;
        return this;
    }

    setRawMode() {
        return this;
    }

    emit(chunk: TerminalChunk) {
        if (this.paused) {
            return;
        }
        for (const listener of this.listeners) {
            listener(chunk);
        }
    }
}

export default WTermInputAdapter;
