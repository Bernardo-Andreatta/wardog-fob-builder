import { CATALOG, SYMBOLS } from './catalog.js';
import { $, COARSE_MQ, isCoarse, stage } from './dom.js';
import { screenToWorld } from './geometry.js';
import { highlightRecent } from './icons.js';
import { commitPendingMove } from './pointer.js';
import { render } from './render.js';
import { anySelected, clearOverlaySel, clearSelection } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';

// ---------------- tool selection
export function setTool(t){
  commitPendingMove();                // don't strand a floating move on a tool change
  if(t!=='stamp') ST.activeStamp=null;   // leaving placement drops the ghost
  if(t==='select'||t==='pan') ST.lastNavTool=t;
  // picking a tool drops the old selection, so rotate/mirror act on the new
  // ghost rather than on whatever was still selected behind it
  else { clearSelection(); clearOverlaySel(); }
  ST.tool=t;
  document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active', el.dataset.tool===t));
  highlightRecent();
  $('drawopts').classList.toggle('show', t==='draw'||!!SYMBOLS[t]);
  stage.classList.remove('c-cross','c-pan');
  if(CATALOG[t]||t==='draw'||t==='erase'||t==='stamp'||t==='text'||t==='eyedrop'||SYMBOLS[t]) stage.classList.add('c-cross');
  if(t==='pan') stage.classList.add('c-pan');
  // touch: start the ghost centered on screen so there is always a visible
  // ghost to drag-aim and tap-confirm
  if(isCoarse() && (CATALOG[t] || (t==='stamp'&&ST.activeStamp)))
    ST.hover=screenToWorld(stage.clientWidth/2, stage.clientHeight/2);
  // mobile: no Esc / right-click, so surface a "Done" chip to leave the tool
  updateToolChip();
  updateStatus(); render();
}
// mobile Done chip: leaves a tool, or clears a selection made with Select/Pan.
// Pan is a nav mode like Select, so on its own it needs no "finish" action.
export function inNavTool(){ return ST.tool==='select'||ST.tool==='pan'; }
export function updateToolChip(){
  const ex=$('tool-exit'); if(!ex) return;
  ex.classList.toggle('show', isCoarse() && (!inNavTool() || !!anySelected()));
}

COARSE_MQ.addEventListener('change', ()=>{ updateToolChip(); applyTouchDefault(); });
// Touch devices open in Pan rather than Select. Only ever replaces the untouched
// startup default, so a tool the user picked is never swapped out from under them.
export function applyTouchDefault(){
  if(isCoarse() && !ST.userPickedTool && ST.tool==='select' && !anySelected()) setTool('pan');
}
// images and symbols drop in already selected so they can be positioned; that
// only works from Select, so switch there while remembering the nav tool the
// user was in, which Done and the next placement still return to.
export function editNewOverlay(){ const nav=ST.lastNavTool; setTool('select'); ST.lastNavTool=nav; }
