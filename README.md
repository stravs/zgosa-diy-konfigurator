# Zgosa DIY Konfigurator

Browser-based 3D skate park configurator for Zgosa DIY layouts.

Built with plain JavaScript and Three.js. No React, no backend.

## Features

- 3D skate park scene editor
- Prefab obstacles from the Warehouse drawer
- Scene drawer with placed objects and groups
- Move, rotate, measure, group, ungroup
- Save and load JSON scene data
- Mobile-friendly drawer UI
- Base `zgosa.json` model loads on startup and is locked from editing

## Run locally

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

For phone testing on same Wi-Fi:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open your computer LAN IP on the phone:

```text
http://YOUR_IP:8000
```

## Controls

- Middle mouse drag: orbit
- Right mouse drag: pan
- Wheel: zoom
- Space: move tool
- R: rotate tool
- M: measure tool
- Delete / Backspace: delete selected
- Ctrl/Cmd + D: duplicate
- Ctrl/Cmd + G: group
- Ctrl/Cmd + Shift + G: ungroup
- Ctrl/Cmd + Z: undo
- Ctrl/Cmd + Y: redo

## Mobile

- One finger: orbit
- Two finger slide: pan
- Two finger pinch: zoom
- Long press ground: open Warehouse
- Long press object: select object

## Data

Scene state is stored as JSON. The startup base scene is loaded from:

```text
zgosa.json
```
