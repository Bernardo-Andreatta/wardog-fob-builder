import { $ } from './dom.js';
import { migrateLayers } from './layers.js';
import { renderLayerPanel } from './layerspanel.js';
import { ensurePlan } from './plan.js';
import { renderPlanPanel } from './planpanel.js';
import { render } from './render.js';
import { hydrateImages, imagesData } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';

// ---------------- history / persistence
export function snapshot(){
  const s = JSON.stringify({pieces:ST.pieces,strokes:ST.strokes,uid:ST.uid, images:imagesData(),texts:ST.texts,layers:ST.layers,curLayerId:ST.curLayerId,stages:ST.stages,builders:ST.builders});
  if(ST.history[ST.hidx] === s) return;
  ST.history = ST.history.slice(0, ST.hidx+1);
  ST.history.push(s);
  if(ST.history.length > 80) ST.history.shift();
  ST.hidx = ST.history.length-1;
  persist(); updateUndoFab();
}
export function undo(){ if(ST.hidx>0){ ST.hidx--; restore(ST.history[ST.hidx]); } }
export function redo(){ if(ST.hidx<ST.history.length-1){ ST.hidx++; restore(ST.history[ST.hidx]); } }
export function updateUndoFab(){
  const u=$('fab-undo'), r=$('fab-redo');
  if(u) u.disabled = ST.hidx<=0;
  if(r) r.disabled = ST.hidx>=ST.history.length-1;
}
export function restore(s){ const o=JSON.parse(s); ST.pieces=o.pieces; ST.strokes=o.strokes; ST.uid=o.uid||ST.uid;
  ST.images=o.images||[]; ST.texts=o.texts||[]; hydrateImages();
  if(o.layers){ ST.layers=o.layers; if(o.curLayerId!=null) ST.curLayerId=o.curLayerId; }
  if(o.stages) ST.stages=o.stages;
  if(o.builders) ST.builders=o.builders;
  ensurePlan();
  migrateLayers(); renderLayerPanel(); renderPlanPanel();
  ST.selected = ST.selected.filter(id=>ST.pieces.some(p=>p.id===id));
  ST.selImages = ST.selImages.filter(id=>ST.images.some(i=>i.id===id));
  ST.selTexts = ST.selTexts.filter(id=>ST.texts.some(t=>t.id===id));
  ST.selStrokes = ST.selStrokes.filter(s=>ST.strokes.indexOf(s)!==-1);
  render(); updateStatus(); persist(); }
export function persist(){ try{ localStorage.setItem('wardog-fob', JSON.stringify({pieces:ST.pieces,strokes:ST.strokes,view:ST.view,uid:ST.uid,images:imagesData(),texts:ST.texts,layers:ST.layers,curLayerId:ST.curLayerId,curLayer:ST.curLayer,layerUid:ST.layerUid,groupUid:ST.groupUid,higherFloorOnTop:ST.higherFloorOnTop,stages:ST.stages,builders:ST.builders,stageUid:ST.stageUid,builderUid:ST.builderUid,curStageId:ST.curStageId,curBuilderId:ST.curBuilderId})); }catch(e){} }
