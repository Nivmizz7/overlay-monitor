# overlay-monitor

Web monitor that watches each override file and renders the same correction
tables as the README, but live. Each file has its own page.

## Run

```bash
npm start
```

Optional environment variables:

- `PORT` (default: `3000`)
- `TARGET_TASKS` (default: `../tarkov-data-overlay-niv/src/overrides/tasks.json5`)
- `TARGET_HIDEOUT` (default: `../tarkov-data-overlay-niv/src/overrides/hideout.json5`)
- `TARGET_ITEMS` (default: `../tarkov-data-overlay-niv/src/overrides/items.json5`)
- `TARGET_TRADERS` (default: `../tarkov-data-overlay-niv/src/overrides/traders.json5`)
- `MAX_ROWS` (default: `200`)
