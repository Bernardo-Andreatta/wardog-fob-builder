import { ST } from './state.js';

// ---------------- layers (Photoshop-style: z-order, visibility, opacity) --------
// Distinct from the "Floor" system (curLayer / p.l), which fakes vertical build
// height. A layer is an organizational sheet every item (piece / image / text /
// drawing) belongs to via `ly`; layers array order is the z-stack (0 = bottom).
export function floorName(f){ return f<=0?'Ground Floor':'Floor '+f; }
export function floorsForDraw(){ const fs=[...new Set(ST.layers.map(l=>l.floor||0))];
  fs.sort((a,b)=> ST.higherFloorOnTop ? a-b : b-a); return fs; }   // bottom -> top
// full stack bottom -> top: floors in order, layers within a floor by array order
export function zOrder(){ const out=[]; floorsForDraw().forEach(f=> ST.layers.forEach(l=>{ if((l.floor||0)===f) out.push(l); })); return out; }
export function ensureLayers(){
  if(!ST.layers.length){ ST.layers=[{id:ST.layerUid++, name:'Ground', visible:true, opacity:1, locked:false, floor:0}]; }
  ST.layers.forEach(l=>{ if(l.floor==null) l.floor=0; });
  if(!layerById(ST.curLayerId)) ST.curLayerId = ST.layers[ST.layers.length-1].id;
  ST.selLayers = ST.selLayers.filter(id=>layerById(id));
  if(!ST.selLayers.length) ST.selLayers=[ST.curLayerId];
  if(ST.selLayers.indexOf(ST.curLayerId)===-1) ST.curLayerId=ST.selLayers[ST.selLayers.length-1];
}
export function layerById(id){ return ST.layers.find(l=>l.id===id); }
export function itemLayerId(it){ return (it && it.ly!=null && layerById(it.ly)) ? it.ly : (ST.layers[0]?ST.layers[0].id:0); }
export function layerOf(it){ return layerById(itemLayerId(it)); }
export function layerVisible(it){ const l=layerOf(it); return !l || l.visible; }
export function layerLocked(it){ const l=layerOf(it); return !!(l && l.locked); }
export function layerActiveId(id){ return ST.selLayers.indexOf(id)!==-1; }
// canvas Select only reaches items on an ACTIVE (panel-selected), visible, unlocked layer
export function layerEditable(it){ return layerVisible(it) && !layerLocked(it) && layerActiveId(itemLayerId(it)); }
// prune the canvas selection to whatever is still on an active layer
export function pruneSelToActive(){
  ST.selected=ST.selected.filter(id=>{ const p=ST.pieces.find(x=>x.id===id); return p && layerEditable(p); });
  ST.selImages=ST.selImages.filter(id=>{ const im=ST.images.find(x=>x.id===id); return im && layerEditable(im); });
  ST.selTexts=ST.selTexts.filter(id=>{ const t=ST.texts.find(x=>x.id===id); return t && layerEditable(t); });
  ST.selStrokes=ST.selStrokes.filter(s=>layerEditable(s));
}
export function layerZ(it){ const id=itemLayerId(it), o=zOrder(); const i=o.findIndex(l=>l.id===id); return i<0?0:i; }
// assign any item still missing a valid layer to the bottom layer
export function migrateLayers(){
  ensureLayers();
  const base=ST.layers[0].id;
  const fix=it=>{ if(it.ly==null || !layerById(it.ly)) it.ly=base; };
  ST.pieces.forEach(fix); ST.images.forEach(fix); ST.texts.forEach(fix); ST.strokes.forEach(fix);
  ST.layerUid=Math.max(ST.layerUid,...ST.layers.map(l=>(l.id||0)+1));
  ST.groupUid=Math.max(ST.groupUid, ...allItems().map(it=>(it.g||0)+1));
}
export function allItems(){ return [...ST.pieces,...ST.images,...ST.texts,...ST.strokes]; }
