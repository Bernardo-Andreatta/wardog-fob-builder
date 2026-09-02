import { $, isCoarse } from './dom.js';
import { pieceLayer } from './floors.js';
import { groupSel, ungroupSel } from './groups.js';
import { persist, snapshot } from './history.js';
import { ensureLayers, floorName, floorsForDraw, itemLayerId, layerActiveId, layerById, pruneSelToActive } from './layers.js';
import { render, resize } from './render.js';
import { clearOverlaySel, clearSelection } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { flashToast } from './topbar.js';

// ---------------- Layers panel (Photoshop-style: z-order / visibility / opacity)
export const EYE_ON='<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
export const EYE_OFF='<svg viewBox="0 0 24 24"><path d="M9.9 4.2A11 11 0 0 1 12 4c7 0 11 8 11 8a19 19 0 0 1-2.2 3.2M6.1 6.1A19 19 0 0 0 1 12s4 7 11 7a11 11 0 0 0 3-.4M1 1l22 22"/></svg>';
export const LOCK_ON='<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
export const LOCK_OFF='<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7-1"/></svg>';
export function activeLayer(){ return layerById(ST.curLayerId) || ST.layers[ST.layers.length-1]; }
export function selectedLayerObjs(){ return ST.layers.filter(l=>ST.selLayers.indexOf(l.id)!==-1); }
// panel row click: plain = make this the only active layer; Shift/Ctrl = toggle in/out
export function selectLayer(id, additive){
  if(!layerById(id)) return;
  if(additive){ const i=ST.selLayers.indexOf(id);
    if(i!==-1){ if(ST.selLayers.length>1) ST.selLayers.splice(i,1); } else ST.selLayers.push(id); }
  else ST.selLayers=[id];
  ST.curLayerId = ST.selLayers.indexOf(id)!==-1 ? id : ST.selLayers[ST.selLayers.length-1];
  // selecting a layer also switches the build floor to that layer's floor
  const L=layerById(ST.curLayerId);
  if(L){ ST.curLayer=Math.max(0,L.floor||0); $('layer-val').textContent = ST.curLayer===0?'G':ST.curLayer;
    ST.selected=ST.selected.filter(pid=>{ const p=ST.pieces.find(x=>x.id===pid); return p && pieceLayer(p)<=ST.curLayer; }); }
  pruneSelToActive(); updateLayerRowStates(); render(); updateStatus(); persist();
}
// light in-place refresh of row highlight/checkbox + opacity readout (no rebuild,
// so a double-click to rename isn't destroyed by the first click's re-render)
export function updateLayerRowStates(){
  document.querySelectorAll('#lp-list .lp-row').forEach(row=>{
    const id=+row.dataset.id;
    row.classList.toggle('active', layerActiveId(id));
    row.classList.toggle('primary', id===ST.curLayerId);
    const chk=row.querySelector('.lp-chk'); if(chk) chk.checked=layerActiveId(id);
  });
  const sel=selectedLayerObjs(), op=$('lp-opacity'), opv=$('lp-opacity-val');
  if(sel.length && op){ const vals=[...new Set(sel.map(l=>Math.round(l.opacity*100)))];
    const primary=Math.round((activeLayer()?activeLayer().opacity:1)*100);
    op.value=vals.length===1?vals[0]:primary; opv.textContent=vals.length===1?vals[0]+'%':'mixed'; }
}
export function deselectOnLayer(id){
  ST.selected=ST.selected.filter(i=>{ const p=ST.pieces.find(x=>x.id===i); return p && itemLayerId(p)!==id; });
  ST.selImages=ST.selImages.filter(i=>{ const im=ST.images.find(x=>x.id===i); return im && itemLayerId(im)!==id; });
  ST.selTexts=ST.selTexts.filter(i=>{ const t=ST.texts.find(x=>x.id===i); return t && itemLayerId(t)!==id; });
  ST.selStrokes=ST.selStrokes.filter(s=>itemLayerId(s)!==id);
}
// inline rename (no browser prompt): swap the name label for a text input
export function startRename(L, nameEl){
  const inp=document.createElement('input'); inp.type='text'; inp.className='lp-rename'; inp.value=L.name;
  inp.onclick=e=>e.stopPropagation();
  let done=false;
  const finish=keep=>{ if(done)return; done=true; if(keep){ const v=inp.value.trim(); if(v) L.name=v; } snapshot(); renderLayerPanel(); };
  inp.onkeydown=e=>{ e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); finish(true);} else if(e.key==='Escape'){ e.preventDefault(); finish(false);} };
  inp.onblur=()=>finish(true);
  nameEl.replaceWith(inp); inp.focus(); inp.select();
}
// drag-and-drop reorder. Display is top-first (reversed vs. the array).
export function reorderLayer(srcId, tgtId, above){
  if(srcId===tgtId) return;
  const src=layerById(srcId), tgt=layerById(tgtId); if(!src||!tgt) return;
  if((src.floor||0)!==(tgt.floor||0)){ flashToast('Layers reorder within their floor'); return; }
  const arr=ST.layers.filter(l=>l.id!==srcId);
  let ti=arr.findIndex(l=>l.id===tgtId); if(ti<0) return;
  if(above) ti+=1;                 // above in display = higher z = later in array
  arr.splice(ti,0,src); ST.layers=arr;
  snapshot(); render(); renderLayerPanel();
}
export function buildLayerRow(L){
  const row=document.createElement('div');
  row.className='lp-row'+(layerActiveId(L.id)?' active':'')+(L.id===ST.curLayerId?' primary':'')+(L.visible?'':' hidden'); row.dataset.id=L.id;
  row.draggable=true; row.title='Drag to reorder within its floor';
  const chk=document.createElement('input'); chk.type='checkbox'; chk.className='lp-chk'; chk.checked=layerActiveId(L.id);
  chk.title='Active layer (editable). Toggle to multi-select';
  chk.onclick=ev=>{ ev.stopPropagation(); selectLayer(L.id, true); };
  const eye=document.createElement('button'); eye.className='lp-eye'; eye.title=L.visible?'Hide':'Show'; eye.innerHTML=L.visible?EYE_ON:EYE_OFF;
  eye.onclick=ev=>{ ev.stopPropagation(); L.visible=!L.visible; if(!L.visible) deselectOnLayer(L.id); snapshot(); render(); renderLayerPanel(); updateStatus(); };
  const name=document.createElement('div'); name.className='lp-name'; name.textContent=L.name; name.title='Double-click to rename · Shift/Ctrl-click to multi-select';
  name.ondblclick=ev=>{ ev.stopPropagation(); startRename(L, name); };
  const lock=document.createElement('button'); lock.className='lp-lock'+(L.locked?' on':''); lock.title=L.locked?'Unlock':'Lock'; lock.innerHTML=L.locked?LOCK_ON:LOCK_OFF;
  lock.onclick=ev=>{ ev.stopPropagation(); L.locked=!L.locked; if(L.locked) deselectOnLayer(L.id); snapshot(); render(); renderLayerPanel(); updateStatus(); };
  row.onclick=ev=>selectLayer(L.id, ev.shiftKey||ev.ctrlKey||ev.metaKey);
  row.ondragstart=ev=>{ ST.dragLayerId=L.id; ev.dataTransfer.effectAllowed='move'; try{ev.dataTransfer.setData('text/plain',String(L.id));}catch(_){} row.classList.add('dragging'); };
  row.ondragend=()=>{ ST.dragLayerId=null; document.querySelectorAll('.lp-row').forEach(r=>r.classList.remove('drop-above','drop-below','dragging')); };
  row.ondragover=ev=>{ if(ST.dragLayerId==null||ST.dragLayerId===L.id) return; ev.preventDefault();
    const rc=row.getBoundingClientRect(), above=(ev.clientY-rc.top)<rc.height/2;
    row.classList.toggle('drop-above',above); row.classList.toggle('drop-below',!above); };
  row.ondragleave=()=>row.classList.remove('drop-above','drop-below');
  row.ondrop=ev=>{ ev.preventDefault(); if(ST.dragLayerId==null||ST.dragLayerId===L.id) return;
    const rc=row.getBoundingClientRect(), above=(ev.clientY-rc.top)<rc.height/2;
    reorderLayer(ST.dragLayerId, L.id, above); ST.dragLayerId=null; };
  row.appendChild(chk); row.appendChild(eye); row.appendChild(name); row.appendChild(lock);
  return row;
}
export function renderLayerPanel(){
  const list=$('lp-list'); if(!list) return;
  ensureLayers(); list.innerHTML='';
  // one section per floor; floors ordered top-of-stack first for display
  const floors=floorsForDraw().slice().reverse();
  floors.forEach(f=>{
    const hdr=document.createElement('div'); hdr.className='lp-floorhdr'; hdr.textContent=floorName(f);
    list.appendChild(hdr);
    const fl=ST.layers.filter(l=>(l.floor||0)===f);
    for(let i=fl.length-1;i>=0;i--) list.appendChild(buildLayerRow(fl[i]));   // top z first
  });
  updateLayerRowStates();
}
export function addLayer(){
  const L={id:ST.layerUid++, name:'Layer '+(ST.layers.length+1), visible:true, opacity:1, locked:false, floor:ST.curLayer};
  const idx=ST.layers.findIndex(l=>l.id===ST.curLayerId);
  ST.layers.splice((idx<0?ST.layers.length-1:idx)+1, 0, L);
  ST.selLayers=[L.id]; ST.curLayerId=L.id; pruneSelToActive();
  snapshot(); render(); renderLayerPanel(); updateStatus();
}
// placing on a floor with no active layer for it auto-creates one (or switches to
// an existing floor layer) - so each build floor gets its own layer by default
export function ensureFloorLayer(){
  const A=activeLayer();
  if(A && A.floor===ST.curLayer) return;
  const existing=ST.layers.find(l=>l.floor===ST.curLayer);
  if(existing){ ST.selLayers=[existing.id]; ST.curLayerId=existing.id; }
  else {
    const L={id:ST.layerUid++, name:floorName(ST.curLayer), visible:true, opacity:1, locked:false, floor:ST.curLayer};
    const idx=ST.layers.findIndex(l=>l.id===ST.curLayerId);
    ST.layers.splice((idx<0?ST.layers.length-1:idx)+1,0,L);
    ST.selLayers=[L.id]; ST.curLayerId=L.id;
  }
  pruneSelToActive(); renderLayerPanel();
}
export function dupLayer(){
  const src=selectedLayerObjs(); if(!src.length) return;
  const newIds=[];
  src.forEach(s=>{
    const L={id:ST.layerUid++, name:s.name+' copy', visible:s.visible, opacity:s.opacity, locked:false, floor:s.floor||0};
    const idx=ST.layers.findIndex(l=>l.id===s.id); ST.layers.splice(idx+1,0,L); newIds.push(L.id);
    const gmap={}, ng=g=>{ if(g==null) return undefined; if(gmap[g]==null) gmap[g]=ST.groupUid++; return gmap[g]; };
    ST.pieces.filter(p=>itemLayerId(p)===s.id).forEach(p=>ST.pieces.push({...p,id:ST.uid++,ly:L.id,g:ng(p.g)}));
    ST.texts.filter(t=>itemLayerId(t)===s.id).forEach(t=>ST.texts.push({...t,id:ST.uid++,ly:L.id,g:ng(t.g)}));
    ST.images.filter(im=>itemLayerId(im)===s.id).forEach(im=>ST.images.push({...im,id:ST.uid++,ly:L.id,g:ng(im.g),_img:im._img}));
    ST.strokes.filter(st=>itemLayerId(st)===s.id).forEach(st=>ST.strokes.push({...st,pts:st.pts.map(pt=>({x:pt.x,y:pt.y})),ly:L.id,g:ng(st.g)}));
  });
  ST.selLayers=newIds; ST.curLayerId=newIds[newIds.length-1]; pruneSelToActive();
  snapshot(); render(); renderLayerPanel(); updateStatus();
}
export function delLayer(){
  const del=new Set(ST.selLayers);
  if(del.size>=ST.layers.length){ flashToast('Cannot delete every layer'); return; }
  const firstIdx=ST.layers.findIndex(l=>del.has(l.id));
  ST.pieces=ST.pieces.filter(p=>!del.has(itemLayerId(p))); ST.texts=ST.texts.filter(t=>!del.has(itemLayerId(t)));
  ST.images=ST.images.filter(im=>!del.has(itemLayerId(im))); ST.strokes=ST.strokes.filter(s=>!del.has(itemLayerId(s)));
  ST.layers=ST.layers.filter(l=>!del.has(l.id));
  ST.curLayerId=ST.layers[Math.max(0, Math.min(firstIdx-1, ST.layers.length-1))].id; ST.selLayers=[ST.curLayerId];
  clearSelection(); clearOverlaySel();
  snapshot(); render(); renderLayerPanel(); updateStatus();
}
export function moveLayer(dir){
  const L=layerById(ST.curLayerId); if(!L) return;
  const fl=ST.layers.filter(x=>(x.floor||0)===(L.floor||0));   // reorder within its floor only
  const pos=fl.indexOf(L), np=pos+dir; if(np<0||np>=fl.length) return;
  const other=fl[np], ia=ST.layers.indexOf(L), ib=ST.layers.indexOf(other);
  ST.layers[ia]=other; ST.layers[ib]=L;
  snapshot(); render(); renderLayerPanel();
}
$('lp-add').onclick=addLayer;
$('lp-dup').onclick=dupLayer;
$('lp-del').onclick=delLayer;
$('lp-up').onclick=()=>moveLayer(1);      // up in the list = higher z = later in array
$('lp-down').onclick=()=>moveLayer(-1);
$('lp-floordir').onclick=()=>{ ST.higherFloorOnTop=!ST.higherFloorOnTop; render(); renderLayerPanel(); persist(); };
$('lp-opacity').oninput=e=>{ const v=(+e.target.value)/100; selectedLayerObjs().forEach(l=>l.opacity=v);
  $('lp-opacity-val').textContent=(+e.target.value)+'%'; render(); };
$('lp-opacity').onchange=()=>{ snapshot(); };
// the floating panel carries both sheets; the tab strip swaps which one shows,
// so Build Plan gets a real panel without adding a second one to the stage
// the panel is Floors & Layers only now - the build plan has its own modal
// the width at which the two board panels start fighting over the same space
export const narrow = ()=>isCoarse() || window.innerWidth<=720;
export function showPanel(on){
  document.querySelector('.app').classList.toggle('panel-off', !on);
  // One board panel at a time, but only where they collide: a phone has room
  // for one, a desktop for both. Folded inline rather than calling planpanel's
  // setHudOpen, which would make these two modules import each other.
  if(on){
    renderLayerPanel();
    const hud=$('board-hud');
    if(narrow() && hud && !hud.classList.contains('off')){
      hud.classList.add('off');
      try{ localStorage.setItem('wardog-fob-hud','off'); }catch(e){}
    }
  }
  try{ localStorage.setItem('wardog-fob-panel', on?'':'off'); }catch(e){}
}
$('btn-layers').onclick=()=>showPanel(document.querySelector('.app').classList.contains('panel-off'));
$('panel-toggle').onclick=()=>showPanel(true);
$('lp-close').onclick=()=>showPanel(false);
// mobile: tapping outside the floating panel dismisses it (a tap on the canvas is
// swallowed so it doesn't also place/select; taps on other UI still act)
document.addEventListener('pointerdown', e=>{
  const app=document.querySelector('.app');
  if(app.classList.contains('panel-off')) return;
  if(!narrow()) return;
  if(e.target.closest('#layers-panel, #btn-layers, #panel-toggle')) return;
  showPanel(false);
  if(e.target.id==='board'){ e.preventDefault(); e.stopPropagation(); }
}, true);
// group / ungroup buttons
$('btn-group').onclick=groupSel;
$('btn-ungroup').onclick=ungroupSel;

// draggable rail width (persisted)
(function(){
  const h=$('rail-resize'), root=document.documentElement, MIN=80, MAX=300;
  const cur=()=>{ const v=parseInt(getComputedStyle(root).getPropertyValue('--rail-w')); return isNaN(v)?164:v; };
  h.addEventListener('pointerdown', e=>{
    e.preventDefault(); try{ h.setPointerCapture(e.pointerId); }catch(_){} h.classList.add('drag');
    const startX=e.clientX, startW=cur();
    const mv=ev=>{ const w=Math.max(MIN,Math.min(MAX, startW+(ev.clientX-startX)));
      root.style.setProperty('--rail-w', w+'px'); resize(); };
    const up=()=>{ h.classList.remove('drag');
      document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up);
      try{ localStorage.setItem('wardog-fob-railw', cur()); }catch(e){} };
    document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up);
  });
})();
// fullscreen mode: collapse the whole rail (persisted)
export const appEl=document.querySelector('.app');
$('rail-toggle').onclick=()=>{
  const off=!appEl.classList.contains('rail-off');
  appEl.classList.toggle('rail-off', off);
  try{ localStorage.setItem('wardog-fob-railoff', off?'1':''); }catch(e){}
};

// commands / controls modal
export function openCmd(){ $('cmd-modal').hidden=false; }
export function closeCmd(){ $('cmd-modal').hidden=true; }
$('btn-commands').onclick=openCmd;
$('cmd-close').onclick=closeCmd;
$('cmd-bg').onclick=closeCmd;
$('draw-width').oninput=e=>{ ST.drawWidth=+e.target.value; };
