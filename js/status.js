import { CATALOG } from './catalog.js';
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
  // phone: aiming or moving a piece clears the chrome off the board, so the
  // whole screen is the thing you are aiming at (see .focus-edit)
  const app=document.querySelector('.app');
  const building = !!anySelected() || !!ghost || ST.buildHold;
  if(app) app.classList.toggle('focus-edit', isCoarse() && building);
  // the structure sheet belongs to placement; leaving it takes the sheet too.
  // Closed here rather than through rail.js, which imports tools.js and would
  // make the pair a cycle.
  const kit=$('kit-sheet');
  if(kit && !kit.hidden && !ghost){ kit.hidden=true; kit.innerHTML=''; }
  const rf=$('rot-fab'); if(rf){
    rf.classList.toggle('show', isCoarse() && building);
    rf.classList.toggle('ghost', !!ghost && !anySelected());
    // held with nothing armed and nothing picked: the bar keeps only the way
    // back to a structure
    rf.classList.toggle('hold', !ghost && !anySelected() && ST.buildHold);
    const total=ST.selected.length+ST.selImages.length+ST.selTexts.length+ST.selStrokes.length;
    const g=$('fab-group'), u=$('fab-ungroup');
    if(g) g.style.display = total>=2 ? '' : 'none';
    if(u) u.style.display = hasGroupInSel() ? '' : 'none';
  }
}
