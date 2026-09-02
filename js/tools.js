import { CATALOG, SYMBOLS } from './catalog.js';
import { $, COARSE_MQ, isCoarse, stage } from './dom.js';
import { screenToWorld } from './geometry.js';
import { highlightRecent } from './icons.js';
import { render } from './render.js';
import { anySelected, clearOverlaySel, clearSelection } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';

// ---------------- tool selection
export function setTool(t){
  if(t!=='stamp') ST.activeStamp=null;   // leaving placement drops the ghost
  if(t==='select') ST.lastNavTool=t;
  // picking a tool drops the old selection, so rotate/mirror act on the new
  // ghost rather than on whatever was still selected behind it
  else { clearSelection(); clearOverlaySel(); }
  ST.tool=t;
  document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active', el.dataset.tool===t));
  highlightRecent();
  $('drawopts').classList.toggle('show', t==='draw'||!!SYMBOLS[t]);
  stage.classList.remove('c-cross','c-pan');
  if(CATALOG[t]||t==='draw'||t==='erase'||t==='stamp'||t==='text'||t==='eyedrop'||SYMBOLS[t]) stage.classList.add('c-cross');
  // touch: start the ghost centered on screen so there is always a visible
  // ghost to drag-aim and tap-confirm
  if(isCoarse() && (CATALOG[t] || (t==='stamp'&&ST.activeStamp)))
    ST.hover=screenToWorld(stage.clientWidth/2, stage.clientHeight/2);
  // mobile: no Esc / right-click, so surface a "Done" chip to leave the tool
  updateToolChip();
  updateStatus(); render();
}
// mobile Done chip: leaves a placement tool, or clears a selection. 'select' is
// the board's own mode - panning, selecting and moving all live there - so on
// its own it has nothing to finish.
export function inNavTool(){ return ST.tool==='select'; }
export function updateToolChip(){
  const ex=$('tool-exit'); if(!ex) return;
  ex.classList.toggle('show', isCoarse() && (!inNavTool() || !!anySelected()));
}

COARSE_MQ.addEventListener('change', updateToolChip);
// images and symbols drop in already selected so they can be positioned, which
// means leaving whatever placement tool put them there
export function editNewOverlay(){ setTool('select'); }
