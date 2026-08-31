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
down, select them and hit **Set stage → <name>** / **Set builder → <name>**.

- **Highlight** has four modes. *Stage* and *Builder* colour the piece outlines;
  *Both* shows the two at once — the outline is the stage colour, and the piece is
  washed in its builder's colour with a hatch at that builder's own angle, so the
  builders stay apart in greyscale or if the colours are hard to tell apart.
- The **eye** on a row filters that stage/builder off the board (hidden pieces
  can't be selected either) — handy for working on one phase at a time.
- Removing a tag never deletes pieces; they just become *Unassigned*.

Tags travel with the layout: autosave, undo/redo, `.json` export and share codes
all carry them.

## Image export

**Export / Import → Export image** renders a set of schematic sheets. Pick any
combination of:

- Whole build
- All stages, colour-coded · one sheet per stage (optionally cumulative: 1, 1–2, 1–3…)
- All builders, colour-coded · one sheet per builder

Every sheet is framed on the whole build — snapped out to whole blocks — and every
sheet in a run comes out at exactly the same pixel size, so they overlay and flip
cleanly. On top of the map each one carries what a builder needs on site:

- a **title bar** with the build name, what the sheet shows, and the footprint in blocks
- a **badge** in the corner naming the stage or builder the sheet is for
- **block rulers** down the top and left edges, ticked every block and numbered every 4
- a **legend** listing only the stages / builders actually on that sheet, with piece counts

**Quality** is set in pixels per block (40 / 80 / 120 / 200), so a large base
exports at the same detail as a small one and stays readable when zoomed. A sheet
too large for the browser's canvas limit is scaled back, and the dialog says so.

With more than one sheet selected, **Package as a .zip folder** delivers a single
download: a folder named after the build holding every sheet in build order
(`01-whole-build.png`, `02-all-stages.png`, `03-stage-1-early.png`, …) plus a
`00-build-info.txt` with the footprint, piece total, and the stage/builder tallies.

Other options: mark builders with a hatch fill (stage-coloured sheets then carry
both dimensions), ghost the pieces left out of a view, draw the grid, and include
drawings & labels. Choices are remembered.

## Tech

Vanilla HTML/CSS/JavaScript, HTML5 Canvas. Theme-aware (tactical dark / desert light).
