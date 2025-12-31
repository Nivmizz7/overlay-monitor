# overlay-monitor

Web monitor that watches `overlay.json` and renders a live table of changes
(added/removed/changed values with old/new values).

## Run

```bash
npm start
```

Optional environment variables:

- `PORT` (default: `3000`)
- `TARGET_FILE` (default: `../tarkov-data-overlay-niv/dist/overlay.json`)
