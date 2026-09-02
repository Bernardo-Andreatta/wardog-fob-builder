import { deleteSel, duplicateSel, mirrorGroup, rotStep, rotateGroup, stepPlaceRot } from './actions.js';
import { CATALOG, SYMBOLS } from './catalog.js';
import { $, GRID, stage } from './dom.js';
import { closeExp, previewPanBy } from './exporter.js';
import { pieceLayer } from './floors.js';
import { groupSel, ungroupSel } from './groups.js';
import { persist, redo, snapshot, undo } from './history.js';
import { layerEditable } from './layers.js';
import { closeCmd } from './layerspanel.js';
import { closePlanModal } from './planpanel.js';
import { render } from './render.js';
import { clearOverlaySel, clearSelection, hasRotSel, selectedPieces } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { setTool } from './tools.js';
import { closeCode, setLayer, toggleSnap } from './topbar.js';

// ---------------- keyboard
window.addEventListener('keydown', e=>{
  // typing in a text field (e.g. the share-code box): leave every shortcut alone
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable) return;
  if(e.code==='Space'){ ST.spaceDown=true; if(!ST.drag) stage.classList.add('c-pan'); }
  const meta=e.ctrlKey||e.metaKey;
  if(meta && e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(meta && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  if(meta && e.key.toLowerCase()==='c'){ e.preventDefault(); duplicateSel(); return; }
  if(meta && e.key.toLowerCase()==='a'){ e.preventDefault();
    ST.selected=ST.pieces.filter(p=>pieceLayer(p)<=ST.curLayer&&layerEditable(p)).map(p=>p.id);
    ST.selImages=ST.images.filter(layerEditable).map(i=>i.id); ST.selTexts=ST.texts.filter(layerEditable).map(t=>t.id);
    ST.selStrokes=ST.strokes.filter(layerEditable); render(); updateStatus(); return; }
  if(meta && e.key.toLowerCase()==='g'){ e.preventDefault(); e.shiftKey?ungroupSel():groupSel(); return; }
  // WASD = free camera pan. Works in every tool/mode and never touches the
  // selection or an active ghost, so the camera and the item move independently.
  if(!meta){ const k=e.key.toLowerCase();
    if(k==='w'||k==='a'||k==='s'||k==='d'){ e.preventDefault(); panKeys.add(k); startPanLoop(); return; } }
  const selPs=selectedPieces();
  if(e.key==='r'||e.key==='R'){
    const dir=e.shiftKey?-1:1;
    if(hasRotSel()){ rotateGroup(dir*rotStep()); }
    else if(CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp)){ stepPlaceRot(dir); }
  }
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); deleteSel(); }
  if(e.key==='Escape'){ if(!$('exp-modal').hidden){ closeExp(); return; } if(!$('code-modal').hidden){ closeCode(); return; } if(!$('cmd-modal').hidden){ closeCmd(); return; } if(!$('plan-modal').hidden){ closePlanModal(); return; } ST.hlBuilder=undefined; clearSelection(); clearOverlaySel(); ST.marquee=null; if(CATALOG[ST.tool]||ST.tool==='draw'||ST.tool==='stamp'||ST.tool==='text'||SYMBOLS[ST.tool]) setTool('select'); render(); updateStatus(); }
  if(e.key==='f'||e.key==='F'){
    if(hasRotSel()) mirrorGroup();
    else if(CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp)){ ST.placeFlip=!ST.placeFlip; render(); }
  }
  if(e.key==='g'||e.key==='G') toggleSnap();
  if(e.key==='v'||e.key==='V') setTool('select');
  if(e.key==='b'||e.key==='B') setTool('draw');
  if(e.key==='e'||e.key==='E') setTool('erase');
  if(e.key==='i'||e.key==='I') setTool('eyedrop');
  if(e.key===']') setLayer(ST.curLayer+1);
  if(e.key==='[') setLayer(ST.curLayer-1);
  // Arrows nudge a selection, and drive the camera when there is none - the
  // board has no Pan tool to fall back on, so the keyboard has to be able to
  // move it without one.
  if(!selPs.length && !ST.selImages.length && !ST.selTexts.length && !ST.selStrokes.length
     && e.key.startsWith('Arrow')){
    e.preventDefault();
    const k2={ArrowLeft:'a', ArrowRight:'d', ArrowUp:'w', ArrowDown:'s'}[e.key];
    if(k2){ panKeys.add(k2); startPanLoop(); }
    return;
  }
  if((selPs.length||ST.selImages.length||ST.selTexts.length||ST.selStrokes.length) && e.key.startsWith('Arrow')){
    e.preventDefault(); const d=e.shiftKey?SNAP:(ST.snapOn?GRID:1);
    let dx=0,dy=0;
    if(e.key==='ArrowLeft')dx=-d; if(e.key==='ArrowRight')dx=d;
    if(e.key==='ArrowUp')dy=-d; if(e.key==='ArrowDown')dy=d;
    selPs.forEach(p=>{ p.x+=dx; p.y+=dy; delete p._ix; delete p._iy; });
    ST.images.filter(i=>ST.selImages.includes(i.id)).forEach(im=>{ im.x+=dx; im.y+=dy; });
    ST.texts.filter(t=>ST.selTexts.includes(t.id)).forEach(t=>{ t.x+=dx; t.y+=dy; delete t._ix; delete t._iy; });
    ST.strokes.filter(s=>ST.selStrokes.indexOf(s)!==-1).forEach(s=>{ s.pts.forEach(pt=>{ pt.x+=dx; pt.y+=dy; }); delete s._ipts; });
    snapshot(); render(); updateStatus();
  }
});
window.addEventListener('keyup', e=>{
  if(e.code==='Space'){ ST.spaceDown=false; stage.classList.remove('c-pan'); }
  const k=e.key.toLowerCase(); if(k==='w'||k==='a'||k==='s'||k==='d') panKeys.delete(k);
  const k2={arrowleft:'a', arrowright:'d', arrowup:'w', arrowdown:'s'}[k];
  if(k2) panKeys.delete(k2);
});
window.addEventListener('blur', ()=>{ panKeys.clear(); });

// ---------------- WASD camera pan (continuous while held; independent of selection)
export const panKeys = new Set();
export const PAN_SPEED = 900; // screen px per second
export function startPanLoop(){ if(ST.panRAF) return; ST.panLast = performance.now(); ST.panRAF = requestAnimationFrame(panStep); }
export function panStep(now){
  const dt = Math.min(0.05, (now - ST.panLast)/1000); ST.panLast = now;
  if(!panKeys.size){ ST.panRAF = 0; persist(); return; }
  const step = PAN_SPEED * dt;
  let dx=0, dy=0;
  if(panKeys.has('a')) dx += step;
  if(panKeys.has('d')) dx -= step;
  if(panKeys.has('w')) dy += step;
  if(panKeys.has('s')) dy -= step;
  // the export preview is a viewport too, and it is the one in front when open
  if(!previewPanBy(dx, dy)){
    ST.view.ox += dx; ST.view.oy += dy;
    render(); updateStatus();
  }
  ST.panRAF = requestAnimationFrame(panStep);
}
