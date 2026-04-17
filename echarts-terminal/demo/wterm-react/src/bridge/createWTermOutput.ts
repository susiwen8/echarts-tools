type WTermWrite = (data: string | Uint8Array) => void;

export function createWTermOutput(write: WTermWrite) {
    return {
        write(chunk: string) {
            if (chunk) {
                write(chunk);
            }
        }
    };
}

export default createWTermOutput;
