# overlay-monitor

Simple web monitor that renders the README from `tarkov-data-overlay-niv` and refreshes automatically when it changes.

## Run

```bash
node server.js
```

Optional environment variables:

- `PORT` (default: `3000`)
- `TARGET_README` (default: `../tarkov-data-overlay-niv/README.md`)
