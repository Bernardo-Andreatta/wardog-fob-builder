import { canPlace, pieceLayer } from './floors.js';
import { snapCenter } from './geometry.js';
import { snapshot } from './history.js';
import { strokeBBox, textBox } from './overlays.js';
import { pieceAABB, render } from './render.js';
import { clearSelection, isSel, selectedPieces } from './selection.js';
import { addStamp, makeStampFromSel, startPlacing } from './stamps.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { flashToast } from './topbar.js';

// ---------------- actions
// A move in progress records where every item started and rewrites x/y from
// those origins on each frame. Turning or mirroring mid-drag therefore fought
// the drag: the next frame put everything back where the drag had reckoned it
// should be, undoing the new positions while keeping the new angle. And the
// rotation itself worked off "ideal" positions captured before the drag, so it
// swung the selection about a centre it no longer had.
//
// So a drag that is still live is re-based afterwards: it forgets the old
// origins and starts again from where the pieces now are. startW backs off by
// the touch lift, so the frame after a turn moves nothing on its own.
function rebaseDrag(){
  const d=ST.drag; if(!d || d.mode!=='gmove') return;
  d.startW={x:ST.hover.x, y:ST.hover.y - (d.lifted ? d.lift : 0)};
  d.ps.forEach(it=>{ it.ox=it.p.x; it.oy=it.p.y; });
  d.ims.forEach(it=>{ it.ox=it.im.x; it.oy=it.im.y; });
  d.ts.forEach(it=>{ it.ox=it.t.x; it.oy=it.t.y; });
  d.ss.forEach(it=>{ it.pts=it.s.pts.map(pt=>({x:pt.x,y:pt.y})); });
  if(d.primary){ d.pox=d.primary.x; d.poy=d.primary.y; }
  if(d.anchor && d.ims[0]) d.anchor={ox:d.ims[0].ox, oy:d.ims[0].oy};
}
// the ideals belong to wherever the selection sat before the drag started, so a
// turn mid-drag has to take the positions the drag has put it in instead
function dropIdealsIfDragging(items, ts, ss){
  if(!ST.drag || ST.drag.mode!=='gmove') return;
  items.forEach(p=>{ delete p._ix; delete p._iy; });
  ts.forEach(t=>{ delete t._ix; delete t._iy; });
  ss.forEach(s=>{ delete s._ipts; });
}
// rigid rotation of the whole selection by +/-90 around its bounding-box center,
// so the arrangement keeps its shape (connections preserved) at a new angle
// rotation increment: 45deg while snap is on, finer 5deg while snap is off
export function rotStep(){ return ST.snapOn ? 45 : 5; }
// with snap on, land on the 45deg grid (align an off-grid angle first), not +45
export function snapRotTarget(cur, dir){ return dir>0 ? Math.floor(cur/45)*45+45 : Math.ceil(cur/45)*45-45; }
export function stepPlaceRot(dir){
  if(ST.snapOn) ST.placeRot = ((snapRotTarget(ST.placeRot,dir))%360+360)%360;
  else ST.placeRot = ((ST.placeRot + dir*5)%360+360)%360;
  render();
}
// texts and strokes in the current selection (rotate/mirror targets)
export function selTextObjs(){ return ST.texts.filter(t=>ST.selTexts.includes(t.id)); }
export function selStrokeObjs(){ return ST.strokes.filter(s=>ST.selStrokes.indexOf(s)!==-1); }
export function rotateGroup(step){
  const items=selectedPieces(), ts=selTextObjs(), ss=selStrokeObjs();
  if(!items.length && !ts.length && !ss.length) return;
  // snap on: rotate to the nearest 45deg cardinal (fixes a freely-rotated object
  // that would otherwise gain 45deg on top of its off-grid angle)
  dropIdealsIfDragging(items, ts, ss);
  const ref = items[0] || ts[0];
  if(ST.snapOn && ref){
    const r0=ref.rot||0, dir=step<0?-1:1;
    const want=snapRotTarget(r0,dir)-r0;
    step = (items[0]&&items[0].flip) ? -want : want;   // flipped pieces store the opposite sense
  }
  // rotate exact "ideal" positions, kept across consecutive rotations: the
  // visible position re-derives from them every turn, so the half-cell re-snap
  // below can never accumulate into drift (any move/mirror clears the ideals)
  items.forEach(p=>{ if(p._ix==null){ p._ix=p.x; p._iy=p.y; } });
  ts.forEach(t=>{ if(t._ix==null){ t._ix=t.x; t._iy=t.y; } });
  ss.forEach(s=>{ if(!s._ipts) s._ipts=s.pts.map(pt=>({x:pt.x,y:pt.y})); });
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  const grow=(a,b,c,d)=>{ minx=Math.min(minx,a); miny=Math.min(miny,b); maxx=Math.max(maxx,c); maxy=Math.max(maxy,d); };
  items.forEach(p=>{ const b=pieceAABB({type:p.type,x:p._ix,y:p._iy,rot:p.rot}); grow(b.minx,b.miny,b.maxx,b.maxy); });
  ts.forEach(t=>{ const b=textBox(t), r=Math.hypot(b.w,b.h)/2; grow(t._ix-r,t._iy-r,t._ix+r,t._iy+r); });
  ss.forEach(s=>{ s._ipts.forEach(pt=>grow(pt.x,pt.y,pt.x,pt.y)); });
  const cx=(minx+maxx)/2, cy=(miny+maxy)/2;
  const rad=step*Math.PI/180, cs=Math.cos(rad), sn=Math.sin(rad);
  const rotPt=(o)=>{ const dx=o.x-cx, dy=o.y-cy;
    return {x:cx + dx*cs - dy*sn, y:cy + dx*sn + dy*cs}; };   // clockwise (canvas y-down)
  items.forEach(p=>{
    const n=rotPt({x:p._ix,y:p._iy}); p._ix=n.x; p._iy=n.y; p.x=n.x; p.y=n.y;
    // drawPiece applies flip BEFORE rotate, so a mirrored piece rotates the
    // opposite way on screen: R(step)*S = S*R(-step). Subtract for flipped ones.
    const st=p.flip?-step:step;
    p.rot=(((p.rot+st)%360)+360)%360;
  });
  ts.forEach(t=>{
    const n=rotPt({x:t._ix,y:t._iy}); t._ix=n.x; t._iy=n.y; t.x=n.x; t.y=n.y;
    t.rot=((((t.rot||0)+step)%360)+360)%360;
  });
  ss.forEach(s=>{
    s._ipts=s._ipts.map(pt=>rotPt(pt));
    s.pts.forEach((pt,k)=>{ pt.x=s._ipts[k].x; pt.y=s._ipts[k].y; });
  });
  // A rotation about the bbox center can land the whole arrangement a half-cell
  // off the grid. The offset is uniform for every piece, so snap ONE anchor and
  // shift the rest by the same delta: keeps the shape while putting cells back on
  // grid lines. Only meaningful at right angles, so skip it for 45deg/free steps.
  if(ST.snapOn && items.length && ((Math.round(items[0].rot)%90)===0)){
    const a=items[0], s=snapCenter(a.type,a.rot,a.x,a.y);
    const dx=s.x-a.x, dy=s.y-a.y;
    if(dx||dy){
      items.forEach(p=>{ p.x+=dx; p.y+=dy; });
      ts.forEach(t=>{ t.x+=dx; t.y+=dy; });
      ss.forEach(s2=>s2.pts.forEach(pt=>{ pt.x+=dx; pt.y+=dy; }));
    }
  }
  rebaseDrag();
  snapshot(); render(); updateStatus();
}
// mirror the whole selection across its bounding-box vertical axis. scale(-1,1)
// in drawPiece handles per-piece reflection; rotation is preserved because the
// flip is applied before the rotate, so M*R(theta) is the true mirror.
export function mirrorGroup(){
  const items=selectedPieces(), ts=selTextObjs(), ss=selStrokeObjs();
  if(!items.length && !ts.length && !ss.length) return;
  let minx=Infinity,maxx=-Infinity;
  items.forEach(p=>{ const b=pieceAABB(p); minx=Math.min(minx,b.minx); maxx=Math.max(maxx,b.maxx); });
  ts.forEach(t=>{ const b=textBox(t), r=Math.hypot(b.w,b.h)/2; minx=Math.min(minx,t.x-r); maxx=Math.max(maxx,t.x+r); });
  ss.forEach(s=>{ const b=strokeBBox(s); if(b){ minx=Math.min(minx,b.minx); maxx=Math.max(maxx,b.maxx); } });
  const cx=(minx+maxx)/2;
  items.forEach(p=>{ p.x=2*cx-p.x; p.flip=!p.flip; delete p._ix; delete p._iy; });
  // labels mirror their spot and angle but keep readable glyphs
  ts.forEach(t=>{ t.x=2*cx-t.x; t.rot=((-(t.rot||0))%360+360)%360; delete t._ix; delete t._iy; });
  ss.forEach(s=>{ s.pts.forEach(pt=>{ pt.x=2*cx-pt.x; }); delete s._ipts; });
  rebaseDrag();                    // mirroring mid-drag fought it the same way
  snapshot(); render(); updateStatus();
}
// after removing supports, upper-floor pieces with nothing fully under them
// fall: delete them too, cascading floor by floor upward
export function collapseUnsupported(){
  let removedAny=false, changed=true;
  while(changed){
    changed=false;
    for(let i=ST.pieces.length-1;i>=0;i--){ const p=ST.pieces[i];
      if(pieceLayer(p)>0 && !canPlace(p.type,p.x,p.y,p.rot,pieceLayer(p))){
        ST.pieces.splice(i,1); changed=true; removedAny=true;
      }
    }
  }
  if(removedAny) ST.selected=ST.selected.filter(id=>ST.pieces.some(p=>p.id===id));
  return removedAny;
}
export function deleteSel(){
  let changed=false;
  if(ST.selected.length){ ST.pieces=ST.pieces.filter(p=>!isSel(p.id)); clearSelection(); changed=true;
    if(collapseUnsupported()) flashToast('Unsupported structures collapsed'); }
  if(ST.selImages.length){ ST.images=ST.images.filter(i=>!ST.selImages.includes(i.id)); ST.selImages=[]; changed=true; }
  if(ST.selTexts.length){ ST.texts=ST.texts.filter(t=>!ST.selTexts.includes(t.id)); ST.selTexts=[]; changed=true; }
  if(ST.selStrokes.length){ ST.strokes=ST.strokes.filter(s=>ST.selStrokes.indexOf(s)===-1); ST.selStrokes=[]; changed=true; }
  if(changed){ snapshot(); render(); updateStatus(); }
}
// Duplicate = capture the selection as a reusable "stamp", drop it into Recent,
// and enter ghost-placement so it can be stamped down as many times as you like.
export function duplicateSel(){ const items=selectedPieces(); if(!items.length)return;
  const st=addStamp(makeStampFromSel(items));
  startPlacing(st);
}
