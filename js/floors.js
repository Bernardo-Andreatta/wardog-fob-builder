import { CATALOG } from './catalog.js';
import { GRID } from './dom.js';
import { pieceAABB } from './render.js';
import { ST } from './state.js';

// ---------------- layers (experimental "build up")
// pieces may carry `l` (floor, default 0). Higher floors render offset up and
// dimmed to fake depth, and may only sit on a wall/bunker base one floor below.
export const BASE_TYPES = ['wall','shortwall','quadra','bunker','shelter'];   // what a higher floor can rest on
// short wall / sandbags / barbed read darker ("low"). They snap to the standard
// floor colour when merged: two of the same type on a cell, or a low piece
// resting over a short wall. Key groups low pieces sharing a cell on a floor.
export function swKey(p){ return Math.round(p.x)+','+Math.round(p.y)+','+pieceLayer(p); }
// short walls always sit beneath other structures on their floor
export function swRank(p){ return p.type==='shortwall' ? 0 : 1; }
export const LOW_TYPES = ['shortwall','sandbags','barbed','hedgehog'];
// see-through pieces: on upper floors they don't blank out what's underneath
export const OPEN_TYPES = ['barbed','hedgehog'];
export function masksBelow(p){ return pieceLayer(p)>0 && OPEN_TYPES.indexOf(p.type)===-1; }
export function shortwallCells(list){ const arr=list||ST.pieces, set=new Set();
  arr.forEach(p=>{ if(p.type==='shortwall') cellsOf(p.type,p.x,p.y,p.rot).forEach(c=>set.add(pieceLayer(p)+':'+c)); });
  return set; }
export function lowCounts(list){ const arr=list||ST.pieces, c={}; arr.forEach(p=>{ if(LOW_TYPES.indexOf(p.type)!==-1){ const k=p.type+'|'+swKey(p); c[k]=(c[k]||0)+1; } }); return c; }
// decide how a low piece draws: {skip} to merge duplicates, and its colour
export function lowStyle(p, baseCol, bg, counts, swSet, drawn){
  if(LOW_TYPES.indexOf(p.type)===-1) return {skip:false, col:baseCol};
  const key=p.type+'|'+swKey(p), pair=counts[key]>=2;
  if(pair){ if(drawn.has(key)) return {skip:true}; drawn.add(key); }   // merged pair draws once
  const overShort = p.type!=='shortwall' && cellsOf(p.type,p.x,p.y,p.rot).some(c=>swSet.has(pieceLayer(p)+':'+c));
  if(pair||overShort) return {skip:false, col:baseCol};
  // above ground a low piece rests on a full wall, so it sits between its own
  // floor's brightness and the floor below (a third shading step); on the
  // ground it keeps the stronger "low" dim
  return {skip:false, col:mixCol(baseCol,bg, pieceLayer(p)>0 ? 0.12 : 0.5)};
}
export const LAYER_OFF = GRID*0.44;                     // upward screen shift per floor
export function layerOff(l){ return {x:0, y:-l*LAYER_OFF}; }
export function pieceLayer(p){ return p.l||0; }
// tall pieces reach one floor above their base: they draw at that height and
// stay bright alongside it, but keep their base floor for visibility/support
export const TALL_TYPES=['tower'];
export function drawLayer(p){ return pieceLayer(p) + (TALL_TYPES.indexOf(p.type)!==-1?1:0); }
export function maxLayer(){ return ST.pieces.reduce((m,p)=>Math.max(m,pieceLayer(p)),0); }
// grid cells a footprint covers, as "col,row" keys. Cell centers are rotated
// through the piece's true angle, so 90/270 match the old axis swap exactly and
// odd angles (45deg walls etc.) map to the diagonal cells they actually cover.
export function cellsOf(type, x, y, rot){
  const c=CATALOG[type];
  const w=Math.max(1,Math.round(c.w)), h=Math.max(1,Math.round(c.h));
  const rad=(rot||0)*Math.PI/180, cs=Math.cos(rad), sn=Math.sin(rad);
  const cells=new Set();
  for(let i=0;i<w;i++) for(let j=0;j<h;j++){
    const lx=(i-(w-1)/2)*GRID, ly=(j-(h-1)/2)*GRID;
    const cx=x+lx*cs-ly*sn, cy=y+lx*sn+ly*cs;
    cells.add(Math.round(cx/GRID-0.5)+','+Math.round(cy/GRID-0.5));
  }
  return [...cells];
}
export function supportedCells(layer){
  const set=new Set();
  ST.pieces.forEach(p=>{ if(pieceLayer(p)===layer && BASE_TYPES.indexOf(p.type)!==-1)
    cellsOf(p.type,p.x,p.y,p.rot).forEach(c=>set.add(c)); });
  return set;
}
// a footprint is placeable on `layer` if ground floor, or fully over a base below
export function canPlace(type, x, y, rot, layer){
  if(layer<=0) return true;
  const sup=supportedCells(layer-1);
  return cellsOf(type,x,y,rot).every(c=>sup.has(c));
}
// soft pieces may clip anything (sandbags/barbed/hedgehog and short walls); hard
// buildings may not overlap another hard building on the same floor
export const SOFT_TYPES=['sandbags','barbed','hedgehog','shortwall'];
export function isSoft(type){ return SOFT_TYPES.indexOf(type)!==-1; }
export function overlapConflict(type,x,y,rot,layer,ignoreId){
  if(isSoft(type)) return false;
  const set=new Set(cellsOf(type,x,y,rot));
  return ST.pieces.some(p=> p.id!==ignoreId && pieceLayer(p)===layer && !isSoft(p.type)
    && cellsOf(p.type,p.x,p.y,p.rot).some(c=>set.has(c)));
}
// FOB build areas: every FOB owns a 40x40-cell zone; structures must sit inside a
// zone, and FOB zones may not overlap each other
export const FOB_CELLS=40;
export function fobList(){ return ST.pieces.filter(p=>p.type==='fob'); }
export function fobArea(cx,cy){ const half=FOB_CELLS*GRID/2; return {minx:cx-half,miny:cy-half,maxx:cx+half,maxy:cy+half}; }
export function rectContains(r,a){ return a.minx>=r.minx-0.01 && a.maxx<=r.maxx+0.01 && a.miny>=r.miny-0.01 && a.maxy<=r.maxy+0.01; }
export function rectsOverlap(a,b){ return a.minx<b.maxx-0.01 && a.maxx>b.minx+0.01 && a.miny<b.maxy-0.01 && a.maxy>b.miny+0.01; }
// null = ok, otherwise a short reason string
export function placeError(type,x,y,rot,layer,ignoreId){
  if(!canPlace(type,x,y,rot,layer)) return 'Needs a wall or bunker below';
  if(overlapConflict(type,x,y,rot,layer,ignoreId)) return 'Structures cannot overlap';
  const aabb=pieceAABB({type,x,y,rot,flip:false});
  if(type==='fob'){
    const na=fobArea(x,y);
    if(fobList().some(f=> f.id!==ignoreId && rectsOverlap(fobArea(f.x,f.y), na))) return 'FOB areas cannot overlap';
  } else {
    if(!fobList().length) return 'Place a FOB first';
    if(!fobList().some(f=>rectContains(fobArea(f.x,f.y), aabb))) return 'Build inside a FOB area';
  }
  return null;
}
// colour helpers for depth dimming
export function _hx(c){ c=(c||'').trim();
  if(c[0]==='#'){ if(c.length===4) c='#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
    return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]; }
  const m=c.match(/\d+/g); return m?[+m[0],+m[1],+m[2]]:[0,0,0]; }
export function mixCol(a,b,t){ const A=_hx(a),B=_hx(b);
  return 'rgb('+Math.round(A[0]+(B[0]-A[0])*t)+','+Math.round(A[1]+(B[1]-A[1])*t)+','+Math.round(A[2]+(B[2]-A[2])*t)+')'; }
// colour for a piece at floor l given the tallest floor present
export function layerColor(baseCol, bg, l, maxL){ return mixCol(baseCol, bg, Math.max(0,Math.min(0.7,(maxL-l)*0.42))); }
// fill a piece's footprint solid (used so an upper floor hides the floor below)
export function maskPiece(g,p,col){
  const c=CATALOG[p.type], W=c.w*GRID, H=c.h*GRID;
  g.save(); g.translate(p.x,p.y); if(p.flip) g.scale(-1,1); g.rotate(p.rot*Math.PI/180);
  g.globalAlpha=1; g.fillStyle=col; g.fillRect(-W/2,-H/2,W,H); g.restore();
}
