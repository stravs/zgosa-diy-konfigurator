# Skate Park Configurator MVP Plan

## Product goal
Build a simple online 3D skate park configurator/editor.

This is **not** a full SketchUp-style modeler.

User should be able to:
- place prefab skate obstacles
- move and rotate them on a grid
- edit basic dimensions
- save and load layouts as JSON

## MVP scope

### Core scene
- ground plane
- grid
- simple sky/background
- basic lighting
- orbit / pan / zoom camera

### Object library
Start with a small catalog:
- quarter pipe
- box
- ledge
- rail
- bank
- stairs
- funbox

### Placement and editing
- click library item to spawn object
- place at origin or cursor hit on ground
- click object to select
- drag selected object on ground plane
- snap movement to grid
- rotate selected object in fixed steps
- delete object
- duplicate object

### Properties panel
Per selected object:
- position X/Z
- rotation Y
- width
- length
- height
- piece-specific params later if needed

### Persistence
- save scene to JSON
- load scene from JSON
- reset scene

## Out of scope for MVP
Do not build these yet:
- custom ramp design
- full SketchUp-style modeling tools
- multiplayer
- physics / skating simulation
- terrain editing
- texture editor
- collision system
- auth/accounts
- backend
- CAD export
- complex undo/redo system

## Tech direction
- Three.js
- plain JavaScript (no React)
- JSON as source of truth for scene state

## Architecture

### Suggested file structure
- `index.html`
- `src/main.js`
- `src/scene.js`
- `src/camera.js`
- `src/controls.js`
- `src/editor.js`
- `src/selection.js`
- `src/dragging.js`
- `src/grid.js`
- `src/catalog/`
  - `quarterPipe.js`
  - `box.js`
  - `ledge.js`
  - `rail.js`
  - `bank.js`
- `src/state/store.js`
- `src/state/serialize.js`
- `src/ui/sidebar.js`
- `src/ui/toolbar.js`

### State rules
- JSON state is the source of truth
- do not serialize raw Three.js objects
- keep object `type` separate from editable `params`
- meshes should be rebuilt from state

### Example state shape
```json
{
  "version": 1,
  "scene": {
    "gridSize": 0.25,
    "units": "m"
  },
  "objects": [
    {
      "id": "obj_1",
      "type": "quarterPipe",
      "position": { "x": 2, "y": 0, "z": 4 },
      "rotation": { "x": 0, "y": 1.5708, "z": 0 },
      "params": {
        "width": 2.4,
        "height": 1.2,
        "depth": 2.0
      }
    }
  ]
}
```

## Modeling strategy
Use simple procedural geometry for MVP.

Examples:
- ledge = box
- manual pad = box
- rail = cylinders + supports
- bank = wedge mesh
- quarter pipe = generated curved profile

This keeps resizing and JSON serialization simple.

## Interaction model

### Camera
- left mouse: orbit
- right mouse: pan
- wheel: zoom

### Selection
- click object to select

### Move
- drag selected object on ground plane

### Rotate
- keyboard `R` rotates selected object by +90°
  - or sidebar rotate buttons

### Delete
- `Delete` key

### Duplicate
- `Ctrl+D`

## UI plan

### Left panel
Object library:
- Quarter Pipe
- Box
- Ledge
- Rail
- Bank
- Stairs
- Funbox

### Right panel
Selected object properties:
- type
- X/Z position
- rotation
- width / length / height
- delete
- duplicate

### Top bar
- new
- save JSON
- load JSON
- snap toggle

## Main risks

### 1. Selection and dragging
Need:
- raycast to object
- raycast to ground plane
- drag offset so object does not jump

### 2. Geometry updates
When params change:
- rebuild mesh cleanly
- dispose old geometry/material if replaced
- keep object id stable

### 3. State drift
Rule:
- state and rendered mesh must stay in sync
- avoid direct mesh edits that do not update state

### 4. Piece pivots
Rule:
- every piece should sit correctly on ground at `y=0`
- pivot should be consistent and logical for placement/rotation

## Milestones

### Milestone 1: Scene shell
- app boot
- camera
- lights
- grid
- ground hit testing

### Milestone 2: Catalog and spawn
- 3 basic pieces
- click to add object
- render objects from JSON state

### Milestone 3: Selection and dragging
- click select
- highlight selected object
- drag on ground
- snap to grid

### Milestone 4: Property editing
- sidebar edits dimensions / rotation / position
- rebuild geometry on change

### Milestone 5: Save/load
- export JSON
- import JSON
- load from local file or text area

### Milestone 6: Polish
- duplicate/delete
- keyboard shortcuts
- better materials
- simple validation

## Recommended first pieces
Start with only:
- box
- ledge
- quarter pipe

If these work well, the rest will be easier.

## MVP definition of done
User can:
- place 3–7 prefab obstacles
- arrange them on a grid
- rotate and resize them
- save/load design JSON
- make a rough skate park layout in under 5 minutes

## Rough timeline
If scope stays tight:
- scene shell: 1 day
- object system: 1–2 days
- selection/dragging: 2 days
- property editing: 1–2 days
- save/load: 1 day
- polish/fixes: 2–3 days

Estimated MVP: 1–2 weeks solo.
