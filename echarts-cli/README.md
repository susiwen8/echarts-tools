# echarts-cli

Offline knowledge CLI for Apache ECharts users.

## Commands

- `echarts list`
- `echarts info <name>`
- `echarts example <query> [id]`
- `echarts option [name]`

## Local Development

```bash
npm run build:data
npm run cli -- list
npm run cli -- info line --format json
```

## Notes

- Metadata is generated from the ECharts repository itself.
- The package prefers bundled `data/metadata.json` when present.
- Inside this repo, it can fall back to live source extraction for development.
