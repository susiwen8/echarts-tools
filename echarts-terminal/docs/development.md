# Development

## Common commands

```bash
npm run build
npm run smoke:contract
npm run smoke
npm run smoke:live-gallery
npm run showcase
npm run showcase:interactive
npm run showcase:live
```

## Browser visual regression

```bash
npm run visual:update
npm run visual:test
```

Report output:

- `test/visual/artifacts/latest/report.html`

## Real terminal screenshots

Terminal.app:

```bash
npm run visual:update:tty
```

iTerm2:

```bash
npm run visual:update:iterm2
```

Ghostty:

```bash
npm run visual:update:ghostty
```

Latest screenshot folders:

- `test/visual/terminal-app/`
- `test/visual/iterm2/`
- `test/visual/ghostty/`

README preview images:

- `docs/readme/`

## Real terminal baselines

Each terminal keeps its own baseline folder:

- `test/visual/baseline-terminal-app/`
- `test/visual/baseline-iterm2/`
- `test/visual/baseline-ghostty/`

To replace baselines with the current latest screenshots:

```bash
npm run visual:update:real-baseline
```

## Real terminal comparison

```bash
npm run visual:compare:real
```

Report output:

- `test/visual/artifacts/real-terminal-compare-latest/report.html`

The report includes:

- latest aligned screenshots for each terminal
- baseline aligned screenshots for each terminal
- latest vs baseline diffs for each terminal

## Notes

- Real terminal screenshot capture is macOS-only.
- Screen Recording / Automation permissions are required for the terminal app and the current shell host.
