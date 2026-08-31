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
  const rf=$('rot-fab'); if(rf){
    rf.classList.toggle('show', isCoarse() && (!!anySelected() || !!ghost));
    rf.classList.toggle('ghost', !!ghost && !anySelected());
    const total=ST.selected.length+ST.selImages.length+ST.selTexts.length+ST.selStrokes.length;
    const g=$('fab-group'), u=$('fab-ungroup');
    if(g) g.style.display = total>=2 ? '' : 'none';
    if(u) u.style.display = hasGroupInSel() ? '' : 'none';
  }
}
