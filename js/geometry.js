import { CATALOG } from './catalog.js';
import { GRID } from './dom.js';
import { drawLayer, layerOff, pieceLayer, swRank } from './floors.js';
import { layerEditable, layerZ } from './layers.js';
import { ST } from './state.js';

// ---------------- geometry
export function snapVal(v){ return ST.snapOn ? Math.round(v/SNAP)*SNAP : v; }
// footprint in cells, accounting for 90/270 rotation
export function cellFoot(type,rot){
  const c=CATALOG[type]; let w=c.w,h=c.h;
  const r=((Math.round(rot||0)%360)+360)%360;
  if(r===90||r===270){ const t=w; w=h; h=t; }
  return {w,h};
}
// snap one axis so a piece of `cells` size tiles cleanly:
// integer even -> grid line, integer odd -> cell centre,
// fractional (e.g. 0.5) -> tile by its own size so copies stack flush (2 half-cells fill a cell)
export function snapAxis(v, cells){
  if(Number.isInteger(cells)) return (cells%2===0) ? Math.round(v/GRID)*GRID : (Math.round(v/GRID-0.5)+0.5)*GRID;
  const size=cells*GRID;
  return Math.round((v-size/2)/size)*size + size/2;
}
export function snapCenter(type,rot,x,y){
  if(!ST.snapOn) return {x:x,y:y};
  const f=cellFoot(type,rot);
  return {x:snapAxis(x,f.w), y:snapAxis(y,f.h)};
}
export function screenToWorld(sx,sy){ return {x:(sx-ST.view.ox)/ST.view.scale, y:(sy-ST.view.oy)/ST.view.scale}; }
export function worldToScreen(wx,wy){ return {x:wx*ST.view.scale+ST.view.ox, y:wy*ST.view.scale+ST.view.oy}; }
export function hitPiece(wx,wy){
  // test top floors first (and other structures before short walls), undoing each
  // piece's layer offset before hit-testing
  const order=ST.pieces.map((p,i)=>({p,i})).sort((a,b)=> (layerZ(b.p)-layerZ(a.p)) || (drawLayer(b.p)-drawLayer(a.p)) || (swRank(b.p)-swRank(a.p)) || (b.i-a.i));
  for(const {p} of order){
    if(pieceLayer(p)>ST.curLayer) continue;   // floors above the view are untouchable
    if(!layerEditable(p)) continue;        // hidden/locked layers aren't selectable
    const off=layerOff(pieceLayer(p)), rad=-p.rot*Math.PI/180, dx=(wx-off.x)-p.x, dy=(wy-off.y)-p.y;
    const lx=dx*Math.cos(rad)-dy*Math.sin(rad), ly=dx*Math.sin(rad)+dy*Math.cos(rad);
    const c=CATALOG[p.type];
    if(Math.abs(lx)<=c.w*GRID/2 && Math.abs(ly)<=c.h*GRID/2) return p;
  }
  return null;
}
export function handleXY(p){
  const c=CATALOG[p.type], dist=c.h*GRID/2 + 24/ST.view.scale, r=p.rot*Math.PI/180;
  return { x:p.x + dist*Math.sin(r), y:p.y - dist*Math.cos(r) };
}
