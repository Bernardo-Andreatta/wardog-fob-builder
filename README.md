# Wardog FOB Builder

A top-down grid editor for laying out **Forward Operating Bases** (FOBs). Spawn tactical
structures, snap them to a grid, rotate and box-select groups, duplicate, and free-draw
annotations — all in a single self-contained HTML file (no build step, no dependencies).

## Run it

Open `index.html` in any modern browser. That's it.

## Structures

| Structure     | Footprint |
|---------------|-----------|
| Single Wall   | 1×1       |
| Door          | 1×1       |
| Barbed Wire   | 2×1       |
| Sandbags      | 2×1       |
| Quadra Wall   | 4×1       |
| Gate          | 4×1       |
| Bunker        | 4×4       |
| Lookout Tower | 4×4       |

Each is drawn as clean, symmetric top-down vector art on an HTML5 canvas.

## Controls

- **Place** — pick a structure in the left rail, then click the grid (stays armed to place more).
- **Select** — click a piece; drag empty ground to box-select; `Shift`/`Ctrl`+click to add/remove.
- **Move** — drag a selected piece (moves the whole selection, snapped to grid).
- **Rotate** — `R` / `Shift+R`, or the Rotate button; a group rotates rigidly (keeps its shape).
  A single piece also has a free-rotate handle.
- **Duplicate** — Duplicate button or `Ctrl+D` (copies the whole selection).
- **Delete** — `Del` / Backspace, or the Delete button.
- **Draw / Erase** — free-hand pen with colour + width; the eraser removes strokes.
- **View** — scroll to zoom, `Space`-drag / middle-drag to pan.
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Save** — Export/Import layouts as JSON, or Export a PNG. Layouts also auto-save to the browser.

## Snapping

Snapping is footprint-aware: odd-width pieces centre inside a cell, even-width pieces sit on
grid lines, so everything tiles flush. Major grid lines mark 4×4 blocks.

## Tech

Vanilla HTML/CSS/JavaScript, HTML5 Canvas. Theme-aware (tactical dark / desert light).
