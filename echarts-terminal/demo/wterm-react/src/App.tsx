import { useCallback, useEffect, useMemo, useState } from 'react';
import { Terminal, useTerminal } from '@wterm/react';
import '@wterm/react/css';
import WTermInputAdapter from './bridge/WTermInputAdapter';
import { sizePresets, showcaseOptions, terminalThemes } from './showcaseOptions';
import useEchartsTerminalWTerm from './bridge/useEchartsTerminalWTerm';

function findPresetId(cols: number, rows: number) {
    return sizePresets.find(preset => preset.cols === cols && preset.rows === rows)?.id ?? 'custom';
}

export default function App() {
    const [chartId, setChartId] = useState<string>(showcaseOptions[0].id);
    const [themeId, setThemeId] = useState<string>(terminalThemes[0].id);
    const [cols, setCols] = useState<number>(sizePresets[1].cols);
    const [rows, setRows] = useState<number>(sizePresets[1].rows);
    const [terminalReady, setTerminalReady] = useState(false);
    const [presetId, setPresetId] = useState<string>(sizePresets[1].id);
    const inputAdapter = useMemo(() => new WTermInputAdapter(), []);
    const { ref, write, resize, focus } = useTerminal();

    const selectedShowcase = showcaseOptions.find(option => option.id === chartId) ?? showcaseOptions[0];
    const selectedTheme = terminalThemes.find(theme => theme.id === themeId) ?? terminalThemes[0];

    useEffect(() => {
        setPresetId(findPresetId(cols, rows));
    }, [cols, rows]);

    useEffect(() => {
        if (terminalReady) {
            resize(cols, rows);
        }
    }, [cols, resize, rows, terminalReady]);

    const { rerender, resetSession } = useEchartsTerminalWTerm({
        cols,
        rows,
        option: selectedShowcase.option,
        terminalReady,
        write,
        input: inputAdapter
    });

    const handleData = useCallback((data: string) => {
        inputAdapter.emit(data);
    }, [inputAdapter]);

    const applyPreset = useCallback((nextPresetId: string) => {
        const preset = sizePresets.find(item => item.id === nextPresetId);
        if (!preset) {
            return;
        }
        setCols(preset.cols);
        setRows(preset.rows);
        setPresetId(preset.id);
    }, []);

    return (
        <div className="demo-page">
            <header className="hero">
                <div>
                    <p className="eyebrow">Browser demo</p>
                    <h1>echarts-terminal × wterm</h1>
                    <p className="hero-copy">
                        `echarts-terminal` keeps rendering ANSI frames, while `wterm` provides a DOM terminal surface in the browser.
                    </p>
                </div>
                <div className="hero-actions">
                    <button type="button" onClick={() => focus()}>Focus terminal</button>
                    <button type="button" onClick={() => rerender()}>Rerender</button>
                    <button type="button" onClick={() => resetSession()}>Reset session</button>
                </div>
            </header>

            <section className="control-grid">
                <label>
                    <span>Chart</span>
                    <select value={chartId} onChange={event => setChartId(event.target.value)}>
                        {showcaseOptions.map(option => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Theme</span>
                    <select value={themeId} onChange={event => setThemeId(event.target.value)}>
                        {terminalThemes.map(theme => (
                            <option key={theme.id} value={theme.id}>{theme.label}</option>
                        ))}
                    </select>
                </label>

                <label>
                    <span>Size preset</span>
                    <select value={presetId} onChange={event => applyPreset(event.target.value)}>
                        {sizePresets.map(preset => (
                            <option key={preset.id} value={preset.id}>
                                {preset.label} ({preset.cols}×{preset.rows})
                            </option>
                        ))}
                        <option value="custom">Custom</option>
                    </select>
                </label>

                <label>
                    <span>Cols</span>
                    <input
                        type="number"
                        min={40}
                        max={140}
                        value={cols}
                        onChange={event => setCols(Number(event.target.value) || 72)}
                    />
                </label>

                <label>
                    <span>Rows</span>
                    <input
                        type="number"
                        min={12}
                        max={40}
                        value={rows}
                        onChange={event => setRows(Number(event.target.value) || 22)}
                    />
                </label>
            </section>

            <section className="info-card">
                <div>
                    <h2>{selectedShowcase.label}</h2>
                    <p>{selectedShowcase.description}</p>
                </div>
                <ul>
                    <li><kbd>Enter</kbd> start interaction mode</li>
                    <li><kbd>←</kbd> / <kbd>→</kbd> move across points</li>
                    <li><kbd>↑</kbd> / <kbd>↓</kbd> switch series</li>
                    <li><kbd>Esc</kbd> exit interaction mode</li>
                </ul>
            </section>

            <main className="terminal-shell">
                <Terminal
                    ref={ref}
                    cols={cols}
                    rows={rows}
                    theme={selectedTheme.theme}
                    cursorBlink
                    onData={handleData}
                    onReady={() => setTerminalReady(true)}
                    className="terminal-frame"
                />
            </main>
        </div>
    );
}
