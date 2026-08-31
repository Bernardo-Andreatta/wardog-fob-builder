// every module below installs its own DOM wiring on load; main just
// fixes the evaluation order and starts the app
import './core.js';
import './groups.js';
import './geometry.js';
import './drawers.js';
import './floors.js';
import './overlays.js';
import './touch.js';
import './keyboard.js';
import './actions.js';
import './ctxmenu.js';

import { CATALOG, LOGI_ORDER, PIECE_ORDER } from './catalog.js';
import { $, GRID, isCoarse, stage } from './dom.js';
import { loadExpCfg } from './exporter.js';
import { persist } from './history.js';
import { buildRecent } from './icons.js';
import { ensureLayers, layerById, migrateLayers } from './layers.js';
import { renderLayerPanel, setSpTab } from './layerspanel.js';
import { adoptPlan, cleanPlan, ensurePlan } from './plan.js';
import { renderPlanPanel } from './planpanel.js';
import { commitPendingMove } from './pointer.js';
import { applySavedOrder, buildRail, buildSwatches, refreshIcons } from './rail.js';
import { cssVar, render, resize } from './render.js';
import { clearOverlaySel, clearSelection, hydrateImages, imagesData } from './selection.js';
import { persistStamps } from './stamps.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { applyTouchDefault, setTool } from './tools.js';
import { decodeBuild, flashToast } from './topbar.js';

// ---------------- init
// collapsible rail sections (state persisted per section)
export function initCollapsibles(){
  let state={}; try{ state=JSON.parse(localStorage.getItem('wardog-fob-collapsed')||'{}')||{}; }catch(e){}
  document.querySelectorAll('.group-label[data-sec]').forEach(lbl=>{
    const sec=lbl.closest('.sec'), key=lbl.dataset.sec;
    if(state[key]) sec.classList.add('collapsed');
    lbl.onclick=()=>{ sec.classList.toggle('collapsed');
      state[key]=sec.classList.contains('collapsed');
      try{ localStorage.setItem('wardog-fob-collapsed', JSON.stringify(state)); }catch(e){} };
  });
}
export function init(){
  try{ const rw=localStorage.getItem('wardog-fob-railw'); if(rw) document.documentElement.style.setProperty('--rail-w', parseInt(rw)+'px'); }catch(e){}
  try{ if(localStorage.getItem('wardog-fob-railoff')==='1') document.querySelector('.app').classList.add('rail-off'); }catch(e){}
  applySavedOrder(PIECE_ORDER, 'wardog-fob-order'); applySavedOrder(LOGI_ORDER, 'wardog-fob-logi');
  buildRail(); buildSwatches(); initCollapsibles();
  try{ const saved=JSON.parse(localStorage.getItem('wardog-fob')||'null');
    if(saved){ ST.pieces=saved.pieces||[]; ST.strokes=saved.strokes||[];
      ST.images=saved.images||[]; ST.texts=saved.texts||[]; hydrateImages();
      if(saved.view)ST.view=saved.view;
      if(saved.layers) ST.layers=saved.layers;
      if(saved.curLayerId!=null) ST.curLayerId=saved.curLayerId;
      if(saved.layerUid) ST.layerUid=saved.layerUid;
      if(saved.groupUid) ST.groupUid=saved.groupUid;
      if('higherFloorOnTop' in saved) ST.higherFloorOnTop=saved.higherFloorOnTop;
      if(saved.curLayer!=null) ST.curLayer=Math.max(0,saved.curLayer);
      if(saved.stages) ST.stages=saved.stages;
      if(saved.builders) ST.builders=saved.builders;
      if(saved.stageUid) ST.stageUid=saved.stageUid;
      if(saved.builderUid) ST.builderUid=saved.builderUid;
      if('curStageId' in saved) ST.curStageId=saved.curStageId;
      if('curBuilderId' in saved) ST.curBuilderId=saved.curBuilderId;
      if(saved.planColorBy) ST.planColorBy=saved.planColorBy;
      if('showNoStage' in saved) ST.showNoStage=saved.showNoStage;
      if('showNoBuilder' in saved) ST.showNoBuilder=saved.showNoBuilder;
      ST.uid=saved.uid||Math.max(1,...ST.pieces.map(p=>p.id||0),...ST.images.map(i=>i.id||0),...ST.texts.map(t=>t.id||0),0)+1; }
  }catch(e){}
  migrateLayers(); ensurePlan(); loadExpCfg();
  try{ const sv=JSON.parse(localStorage.getItem('wardog-fob-stamps')||'null');
    if(Array.isArray(sv)){ ST.stamps=sv.filter(s=>s&&Array.isArray(s.parts)&&s.parts.length);
      ST.stampUid=Math.max(0,...ST.stamps.map(s=>s.sid||0))+1; }
  }catch(e){}
  buildRecent(); renderLayerPanel(); renderPlanPanel();
  { const AL=layerById(ST.curLayerId); if(AL) ST.curLayer=Math.max(0,AL.floor||0); }  // floor follows active layer
  $('layer-val').textContent = ST.curLayer===0?'G':ST.curLayer;   // restore floor readout
  // Floors & Layers panel: shown on desktop, hidden on mobile; last choice remembered
  (function(){ let pref=null; try{ pref=localStorage.getItem('wardog-fob-panel'); }catch(e){}
    const hide = pref==='off' || (pref==null && isCoarse());
    document.querySelector('.app').classList.toggle('panel-off', hide);
    let tab=null; try{ tab=localStorage.getItem('wardog-fob-sptab'); }catch(e){}
    setSpTab(tab==='plan'?'plan':'layers'); })();
  if(!ST.view.ox && !ST.view.oy){ ST.view.ox=stage.clientWidth/2; ST.view.oy=stage.clientHeight/2; }
  setTool('select');
  applyTouchDefault();
  // some browsers settle the pointer type just after scripts run, so re-check
  requestAnimationFrame(applyTouchDefault);
  ST.history=[JSON.stringify({pieces:ST.pieces,strokes:ST.strokes,uid:ST.uid,images:imagesData(),texts:ST.texts,layers:ST.layers,curLayerId:ST.curLayerId,stages:ST.stages,builders:ST.builders})]; ST.hidx=0;
  resize();
  updateStatus();
  loadSharedHash();   // a shared build in the URL hash (#FOB...) overrides the autosave
}
// decoding a v3 code is async, so the shared build lands just after first paint
export async function loadSharedHash(){
  const h=(location.hash||'').slice(1);
  if(!/^FOB[123]\./.test(h)) return;
  try{
    const o=await decodeBuild(h);
    const map=adoptPlan(o);
    ST.uid=1; ST.pieces=(o.pieces||[]).map(p=>({id:ST.uid++,type:p.type,x:p.x,y:p.y,rot:p.rot||0,flip:!!p.flip,l:p.l||0,
      st:map('stage',p), bd:map('builder',p)}));
    cleanPlan();
    ST.strokes=o.strokes||[];
    ST.texts=(o.texts||[]).map(t=>({id:ST.uid++,text:t.text,x:t.x,y:t.y,size:t.size||GRID*0.6,color:t.color||cssVar('--piece'),rot:t.rot||0}));
    ST.images=[];
    ST.layers=[]; ST.curLayerId=0; ensureLayers(); migrateLayers(); renderLayerPanel(); renderPlanPanel();
    clearSelection(); clearOverlaySel();
    ST.history=[JSON.stringify({pieces:ST.pieces,strokes:ST.strokes,uid:ST.uid,images:imagesData(),texts:ST.texts,layers:ST.layers,curLayerId:ST.curLayerId,stages:ST.stages,builders:ST.builders})]; ST.hidx=0;
    centerOnContent(); render(); updateStatus(); persist();
  }catch(e){ flashToast('That shared link could not be read'); }
}
// fit the view around all placed content (used when opening a shared link)
export function centerOnContent(){
  if(!ST.pieces.length && !ST.strokes.length) return;
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  ST.pieces.forEach(p=>{ const cc=CATALOG[p.type]; const rad=Math.abs(p.rot%180)===90;
    const hw=(rad?cc.h:cc.w)*GRID/2, hh=(rad?cc.w:cc.h)*GRID/2;
    a=Math.min(a,p.x-hw);c=Math.max(c,p.x+hw); b=Math.min(b,p.y-hh);d=Math.max(d,p.y+hh); });
  ST.strokes.forEach(s=>s.pts.forEach(pt=>{ a=Math.min(a,pt.x);c=Math.max(c,pt.x);b=Math.min(b,pt.y);d=Math.max(d,pt.y); }));
  if(a===Infinity) return;
  const cx=(a+c)/2, cy=(b+d)/2, W=c-a+GRID*2, H=d-b+GRID*2;
  const sc=Math.min(2, Math.max(0.2, Math.min(stage.clientWidth/W, stage.clientHeight/H)));
  ST.view.scale=sc; ST.view.ox=stage.clientWidth/2 - cx*sc; ST.view.oy=stage.clientHeight/2 - cy*sc;
}
window.addEventListener('beforeunload', ()=>{ try{ commitPendingMove(); persist(); persistStamps(); }catch(e){} });
window.addEventListener('resize', resize);
// track any stage-box change (rotation, mobile browser chrome, rail collapse)
if(window.ResizeObserver){ let first=true;
  new ResizeObserver(()=>{ if(first){ first=false; return; } resize(); }).observe(stage); }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{ refreshIcons(); render(); });
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
