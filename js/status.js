import { CATALOG, SYMBOLS } from './catalog.js';
import { $, isCoarse } from './dom.js';
import { hasGroupInSel } from './groups.js';
import { updateUndoFab } from './history.js';
import { updatePlanApply } from './planpanel.js';
import { anySelected } from './selection.js';
import { ST } from './state.js';
import { updateToolChip } from './tools.js';

// ---------------- status
export function updateCursor(w){}
export function updateStatus(){
  $('st-zoom').textContent = Math.round(ST.view.scale*100)+'%';
  // mobile: floating 45deg rotate buttons while pieces are selected (the drag
  // handle on top stays the free-rotation control)
  updateUndoFab(); updateToolChip(); updatePlanApply();
  const ghost = CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp);
  // Annotating earns the fullscreen board for the same reason placing does:
  // you are working on the map and every panel is a piece of it you cannot see.
  const annot = ST.tool==='draw' || ST.tool==='erase' || ST.tool==='text' || !!SYMBOLS[ST.tool];
  // phone: aiming or moving a piece clears the chrome off the board, so the
  // whole screen is the thing you are aiming at (see .focus-edit)
  const app=document.querySelector('.app');
  const building = !!anySelected() || !!ghost || annot || ST.buildHold;
  if(app) app.classList.toggle('focus-edit', isCoarse() && building);
  // the structure sheet belongs to placement; leaving it takes the sheet too.
  // Closed here rather than through rail.js, which imports tools.js and would
  // make the pair a cycle.
  const kit=$('kit-sheet');
  if(kit && !kit.hidden && !ghost && !annot){ kit.hidden=true; kit.innerHTML=''; }
  const rf=$('rot-fab'); if(rf){
    rf.classList.toggle('show', isCoarse() && building);
    rf.classList.toggle('ghost', !!ghost && !anySelected());
    // ink has no rotation or mirror to offer, so its bar is the kit and the hand
    rf.classList.toggle('annot', annot && !anySelected());
    // held with nothing armed and nothing picked: the bar keeps only the way
    // back to a structure
    rf.classList.toggle('hold', !ghost && !annot && !anySelected() && ST.buildHold);
    const total=ST.selected.length+ST.selImages.length+ST.selTexts.length+ST.selStrokes.length;
    const g=$('fab-group'), u=$('fab-ungroup');
    if(g) g.style.display = total>=2 ? '' : 'none';
    if(u) u.style.display = hasGroupInSel() ? '' : 'none';
  }
}
