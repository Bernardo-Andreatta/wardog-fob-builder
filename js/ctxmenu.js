import { deleteSel, duplicateSel, mirrorGroup, rotStep, rotateGroup } from './actions.js';
import { CATALOG } from './catalog.js';
import { $, cv, stage } from './dom.js';
import { pieceLayer } from './floors.js';
import { hitPiece } from './geometry.js';
import { expandGroups, groupSel, selItemObjs, ungroupSel } from './groups.js';
import { floorName, itemLayerId, layerById, zOrder } from './layers.js';
import { ensurePlan } from './plan.js';
import { commonVal, moveSelToLayer, setPlanOnSel } from './planpanel.js';
import { evtW } from './pointer.js';
import { TOOL_ICONS } from './svg.js';
import { render } from './render.js';
import { anySelected, clearOverlaySel, clearSelection, hasRotSel, isSel } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { setTool } from './tools.js';
import { flashToast, toggleSnap } from './topbar.js';

// ---------------- canvas context menu ---------------------------------------
// One place for everything you can do to a piece: the edit ops, the eyedropper,
// its stage / builder tags, the layer it sits on, and what it actually is. It
// replaces the old right-click-is-always-an-eyedropper gesture (the eyedropper
// is a tool in the rail now) and the Build Plan panel's "apply to selection"
// buttons, which made you aim a panel row at a board selection from far away.
export const CTX_IC={
  eyedrop:TOOL_ICONS.eyedrop, select:TOOL_ICONS.select, pan:TOOL_ICONS.pan,
  rotate:'<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v5h-5"/></svg>',
  mirror:'<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M8 7l-4 5 4 5z"/><path d="M16 7l4 5-4 5z"/></svg>',
  copy:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1.5 1.5 0 0 1 1.5-1.5H15"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  group:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/></svg>',
  ungroup:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M12.5 6.5l3 3"/></svg>',
  snap:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
  pen:'<svg viewBox="0 0 24 24"><path d="M14 4l6 6L9 21l-6 1 1-6z"/><path d="M12.5 5.5l6 6"/></svg>',
  none:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/></svg>',
};
// pick a piece's type + orientation and go straight into placing more of it
export function eyedropPiece(p){
  if(!p || !CATALOG[p.type]) return false;
  ST.placeRot=((Math.round(p.rot||0)%360)+360)%360; ST.placeFlip=!!p.flip;
  setTool(p.type); flashToast('Picked '+CATALOG[p.type].name);
  return true;
}
export function ctxClose(){ const el=$('ctx'); if(el && !el.hidden){ el.hidden=true; el.innerHTML=''; } }
export function ctxSub(host, label){
  const d=document.createElement('div'); d.className='ctx-sub'; d.textContent=label;
  host.appendChild(d); return d;
}
export function ctxRow(label, icon, fn, opts){
  opts=opts||{};
  const b=document.createElement('button');
  b.className='ctx-row'+(opts.danger?' danger':'');
  b.innerHTML=(icon||'')+'<span>'+label+'</span>';
  if(opts.title) b.title=opts.title;
  b.disabled=!!opts.off;
  b.onclick=()=>{ ctxClose(); fn(); };
  return b;
}
// a tag row: one chip per option, the current one lit. A mixed selection lights
// nothing, so picking a chip is always an unambiguous "make it this".
// A tag reads as one line: what the selection carries now, and a pencil that
// turns that line into a picker. Laying every stage, builder and layer out as
// chips made the menu as tall as the whole plan and buried the one fact you
// opened it for. A mixed selection says so, and picking still applies to all.
export function ctxPick(host, label, items, cur, onPick){
  ctxSub(host, label);
  const wrap=document.createElement('div'); wrap.className='ctx-pick';
  const show=()=>{
    wrap.innerHTML='';
    const it = cur===undefined ? null : items.find(x=>x.id===cur);
    const dot=document.createElement('span');
    dot.className='ctx-dot'+((it&&it.color)?'':' plain');
    if(it&&it.color) dot.style.background=it.color;
    const nm=document.createElement('span'); nm.className='ctx-cur';
    nm.textContent = cur===undefined ? 'Mixed' : (it?it.name:'Unassigned');
    nm.title=nm.textContent;
    const pen=document.createElement('button'); pen.className='ctx-pen';
    pen.innerHTML=CTX_IC.pen; pen.title='Change '+label.toLowerCase();
    pen.onclick=ev=>{ ev.stopPropagation(); edit(); };
    wrap.appendChild(dot); wrap.appendChild(nm); wrap.appendChild(pen);
  };
  const edit=()=>{
    wrap.innerHTML='';
    const sel=document.createElement('select'); sel.className='ctx-sel';
    if(cur===undefined){ const o=document.createElement('option');
      o.value='-'; o.textContent='Mixed'; o.selected=true; sel.appendChild(o); }
    items.forEach(it=>{ const o=document.createElement('option');
      o.value = it.id==null ? '' : String(it.id); o.textContent=it.name;
      if(cur!==undefined && it.id===cur) o.selected=true; sel.appendChild(o); });
    sel.onclick=ev=>ev.stopPropagation();
    sel.onkeydown=ev=>{ ev.stopPropagation(); if(ev.key==='Escape'){ ev.preventDefault(); show(); } };
    sel.onchange=()=>{
      if(sel.value==='-') return;                       // still "Mixed": nothing chosen
      ctxClose(); onPick(sel.value===''?null:parseInt(sel.value,10));
    };
    wrap.appendChild(sel); sel.focus();
  };
  show(); host.appendChild(wrap);
}
export function ctxSelLabel(ps, ims, ts, ss){
  const n=ps.length+ims.length+ts.length+ss.length;
  if(n!==1) return n+' items selected';
  if(ps.length) return (CATALOG[ps[0].type]||{name:'Piece'}).name;
  return ims.length?'Image overlay':ts.length?'Label':'Drawing';
}
export function openCtx(e){
  const el=$('ctx'); if(!el) return;
  const w=evtW(e), hit=hitPiece(w.x,w.y);
  // right-clicking outside the selection retargets it to what is under the
  // cursor; inside it, the whole selection stays the subject
  if(hit && !isSel(hit.id)){
    clearSelection(); clearOverlaySel(); ST.selected=[hit.id]; expandGroups();
    render(); updateStatus();
  }
  const {ps,ims,ts,ss}=selItemObjs(), all=[...ps,...ims,...ts,...ss];
  el.innerHTML=''; el.hidden=false;
  if(all.length){
    const head=document.createElement('div'); head.className='ctx-head';
    const t=document.createElement('div'); t.className='ctx-title';
    t.textContent=ctxSelLabel(ps,ims,ts,ss); head.appendChild(t);
    const L=layerById(itemLayerId(all[0]));
    const floors=[...new Set(ps.map(pieceLayer))];
    const gids=[...new Set(all.map(it=>it.g).filter(g=>g!=null))];
    const m=document.createElement('div'); m.className='ctx-meta';
    m.innerHTML='Layer &middot; '+((L&&all.every(it=>itemLayerId(it)===L.id))?L.name:'mixed')+'<br>'
      +'Floor &middot; '+(floors.length===1?floorName(floors[0]):(floors.length?'mixed':'&mdash;'))+'<br>'
      +'Group &middot; '+(gids.length===1?('#'+gids[0]+' · '+all.length+' items'):(gids.length?'mixed':'none'));
    head.appendChild(m); el.appendChild(head);

    // The eyedropper copies one structure's type and rotation, so it only means
    // anything when the selection speaks with a single voice: one piece, or
    // several of the same type. Mixed types have no one structure to pick, so
    // the row greys out and Duplicate is what still applies to the whole set.
    const types=[...new Set(ps.map(p=>p.type))];
    if(types.length){
      const pick = types.length===1 ? ((hit && hit.type===types[0]) ? hit : ps[0]) : null;
      el.appendChild(ctxRow('Pick this structure', CTX_IC.eyedrop, ()=>eyedropPiece(pick),
        {off:!pick, title: pick ? 'Place more of these, at this rotation'
                                : 'Selection mixes '+types.length+' structure types - duplicate it instead'}));
    }
    const grid=document.createElement('div'); grid.className='ctx-grid';
    grid.appendChild(ctxRow('Rotate', CTX_IC.rotate, ()=>rotateGroup(rotStep()), {off:!hasRotSel()}));
    grid.appendChild(ctxRow('Mirror', CTX_IC.mirror, mirrorGroup, {off:!hasRotSel()}));
    grid.appendChild(ctxRow('Duplicate', CTX_IC.copy, duplicateSel, {off:!ps.length}));
    grid.appendChild(ctxRow('Delete', CTX_IC.del, deleteSel, {danger:true}));
    grid.appendChild(ctxRow('Group', CTX_IC.group, groupSel, {off:all.length<2}));
    grid.appendChild(ctxRow('Ungroup', CTX_IC.ungroup, ungroupSel, {off:!gids.length}));
    el.appendChild(grid);

    if(ps.length){
      ensurePlan();
      const un=[{id:null, name:'Unassigned'}];
      ctxPick(el, 'Stage', un.concat(ST.stages.map(s=>({id:s.id,name:s.name,color:s.color}))),
        commonVal(ps,'st'), id=>setPlanOnSel('stage',id));
      ctxPick(el, 'Builder', un.concat(ST.builders.map(b=>({id:b.id,name:b.name,color:b.color}))),
        commonVal(ps,'bd'), id=>setPlanOnSel('builder',id));
    }
    const curLy = all.every(it=>itemLayerId(it)===itemLayerId(all[0])) ? itemLayerId(all[0]) : undefined;
    ctxPick(el, 'Layer', zOrder().slice().reverse().map(l=>({id:l.id, name:l.name+' · '+floorName(l.floor||0)})),
      curLy, moveSelToLayer);
  } else {
    ctxSub(el,'Tools');
    const grid=document.createElement('div'); grid.className='ctx-grid';
    grid.appendChild(ctxRow('Select', CTX_IC.select, ()=>{ ST.userPickedTool=true; setTool('select'); }));
    grid.appendChild(ctxRow('Pan', CTX_IC.pan, ()=>{ ST.userPickedTool=true; setTool('pan'); }));
    grid.appendChild(ctxRow('Eyedrop', CTX_IC.eyedrop, ()=>{ ST.userPickedTool=true; setTool('eyedrop'); }));
    grid.appendChild(ctxRow('Snap: '+(ST.snapOn?'on':'off'), CTX_IC.snap, toggleSnap));
    el.appendChild(grid);
    ctxSub(el,'Board');
    el.appendChild(ctxRow('Deselect everything', CTX_IC.none, ()=>{
      clearSelection(); clearOverlaySel(); render(); updateStatus(); }, {off:!anySelected()}));
  }
  // keep the whole card on screen, whichever corner it was opened in
  const rc=stage.getBoundingClientRect();
  el.style.left='0px'; el.style.top='0px';
  const bw=el.offsetWidth, bh=el.offsetHeight;
  const x=Math.min(e.clientX-rc.left, stage.clientWidth-bw-8);
  const y=Math.min(e.clientY-rc.top,  stage.clientHeight-bh-8);
  el.style.left=Math.max(8,x)+'px'; el.style.top=Math.max(8,y)+'px';
}
// any click outside, any Escape, any zoom closes it
document.addEventListener('pointerdown', e=>{
  const el=$('ctx'); if(el && !el.hidden && !el.contains(e.target)) ctxClose();
}, true);
window.addEventListener('keydown', e=>{ if(e.key==='Escape') ctxClose(); }, true);
cv.addEventListener('wheel', ctxClose, {passive:true});
