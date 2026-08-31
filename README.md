# Wardogs FOB Builder

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

## Build planner (experimental)

The floating side panel (**Layers** in the top bar) has two tabs: *Layers* and
*Build Plan*. Under Build Plan, every piece carries two tags:

- **Stage** — *when* it goes down. Ships with Early (walls & basic structure), Mid
  (deployables) and Late (fluff & detail); add, rename, recolour or remove your own.
- **Builder** — *who* puts it there. Ships with Builder 1 and Builder 2.

New pieces take the active stage and builder. To re-tag pieces that are already
down, select them and hit **Stage → sel.** / **Builder → sel.**

- **Colour by** paints the board by stage or by builder, so you can see the plan at
  a glance.
- The **eye** on a row filters that stage/builder off the board (hidden pieces
  can't be selected either) — handy for working on one phase at a time.
- Removing a tag never deletes pieces; they just become *Unassigned*.

Tags travel with the layout: autosave, undo/redo, `.json` export and share codes
all carry them.

## Image export

**Export / Import → Export image** opens a dialog instead of dropping a single PNG.
Pick any combination of:

- Whole build
- All stages, colour-coded · one image per stage (optionally cumulative: stage 1, 1–2, 1–3…)
- All builders, colour-coded · one image per builder

Options: ghost the pieces left out of a view, draw the grid, include drawings &
labels, caption each image, and pick 1×–4× resolution. Your choices are remembered.

Every image is rendered into the **whole build's** frame, so the PNGs line up
exactly when you stack them or flip through them.

## Tech

Vanilla HTML/CSS/JavaScript, HTML5 Canvas. Theme-aware (tactical dark / desert light).
