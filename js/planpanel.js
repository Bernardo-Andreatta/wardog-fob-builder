import { $ } from './dom.js';
import { selItemObjs } from './groups.js';
import { persist, snapshot } from './history.js';
import { layerById } from './layers.js';
import { EYE_OFF, EYE_ON, renderLayerPanel } from './layerspanel.js';
import { PLAN_COLORS, builderById, ensurePlan, planCount, pruneSelToPlan, stageById } from './plan.js';
import { render } from './render.js';
import { selectedPieces } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { flashToast } from './topbar.js';

// ---------------- Build Plan panel (stage + builder tags) --------------------
export const PL_X='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export function planEntries(kind){ return kind==='stage'?ST.stages:ST.builders; }
export function planActive(kind){ return kind==='stage'?ST.curStageId:ST.curBuilderId; }
export function setPlanActive(kind, id){
  const E = id==null ? null : (kind==='stage'?stageById(id):builderById(id));
  if(E) E.visible=true;                 // never leave the active tag filtered out
  if(kind==='stage') ST.curStageId=id; else ST.curBuilderId=id;
  render(); renderPlanPanel(); persist();
}
export function addPlanEntry(kind){
  const arr=planEntries(kind), col=PLAN_COLORS[arr.length%PLAN_COLORS.length];
  const E = kind==='stage'
    ? {id:ST.stageUid++,   name:'Stage '+(arr.length+1),   color:col, visible:true}
    : {id:ST.builderUid++, name:'Builder '+(arr.length+1), color:col, visible:true};
  arr.push(E); setPlanActive(kind, E.id); snapshot();
}
// removing a tag untags its pieces; it never deletes anything from the board
export function delPlanEntry(kind, id){
  const arr=planEntries(kind), i=arr.findIndex(e=>e.id===id); if(i<0) return;
  arr.splice(i,1);
  ST.pieces.forEach(p=>{ if(kind==='stage'){ if(p.st===id) p.st=null; } else if(p.bd===id) p.bd=null; });
  if(planActive(kind)===id){ if(kind==='stage') ST.curStageId=null; else ST.curBuilderId=null; }
  snapshot(); render(); renderPlanPanel();
}
// re-tag whatever is selected with one specific stage / builder (null = untag).
// The context menu is the only way in: a piece is tagged where it lives, not
// from a panel that has to be open and pointed at the right row first.
export function setPlanOnSel(kind, id){
  const items=selectedPieces();
  if(!items.length){ flashToast('Select some pieces first'); return; }
  items.forEach(p=>{ if(kind==='stage') p.st=id; else p.bd=id; });
  const E = id==null ? null : (kind==='stage'?stageById(id):builderById(id));
  flashToast(items.length+' piece'+(items.length>1?'s':'')+' → '+(E?E.name:'Unassigned'));
  snapshot(); render(); renderPlanPanel();
}
// the one value shared by every item, or undefined when they disagree
export function commonVal(items, key){
  if(!items.length) return undefined;
  const v = items[0][key]==null ? null : items[0][key];
  return items.every(it=>(it[key]==null?null:it[key])===v) ? v : undefined;
}
// move the whole selection onto another layer; a layer belongs to a floor, so
// pieces follow that floor too rather than drawing at the wrong height
export function moveSelToLayer(id){
  const L=layerById(id); if(!L) return;
  const {ps,ims,ts,ss}=selItemObjs(), all=[...ps,...ims,...ts,...ss];
  if(!all.length){ flashToast('Select something first'); return; }
  all.forEach(it=>{ it.ly=id; });
  ps.forEach(p=>{ p.l=L.floor||0; });
  if(ST.selLayers.indexOf(id)===-1) ST.selLayers.push(id);
  snapshot(); render(); renderLayerPanel(); updateStatus();
  flashToast(all.length+' item'+(all.length>1?'s':'')+' → '+L.name);
}
export function planRename(E, nameEl){
  const inp=document.createElement('input'); inp.type='text'; inp.className='pl-rename'; inp.value=E.name;
  inp.onclick=e=>e.stopPropagation();
  let done=false;
  const finish=keep=>{ if(done)return; done=true; if(keep){ const v=inp.value.trim(); if(v) E.name=v; }
    snapshot(); renderPlanPanel(); };
  inp.onkeydown=e=>{ e.stopPropagation();
    if(e.key==='Enter'){ e.preventDefault(); finish(true); } else if(e.key==='Escape'){ e.preventDefault(); finish(false); } };
  inp.onblur=()=>finish(true);
  nameEl.replaceWith(inp); inp.focus(); inp.select();
}
// E === null builds the "Unassigned" bucket row (filterable, not editable)
export function buildPlanRow(kind, E){
  const id = E?E.id:null, active = planActive(kind)===id;
  const vis = E ? E.visible : (kind==='stage'?ST.showNoStage:ST.showNoBuilder);
  const row=document.createElement('div');
  row.className='pl-row'+(active?' active':'')+(vis?'':' off');
  row.dataset.kind=kind; row.dataset.id = E?String(E.id):'';
  row.title = E ? 'Click to make active · double-click the name to rename'
                : 'Pieces with no '+kind+' tag yet';
  let dot;
  if(E){
    dot=document.createElement('input'); dot.type='color'; dot.className='pl-dot'; dot.value=E.color;
    dot.title='Tag colour';
    dot.onclick=ev=>ev.stopPropagation();
    dot.oninput=()=>{ E.color=dot.value; render(); };
    dot.onchange=()=>{ E.color=dot.value; snapshot(); render(); };
  } else { dot=document.createElement('span'); dot.className='pl-dot plain'; }
  const name=document.createElement('span'); name.className='pl-name';
  name.textContent = E ? E.name : 'Unassigned';
  if(E && E.note) name.title=E.note;
  if(E) name.ondblclick=ev=>{ ev.stopPropagation(); planRename(E, name); };
  const n=document.createElement('span'); n.className='pl-n'; n.textContent=planCount(kind,id);
  const eye=document.createElement('button'); eye.className='pl-ic'; eye.innerHTML=vis?EYE_ON:EYE_OFF;
  eye.title = vis?'Hide these on the board':'Show these again';
  eye.onclick=ev=>{ ev.stopPropagation();
    if(E) E.visible=!vis; else if(kind==='stage') ST.showNoStage=!vis; else ST.showNoBuilder=!vis;
    pruneSelToPlan(); render(); renderPlanPanel(); updateStatus(); persist(); };
  row.onclick=()=>setPlanActive(kind, id);
  row.appendChild(dot); row.appendChild(name); row.appendChild(n); row.appendChild(eye);
  if(E){
    const x=document.createElement('button'); x.className='pl-ic x'; x.innerHTML=PL_X;
    x.title='Remove this tag (its pieces become unassigned)';
    x.onclick=ev=>{ ev.stopPropagation(); delPlanEntry(kind, E.id); };
    row.appendChild(x);
  }
  return row;
}
export function renderPlanPanel(){
  const sl=$('stage-list'), bl=$('builder-list'); if(!sl||!bl) return;
  ensurePlan();
  sl.innerHTML=''; ST.stages.forEach(s=>sl.appendChild(buildPlanRow('stage',s)));
  sl.appendChild(buildPlanRow('stage',null));
  bl.innerHTML=''; ST.builders.forEach(b=>bl.appendChild(buildPlanRow('builder',b)));
  bl.appendChild(buildPlanRow('builder',null));
  document.querySelectorAll('#plan-colorby button').forEach(b=>b.classList.toggle('on', b.dataset.mode===ST.planColorBy));
  updatePlanApply();
}
// runs from updateStatus, so the tallies keep up with placing / deleting without
// rebuilding the rows (which would kill an in-progress rename)
// The Build Plan editor is a modal of its own now: it is a place you go to set
// the plan up, not something to keep parked in the side panel next to Layers.
export function openPlanModal(){
  const m=$('plan-modal'); if(!m) return;
  m.hidden=false; renderPlanPanel();
}
export function closePlanModal(){ const m=$('plan-modal'); if(m) m.hidden=true; }
// stage stepper: Unassigned sits at the head of the cycle, since it is a real
// bucket pieces can be in, and the ends clamp so the order stays readable
function stageCycle(){ return [null].concat(ST.stages.map(s=>s.id)); }
function stageAt(dir){
  const cyc=stageCycle(), i=cyc.indexOf(ST.curStageId==null?null:ST.curStageId);
  const j=(i<0?0:i)+dir;
  return (j<0 || j>=cyc.length) ? undefined : cyc[j];
}
function stepStage(dir){
  const id=stageAt(dir);
  if(id!==undefined) setPlanActive('stage', id);
}

// ---- board HUD: what is being built right now, and who is on it ------------
// The rail says which structure is armed; this says which stage and builder it
// will be stamped with, and how the work already in that stage divides between
// builders. It sits on the board so neither answer needs the panel open, and a
// builder row is a shortcut to making that builder active.
const PH_PREV='<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const PH_NEXT='<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
const PH_EDIT='<svg viewBox="0 0 24 24"><path d="M14 4l6 6L9 21l-6 1 1-6z"/><path d="M12.5 5.5l6 6"/></svg>';
let hudSig=null;
function hudBuilders(){
  return ST.builders.map(b=>({id:b.id, name:b.name, color:b.color}))
    .concat([{id:null, name:'Unassigned', color:null}]);
}
export function renderPlanHud(){
  const el=$('plan-hud'); if(!el) return;
  ensurePlan();
  const S = ST.curStageId==null ? null : stageById(ST.curStageId);
  const rows=hudBuilders();
  // the rows only get rebuilt when the tags themselves change, so the counts
  // below can refresh on every status tick without churning the DOM
  const sig=[S?S.id+S.name+S.color:'none', rows.map(r=>r.id+'|'+r.name+'|'+r.color).join(',')].join('#');
  if(sig!==hudSig){
    hudSig=sig; el.innerHTML='';
    const head=document.createElement('div'); head.className='ph-stage';
    const mkBtn=(cls,svg,title,fn)=>{
      const b=document.createElement('button'); b.className='ph-btn '+cls;
      b.innerHTML=svg; b.title=title; b.onclick=fn; return b;
    };
    head.appendChild(mkBtn('ph-prev', PH_PREV, 'Previous stage', ()=>stepStage(-1)));
    const dot=document.createElement('span'); dot.className='ph-dot'+(S?'':' plain');
    if(S) dot.style.background=S.color;
    const nm=document.createElement('span'); nm.className='ph-name';
    nm.textContent = S?S.name:'Unassigned';
    nm.title='The stage new pieces are tagged with';
    head.appendChild(dot); head.appendChild(nm);
    head.appendChild(mkBtn('ph-next', PH_NEXT, 'Next stage', ()=>stepStage(1)));
    head.appendChild(mkBtn('ph-edit', PH_EDIT, 'Edit stages & builders', openPlanModal));
    el.appendChild(head);
    const sub=document.createElement('div'); sub.className='ph-sub';
    const lab=document.createElement('span'); lab.className='ph-sublab';
    lab.textContent='In this stage';
    const tot=document.createElement('span'); tot.className='ph-n ph-total';
    sub.appendChild(lab); sub.appendChild(tot); el.appendChild(sub);
    rows.forEach(r=>{
      const b=document.createElement('button'); b.className='ph-row';
      b.dataset.id = r.id==null ? '' : String(r.id);
      b.title = 'Make '+r.name+' the active builder';
      const d=document.createElement('span'); d.className='ph-dot'+(r.color?'':' plain');
      if(r.color) d.style.background=r.color;
      const t=document.createElement('span'); t.className='ph-name'; t.textContent=r.name;
      const c=document.createElement('span'); c.className='ph-n';
      b.appendChild(d); b.appendChild(t); b.appendChild(c);
      b.onclick=()=>setPlanActive('builder', r.id);
      el.appendChild(b);
    });
  }
  const prev=el.querySelector('.ph-prev'), next=el.querySelector('.ph-next');
  if(prev) prev.disabled = stageAt(-1)===undefined;
  if(next) next.disabled = stageAt(1)===undefined;
  const cur = ST.curStageId==null ? null : ST.curStageId;
  const inStage = ST.pieces.filter(p=>(p.st==null?null:p.st)===cur);
  const tot=el.querySelector('.ph-total');
  if(tot){ const v=inStage.length+(inStage.length===1?' piece':' pieces');
    if(tot.textContent!==v) tot.textContent=v; }
  const curB = ST.curBuilderId==null ? null : ST.curBuilderId;
  el.querySelectorAll('.ph-row').forEach(row=>{
    const id = row.dataset.id==='' ? null : parseInt(row.dataset.id,10);
    const v = String(inStage.filter(p=>(p.bd==null?null:p.bd)===id).length);
    const c = row.querySelector('.ph-n');
    if(c && c.textContent!==v) c.textContent=v;
    row.classList.toggle('on', curB===id);
  });
}
export function updatePlanApply(){
  document.querySelectorAll('#stage-list .pl-row, #builder-list .pl-row').forEach(row=>{
    const n=row.querySelector('.pl-n'); if(!n) return;
    const id = row.dataset.id==='' ? null : parseInt(row.dataset.id,10);
    const v=String(planCount(row.dataset.kind, id));
    if(n.textContent!==v) n.textContent=v;
  });
  renderPlanHud();
}
$('plan-close').onclick=closePlanModal;
$('plan-bg').onclick=closePlanModal;
$('plan-addstage').onclick=()=>addPlanEntry('stage');
$('plan-addbuilder').onclick=()=>addPlanEntry('builder');
document.querySelectorAll('#plan-colorby button').forEach(b=>{
  b.onclick=()=>{ ST.planColorBy=b.dataset.mode; render(); renderPlanPanel(); persist(); };
});
