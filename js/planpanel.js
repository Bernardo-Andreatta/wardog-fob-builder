import { supplySum, tallyText } from './catalog.js';
import { $, isCoarse, stage } from './dom.js';
import { selItemObjs } from './groups.js';
import { persist, snapshot } from './history.js';
import { layerById } from './layers.js';
import { renderLayerPanel } from './layerspanel.js';
import { builderById, ensurePlan, nextPlanColor, planCount, stageById } from './plan.js';
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
  if(kind==='stage'){ ST.curStageId=id; ST.hlBuilder=undefined; }   // the spotlight was about the old stage
  else ST.curBuilderId=id;
  render(); renderPlanPanel(); persist();
}
export function addPlanEntry(kind){
  const arr=planEntries(kind), col=nextPlanColor();
  const E = kind==='stage'
    ? {id:ST.stageUid++,   name:'Stage '+(arr.length+1),   color:col}
    : {id:ST.builderUid++, name:'Builder '+(arr.length+1), color:col};
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
  flashToast(items.length+' piece'+(items.length>1?'s':'')+' → '+(E?E.name:'General'));
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
// E === null builds the "General" bucket row (filterable, not editable)
// The modal is configuration only: it adds, renames, recolours and removes
// tags. Which stage and builder are *active*, and which are hidden, are board
// decisions, so they live on the board readout instead.
export function buildPlanRow(kind, E){
  const id = E?E.id:null;
  const row=document.createElement('div');
  row.className='pl-row';
  row.dataset.kind=kind; row.dataset.id = E?String(E.id):'';
  row.title = E ? 'Double-click the name to rename'
                : 'Work with no '+kind+' of its own - it shows in every view';
  let dot;
  if(E){
    dot=document.createElement('input'); dot.type='color'; dot.className='pl-dot'; dot.value=E.color;
    dot.title='Tag colour';
    dot.onclick=ev=>ev.stopPropagation();
    dot.oninput=()=>{ E.color=dot.value; render(); };
    dot.onchange=()=>{ E.color=dot.value; snapshot(); render(); };
  } else { dot=document.createElement('span'); dot.className='pl-dot plain'; }
  const name=document.createElement('span'); name.className='pl-name';
  name.textContent = E ? E.name : 'General';
  if(E && E.note) name.title=E.note;
  if(E) name.ondblclick=ev=>{ ev.stopPropagation(); planRename(E, name); };
  const n=document.createElement('span'); n.className='pl-n'; n.textContent=planCount(kind,id);
  row.appendChild(dot); row.appendChild(name); row.appendChild(n);
  // a stage carries a free-text purpose, written here and carried onto its
  // export sheet - nothing is pre-filled, the crew says what the stage is for
  if(E && kind==='stage'){
    const note=document.createElement('input');
    note.type='text'; note.className='pl-note'; note.maxLength=90;
    note.placeholder='What happens in this stage?';
    note.value=E.note||'';
    note.title='Shown on this stage\'s export sheet';
    note.onclick=ev=>ev.stopPropagation();
    note.ondblclick=ev=>ev.stopPropagation();
    note.onkeydown=ev=>{ ev.stopPropagation(); if(ev.key==='Enter'){ ev.preventDefault(); note.blur(); } };
    note.oninput=()=>{ const v=note.value.trim(); if(v) E.note=v; else delete E.note; };
    note.onchange=()=>{ snapshot(); persist(); };
    row.appendChild(note);
  }
  if(E){
    const x=document.createElement('button'); x.className='pl-ic x'; x.innerHTML=PL_X;
    x.title='Remove this tag (its pieces fall back to General)';
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
// stage stepper: General sits at the head of the cycle - it is where a piece
// with no stage lives, and selecting it shows the whole build
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
const PH_FOLD='<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>';
// On a phone the bar is a panel you dismiss, not a section you collapse into
// the one above it, so it closes on an X. The chevron still reads right on the
// desktop card, where the readout folds up into its own header.
const PH_CLOSE='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
let hudSig=null;
function hudBuilders(){
  return ST.builders.map(b=>({id:b.id, name:b.name, color:b.color}))
    .concat([{id:null, name:'General', color:null}]);
}
export function renderPlanHud(){
  const el=$('plan-hud'); if(!el) return;
  ensurePlan();
  const S = ST.curStageId==null ? null : stageById(ST.curStageId);
  const rows=hudBuilders();
  // the rows only get rebuilt when the tags themselves change, so the counts
  // below can refresh on every status tick without churning the DOM
  // the fold button's icon differs by pointer type, so a switch has to rebuild
  const touch=isCoarse();
  const sig=[S?S.id+S.name+S.color:'none', rows.map(r=>r.id+'|'+r.name+'|'+r.color).join(','), touch].join('#');
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
    nm.textContent = S?S.name:'General';
    nm.title='The stage new pieces are tagged with';
    // the tally belongs to the stage, so it sits with the stage's own row
    const scount=document.createElement('span'); scount.className='ph-n ph-scount';
    head.appendChild(dot); head.appendChild(nm); head.appendChild(scount);
    head.appendChild(mkBtn('ph-next', PH_NEXT, 'Next stage', ()=>stepStage(1)));
    head.appendChild(mkBtn('ph-edit', PH_EDIT, 'Edit stages & builders', openPlanModal));
    head.appendChild(mkBtn('ph-fold', touch?PH_CLOSE:PH_FOLD,
      touch?'Close the board readout':'Hide the board readout', ()=>setHudOpen(false)));
    el.appendChild(head);
    // A phone shows the builders behind this chip instead of listing them all:
    // the bar's height then does not grow with the crew.
    const chip=document.createElement('button'); chip.className='ph-bchip';
    chip.title='Choose the builder in view';
    chip.innerHTML='<span class="ph-dot plain"></span><span class="ph-name"></span>'
      +'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
    chip.onclick=ev=>{ ev.stopPropagation(); el.classList.toggle('sheet-open'); };
    el.appendChild(chip);
    const sub=document.createElement('div'); sub.className='ph-sub';
    const lab=document.createElement('span'); lab.className='ph-sublab';
    // General is the whole build, so counting "in this stage" there would read 0
    // while the board plainly shows everything
    lab.textContent = S ? 'In this stage' : 'On the board';
    const tot=document.createElement('span'); tot.className='ph-n ph-total';
    sub.appendChild(lab); sub.appendChild(tot); el.appendChild(sub);
    const list=document.createElement('div'); list.className='ph-list';
    el.appendChild(list);
    rows.forEach(r=>{
      const b=document.createElement('div'); b.className='ph-row';
      b.dataset.id = r.id==null ? '' : String(r.id);
      b.title = 'Make '+r.name+' the active builder, and pick out what they have in this stage';
      const d=document.createElement('span'); d.className='ph-dot'+(r.color?'':' plain');
      if(r.color) d.style.background=r.color;
      const t=document.createElement('span'); t.className='ph-name'; t.textContent=r.name;
      const c=document.createElement('span'); c.className='ph-n';
      const s=document.createElement('span'); s.className='ph-n ph-sup';
      s.title='Build supplies this hand spends here';
      b.appendChild(d); b.appendChild(t); b.appendChild(c); b.appendChild(s);
      b.onclick=()=>{
        // General is the "every hand" row, so picking it drops the filter
        // rather than narrowing the board down to untagged work
        ST.hlBuilder = (r.id==null || ST.hlBuilder===r.id) ? undefined : r.id;
        el.classList.remove('sheet-open');      // picking closes the phone sheet
        setPlanActive('builder', r.id);
      };
      list.appendChild(b);
    });
  }
  const prev=el.querySelector('.ph-prev'), next=el.querySelector('.ph-next');
  if(prev) prev.disabled = stageAt(-1)===undefined;
  if(next) next.disabled = stageAt(1)===undefined;
  const cur = ST.curStageId==null ? null : ST.curStageId;
  const inStage = cur===null ? ST.pieces.slice()
                             : ST.pieces.filter(p=>(p.st==null?null:p.st)===cur);
  // On General this is the whole build's bill; on a stage it is that stage's
  // share, which is the number a crew is actually handed.
  const tot=el.querySelector('.ph-total');
  if(tot){ const v=tallyText(inStage);
    if(tot.textContent!==v) tot.textContent=v; }
  // a bare number beside the stage name reads as an id; the noun says what it
  // counts, and agrees with it the way the folded-out readout already does
  const sc=el.querySelector('.ph-scount');
  if(sc){ const v=tallyText(inStage);
    if(sc.textContent!==v) sc.textContent=v; }
  const chip=el.querySelector('.ph-bchip');
  if(chip){
    const b = ST.hlBuilder==null ? null : builderById(ST.hlBuilder);
    const nm = ST.hlBuilder===undefined ? 'Everyone' : (b?b.name:'General');
    const d=chip.querySelector('.ph-dot'), t=chip.querySelector('.ph-name');
    if(t.textContent!==nm) t.textContent=nm;
    d.className='ph-dot'+((b&&b.color)?'':' plain');
    d.style.background=(b&&b.color)?b.color:'';
    chip.classList.toggle('on', ST.hlBuilder!==undefined);
  }
  const curB = ST.curBuilderId==null ? null : ST.curBuilderId;
  el.querySelectorAll('.ph-row').forEach(row=>{
    const id = row.dataset.id==='' ? null : parseInt(row.dataset.id,10);
    const mine = inStage.filter(p=>(p.bd==null?null:p.bd)===id);
    const v = String(mine.length);
    const c = row.querySelector('.ph-n:not(.ph-sup)');
    if(c && c.textContent!==v) c.textContent=v;
    const s = row.querySelector('.ph-sup'), sv = supplySum(mine)+'s';
    if(s && s.textContent!==sv) s.textContent=sv;
    row.classList.toggle('on', curB===id);
    row.classList.toggle('lit', id==null ? ST.hlBuilder===undefined : ST.hlBuilder===id);
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
// the readout collapses to its own toggle, and the choice is remembered
export function setHudOpen(on){
  const h=$('board-hud'); if(!h) return;
  h.classList.toggle('off', !on);
  try{ localStorage.setItem('wardog-fob-hud', on?'':'off'); }catch(e){}
}
// The Done chip and the draw options hang below the plan bar, whose height is
// not a constant: one row or two as the builder chip wraps, or just its own
// chevron once folded. Publishing what it actually measures keeps them clear of
// it instead of guessing a number that goes stale.
const hudBox=$('board-hud');
if(hudBox && window.ResizeObserver){
  new ResizeObserver(()=>{
    stage.style.setProperty('--hud-h', Math.round(hudBox.getBoundingClientRect().height)+'px');
  }).observe(hudBox);
}
$('hud-show').onclick=()=>setHudOpen(true);
document.addEventListener('pointerdown', e=>{
  const el=$('plan-hud');
  if(el && el.classList.contains('sheet-open') && !el.contains(e.target)) el.classList.remove('sheet-open');
}, true);
$('plan-close').onclick=closePlanModal;
$('plan-bg').onclick=closePlanModal;
$('plan-addstage').onclick=()=>addPlanEntry('stage');
$('plan-addbuilder').onclick=()=>addPlanEntry('builder');
