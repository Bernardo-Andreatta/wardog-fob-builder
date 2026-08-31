import { CATALOG, SYMBOLS } from './catalog.js';
import { editNewOverlay } from './tools.js';
import { eyedropPiece, openCtx } from './ctxmenu.js';
import { GRID, cv, stage } from './dom.js';
import { pieceLayer, placeError } from './floors.js';
import { handleXY, hitPiece, screenToWorld, snapCenter, worldToScreen } from './geometry.js';
import { expandGroups } from './groups.js';
import { persist, snapshot } from './history.js';
import { layerEditable } from './layers.js';
import { ensureFloorLayer } from './layerspanel.js';
import { addText, hitImage, hitStroke, hitText, openTextEditor, strokeBBox, textBox } from './overlays.js';
import { planVisible } from './plan.js';
import { pieceAABB, render } from './render.js';
import { clearOverlaySel, clearSelection, isSel, selectedPieces } from './selection.js';
import { stampInstance } from './stamps.js';
import { ST } from './state.js';
import { updateCursor, updateStatus } from './status.js';
import { flashToast } from './topbar.js';
import { tpts } from './touch.js';

export function evtW(e){ const rc=cv.getBoundingClientRect(); return screenToWorld(e.clientX-rc.left,e.clientY-rc.top); }
export function evtS(e){ const rc=cv.getBoundingClientRect(); return {x:e.clientX-rc.left,y:e.clientY-rc.top}; }

// distance from point to a line segment
export function segDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy;
  let t = l2 ? ((px-ax)*dx+(py-ay)*dy)/l2 : 0; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
// erase any free-draw strokes under the cursor
export function eraseAt(w){
  let changed=false;
  for(let i=ST.strokes.length-1;i>=0;i--){
    const s=ST.strokes[i], th=s.width/2 + 9/ST.view.scale;
    let hit=false;
    if(s.pts.length<2){ hit=Math.hypot(w.x-s.pts[0].x, w.y-s.pts[0].y)<th; }
    else for(let k=1;k<s.pts.length;k++){
      if(segDist(w.x,w.y, s.pts[k-1].x,s.pts[k-1].y, s.pts[k].x,s.pts[k].y)<th){ hit=true; break; } }
    if(hit){ ST.strokes.splice(i,1); changed=true; }
  }
  if(changed){ if(ST.drag) ST.drag.erased=true; render(); }
}

// world distance from the ghost's center to its lowest edge, for the current
// rotation - so the touch-drag offset always lifts the whole piece above the
// finger, even for long pieces rotated vertical
export function ghostDrop(){
  const half=(type,rot)=>{ const c=CATALOG[type], r=(rot||0)*Math.PI/180;
    return (Math.abs(Math.sin(r))*c.w*GRID + Math.abs(Math.cos(r))*c.h*GRID)/2; };
  if(CATALOG[ST.tool]) return half(ST.tool,ST.placeRot);
  if(ST.tool==='stamp' && ST.activeStamp){ let m=GRID/2;
    stampInstance(ST.activeStamp,0,0,ST.placeRot,ST.placeFlip).forEach(ip=>{ m=Math.max(m, ip.y + half(ip.type,ip.rot)); });
    return m; }
  return GRID/2;
}

export function placeSymbolAt(w){
  const cx=ST.snapOn?Math.round(w.x/SNAP)*SNAP:w.x, cy=ST.snapOn?Math.round(w.y/SNAP)*SNAP:w.y;
  const s={pts:SYMBOLS[ST.tool](cx,cy,GRID), color:ST.drawColor, width:ST.drawWidth, ly:ST.curLayerId};
  ST.strokes.push(s);
  clearSelection(); clearOverlaySel(); ST.selStrokes=[s];   // selected, ready to move/resize
  editNewOverlay();
  snapshot(); render(); updateStatus();
}

export function placeStampAt(w){
  const inst=stampInstance(ST.activeStamp, w.x, w.y, ST.placeRot, ST.placeFlip);
  // every part must be a legal placement (support + no overlap + inside a FOB area)
  for(const ip of inst){ const err=placeError(ip.type, ip.x, ip.y, ip.rot, ST.curLayer); if(err){ flashToast(err); return; } }
  ensureFloorLayer();
  const gid = inst.length>1 ? ST.groupUid++ : undefined;   // a multi-piece stamp lands as one Group
  const nn=inst.map(ip=>({id:ST.uid++, type:ip.type, x:ip.x, y:ip.y, rot:ip.rot, flip:!!ip.flip, l:ST.curLayer, ly:ST.curLayerId, g:gid, st:ST.curStageId, bd:ST.curBuilderId}));
  ST.pieces.push(...nn); clearSelection(); snapshot(); render(); updateStatus();
}
export function placePieceAt(w){
  const c=snapCenter(ST.tool,ST.placeRot,w.x,w.y);
  const err=placeError(ST.tool,c.x,c.y,ST.placeRot,ST.curLayer);
  if(err){ flashToast(err); return; }
  ensureFloorLayer();
  const np={id:ST.uid++,type:ST.tool,x:c.x,y:c.y,rot:ST.placeRot,flip:ST.placeFlip,l:ST.curLayer,ly:ST.curLayerId,st:ST.curStageId,bd:ST.curBuilderId};
  ST.pieces.push(np); clearSelection(); clearOverlaySel(); snapshot(); render(); updateStatus();
}

cv.addEventListener('pointerdown', e=>{
  if(e.button===2) return;                 // right-click handled by contextmenu
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const w=evtW(e), sc=evtS(e);
  // a floating touch move is waiting: this tap just drops it where it sits
  if(ST.pendingMove){ commitPendingMove(); ST.drag={mode:'placed'}; render(); updateStatus(); return; }
  if(e.button===1 || ST.spaceDown || ST.tool==='pan'){
    ST.drag={mode:'pan',sx:sc.x,sy:sc.y,ox:ST.view.ox,oy:ST.view.oy}; stage.classList.add('c-panning'); return;
  }
  if(ST.tool==='eyedrop'){
    const h=hitPiece(w.x,w.y);
    if(!h || !eyedropPiece(h)) flashToast('Nothing to pick there');
    ST.drag={mode:'placed'}; return;
  }
  if(ST.tool==='draw'){
    const s={pts:[{x:w.x,y:w.y}],color:ST.drawColor,width:ST.drawWidth,ly:ST.curLayerId};
    ST.strokes.push(s); ST.drag={mode:'draw',s}; render(); return;
  }
  if(ST.tool==='erase'){ ST.drag={mode:'erase',erased:false}; eraseAt(w); return; }
  // touch: a drag only aims the ghost; a plain tap places it (on the ghost =
  // confirm its aimed spot, elsewhere = place right there). Mouse places on press.
  if(ST.tool==='stamp' && ST.activeStamp){
    if(e.pointerType==='touch'){ ST.drag={mode:'tapplace', kind:'stamp', w, ss:sc, moved:false, prev:{x:ST.hover.x,y:ST.hover.y}}; return; }
    placeStampAt(w); ST.drag={mode:'placed'}; return;
  }
  if(CATALOG[ST.tool]){
    if(e.pointerType==='touch'){ ST.drag={mode:'tapplace', kind:'piece', w, ss:sc, moved:false, prev:{x:ST.hover.x,y:ST.hover.y}}; return; }
    placePieceAt(w); ST.drag={mode:'placed'}; return;
  }
  if(SYMBOLS[ST.tool]){
    if(e.pointerType==='touch'){ ST.drag={mode:'tapplace', kind:'sym', w, ss:sc, moved:false}; return; }
    placeSymbolAt(w); ST.drag={mode:'placed'}; return;
  }
  if(ST.tool==='text'){
    if(e.pointerType==='touch'){ ST.drag={mode:'tapplace', kind:'text', w, ss:sc, moved:false}; return; }
    clearSelection(); addText(w); ST.drag={mode:'placed'}; return;
  }
  // --- select tool ---
  const singlePieceSel = ST.selected.length===1 && !ST.selImages.length && !ST.selTexts.length && !ST.selStrokes.length;
  const singleImgSel   = ST.selImages.length===1 && !ST.selected.length && !ST.selTexts.length && !ST.selStrokes.length;
  // rotate handle (single piece only)
  if(singlePieceSel){
    const sel=ST.pieces.find(p=>p.id===ST.selected[0]);
    if(sel){ const hs=handleXY(sel); const hss=worldToScreen(hs.x,hs.y);
      if(Math.hypot(hss.x-sc.x,hss.y-sc.y)<=13){ ST.drag={mode:'rotate',p:sel}; return; } }
  }
  // image resize handle (single image only)
  if(singleImgSel){ const im=ST.images.find(i=>i.id===ST.selImages[0]);
    if(im){ const h=worldToScreen(im.x+im.w/2, im.y+im.h/2);
      if(Math.hypot(h.x-sc.x,h.y-sc.y)<=13){ ST.drag={mode:'imgresize', im, ar:im.w/im.h, startW:{x:w.x,y:w.y}, ow:im.w, moved:false}; return; } } }
  // drawing/symbol resize handle (single stroke only)
  const singleStrokeSel = ST.selStrokes.length===1 && !ST.selected.length && !ST.selImages.length && !ST.selTexts.length;
  if(singleStrokeSel){ const s=ST.selStrokes[0], bb=strokeBBox(s);
    if(bb){ const h=worldToScreen(bb.maxx, bb.maxy);
      if(Math.hypot(h.x-sc.x,h.y-sc.y)<=13){
        ST.drag={mode:'strokeresize', s, bb, startW:{x:w.x,y:w.y},
          pts0:s.pts.map(pt=>({x:pt.x,y:pt.y})), moved:false}; return; } } }
  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  // hit test top -> bottom: text, piece, drawing, image
  const tHit=hitText(w);
  const pHit=tHit?null:hitPiece(w.x,w.y);
  const sHit=(tHit||pHit)?null:hitStroke(w);
  const iHit=(tHit||pHit||sHit)?null:hitImage(w);
  if(tHit||pHit||sHit||iHit){
    const inStr = s=>ST.selStrokes.indexOf(s)!==-1;
    const wasSel = (pHit&&isSel(pHit.id)) || (tHit&&ST.selTexts.includes(tHit.id)) || (iHit&&ST.selImages.includes(iHit.id)) || (sHit&&inStr(sHit));
    if(additive){
      if(pHit){ if(isSel(pHit.id)) ST.selected=ST.selected.filter(id=>id!==pHit.id); else ST.selected.push(pHit.id); }
      else if(tHit){ if(ST.selTexts.includes(tHit.id)) ST.selTexts=ST.selTexts.filter(id=>id!==tHit.id); else ST.selTexts.push(tHit.id); }
      else if(iHit){ if(ST.selImages.includes(iHit.id)) ST.selImages=ST.selImages.filter(id=>id!==iHit.id); else ST.selImages.push(iHit.id); }
      else if(sHit){ if(inStr(sHit)) ST.selStrokes=ST.selStrokes.filter(x=>x!==sHit); else ST.selStrokes.push(sHit); }
    } else if(!wasSel){
      clearSelection(); clearOverlaySel();
      if(pHit) ST.selected=[pHit.id]; else if(tHit) ST.selTexts=[tHit.id]; else if(iHit) ST.selImages=[iHit.id]; else if(sHit) ST.selStrokes=[sHit];
    }
    expandGroups();   // clicking any grouped item selects its whole group
    const nowSel = (pHit&&isSel(pHit.id)) || (tHit&&ST.selTexts.includes(tHit.id)) || (iHit&&ST.selImages.includes(iHit.id)) || (sHit&&inStr(sHit));
    if(nowSel){ startGroupMove(w, pHit||null); ST.drag.touch=(e.pointerType==='touch'); }
    render(); updateStatus(); return;
  }
  // empty ground => rubber-band multi-select (pieces + overlays + drawings)
  if(!additive){ clearSelection(); clearOverlaySel(); }
  ST.marquee={x0:w.x,y0:w.y,x1:w.x,y1:w.y,
    base:{pieces:ST.selected.slice(), texts:ST.selTexts.slice(), imgs:ST.selImages.slice(), strokes:ST.selStrokes.slice()}};
  ST.drag={mode:'marquee'};
  render(); updateStatus();
});
// lowest world edge of everything in a move, from the positions it started at
export function selBottomAtStart(d){
  let bot=-Infinity;
  d.ps.forEach(it=>{ const b=pieceAABB({type:it.p.type, x:it.ox, y:it.oy, rot:it.p.rot}); bot=Math.max(bot,b.maxy); });
  d.ims.forEach(it=>{ bot=Math.max(bot, it.oy+it.im.h/2); });
  d.ts.forEach(it=>{ const b=textBox(it.t); bot=Math.max(bot, it.oy+b.h/2); });
  d.ss.forEach(it=>{ it.pts.forEach(pt=>{ bot=Math.max(bot, pt.y); }); });
  return bot===-Infinity ? d.startW.y : bot;
}
// A touch move finishes like a placement: the finger lift leaves the selection
// floating where it was dragged, and the next tap anywhere commits it.
export function commitPendingMove(){ if(ST.pendingMove){ ST.pendingMove=false; snapshot(); } }
export function startGroupMove(w, primary){
  ST.drag={ mode:'gmove', primary: primary||null,
    pox: primary?primary.x:0, poy: primary?primary.y:0, anchor:null,
    startW:{x:w.x,y:w.y}, moved:false,
    ps: selectedPieces().map(p=>({p,ox:p.x,oy:p.y})),
    ims: ST.images.filter(i=>ST.selImages.includes(i.id)).map(im=>({im,ox:im.x,oy:im.y})),
    ts: ST.texts.filter(t=>ST.selTexts.includes(t.id)).map(t=>({t,ox:t.x,oy:t.y})),
    ss: ST.strokes.filter(s=>ST.selStrokes.indexOf(s)!==-1).map(s=>({s,pts:s.pts.map(pt=>({x:pt.x,y:pt.y}))})) };
  if(!primary){
    if(ST.drag.ims[0]) ST.drag.anchor={ox:ST.drag.ims[0].ox, oy:ST.drag.ims[0].oy};
    else if(ST.drag.ts[0]) ST.drag.anchor={ox:ST.drag.ts[0].ox, oy:ST.drag.ts[0].oy};
    else if(ST.drag.ss[0]) ST.drag.anchor={ox:ST.drag.ss[0].pts[0].x, oy:ST.drag.ss[0].pts[0].y};
  }
  stage.classList.add('c-move');
}
cv.addEventListener('pointermove', e=>{
  const w=evtW(e), sc=evtS(e); ST.hover=w;
  if(ST.drag){
    if(ST.drag.mode==='pan'){ ST.view.ox=ST.drag.ox+(sc.x-ST.drag.sx); ST.view.oy=ST.drag.oy+(sc.y-ST.drag.sy); render(); }
    else if(ST.drag.mode==='gmove'){
      // move the whole selection (pieces + images + texts + drawings) as one
      let rawdx=w.x-ST.drag.startW.x, rawdy=w.y-ST.drag.startW.y;
      // on touch, once the drag really starts, lift the selection clear of the
      // finger so it stays visible - measured once so it doesn't drift
      if(ST.drag.touch){
        if(!ST.drag.lifted && Math.hypot(rawdx,rawdy)*ST.view.scale>8){
          ST.drag.lifted=true;
          ST.drag.lift=(selBottomAtStart(ST.drag)-ST.drag.startW.y)+40/ST.view.scale;
        }
        if(ST.drag.lifted) rawdy-=ST.drag.lift;
      }
      let ddx=rawdx, ddy=rawdy;
      if(ST.drag.primary){ const s=snapCenter(ST.drag.primary.type, ST.drag.primary.rot, ST.drag.pox+rawdx, ST.drag.poy+rawdy);
        ddx=s.x-ST.drag.pox; ddy=s.y-ST.drag.poy; }
      else if(ST.snapOn && ST.drag.anchor){ ddx=Math.round((ST.drag.anchor.ox+rawdx)/SNAP)*SNAP-ST.drag.anchor.ox;
        ddy=Math.round((ST.drag.anchor.oy+rawdy)/SNAP)*SNAP-ST.drag.anchor.oy; }
      ST.drag.ps.forEach(it=>{ it.p.x=it.ox+ddx; it.p.y=it.oy+ddy; });
      ST.drag.ims.forEach(it=>{ it.im.x=it.ox+ddx; it.im.y=it.oy+ddy; });
      ST.drag.ts.forEach(it=>{ it.t.x=it.ox+ddx; it.t.y=it.oy+ddy; });
      ST.drag.ss.forEach(it=>{ it.s.pts.forEach((pt,k)=>{ pt.x=it.pts[k].x+ddx; pt.y=it.pts[k].y+ddy; }); });
      ST.drag.moved=true; render(); updateStatus();
    }
    else if(ST.drag.mode==='rotate'){
      let ang=Math.atan2(w.x-ST.drag.p.x, -(w.y-ST.drag.p.y))*180/Math.PI;
      if(!e.shiftKey && e.pointerType!=='touch') ang=Math.round(ang/5)*5;   // touch handle = free rotation
      ST.drag.p.rot=((ang%360)+360)%360; render(); updateStatus();
    }
    else if(ST.drag.mode==='marquee'){
      ST.marquee.x1=w.x; ST.marquee.y1=w.y;
      const bx0=Math.min(ST.marquee.x0,ST.marquee.x1), by0=Math.min(ST.marquee.y0,ST.marquee.y1);
      const bx1=Math.max(ST.marquee.x0,ST.marquee.x1), by1=Math.max(ST.marquee.y0,ST.marquee.y1);
      const B=ST.marquee.base;
      ST.selected=B.pieces.slice();
      ST.pieces.forEach(p=>{ if(pieceLayer(p)>ST.curLayer || !layerEditable(p) || !planVisible(p)) return; const b=pieceAABB(p);
        if(b.minx<=bx1&&b.maxx>=bx0&&b.miny<=by1&&b.maxy>=by0 && !isSel(p.id)) ST.selected.push(p.id); });
      ST.selTexts=B.texts.slice();
      ST.texts.forEach(t=>{ if(!layerEditable(t)) return; if(t.x>=bx0&&t.x<=bx1&&t.y>=by0&&t.y<=by1 && !ST.selTexts.includes(t.id)) ST.selTexts.push(t.id); });
      ST.selImages=B.imgs.slice();
      ST.images.forEach(im=>{ if(!layerEditable(im)) return; if(im.x-im.w/2<=bx1&&im.x+im.w/2>=bx0&&im.y-im.h/2<=by1&&im.y+im.h/2>=by0 && !ST.selImages.includes(im.id)) ST.selImages.push(im.id); });
      ST.selStrokes=B.strokes.slice();
      ST.strokes.forEach(s=>{ if(!layerEditable(s)) return; const bb=strokeBBox(s);
        if(bb && bb.minx<=bx1&&bb.maxx>=bx0&&bb.miny<=by1&&bb.maxy>=by0 && ST.selStrokes.indexOf(s)===-1) ST.selStrokes.push(s); });
      // grouped items pull their whole group in - but only from visible layers
      expandGroups();
      render(); updateStatus();
    }
    else if(ST.drag.mode==='imgresize'){
      let nw=ST.drag.ow+(w.x-ST.drag.startW.x); nw=Math.max(GRID, nw);
      ST.drag.im.w=nw; ST.drag.im.h=nw/ST.drag.ar; ST.drag.moved=true; render();
    }
    else if(ST.drag.mode==='strokeresize'){
      // scale about the bbox top-left corner; x and y scale independently
      const bb=ST.drag.bb, dx0=ST.drag.startW.x-bb.minx, dy0=ST.drag.startW.y-bb.miny;
      const fx=dx0>4 ? Math.max(0.05,(w.x-bb.minx)/dx0) : 1;
      const fy=dy0>4 ? Math.max(0.05,(w.y-bb.miny)/dy0) : 1;
      ST.drag.s.pts.forEach((pt,k)=>{ pt.x=bb.minx+(ST.drag.pts0[k].x-bb.minx)*fx;
        pt.y=bb.miny+(ST.drag.pts0[k].y-bb.miny)*fy; });
      delete ST.drag.s._ipts;
      ST.drag.moved=true; render();
    }
    else if(ST.drag.mode==='draw'){
      const last=ST.drag.s.pts[ST.drag.s.pts.length-1];
      if(Math.hypot(w.x-last.x,w.y-last.y)>1.5){ ST.drag.s.pts.push({x:w.x,y:w.y}); render(); }
    }
    else if(ST.drag.mode==='erase'){ eraseAt(w); }
    else if(ST.drag.mode==='tapplace'){
      ST.drag.w=w;
      if(!ST.drag.moved && Math.hypot(sc.x-ST.drag.ss.x, sc.y-ST.drag.ss.y)>10) ST.drag.moved=true;
      // dragging: ghost rides above the finger so it isn't hidden under it -
      // its lowest edge clears the finger whatever the rotation; it stays at
      // that offset spot on lift, and a tap anywhere confirms it there
      if(ST.drag.moved){ ST.hover={x:w.x, y:w.y-ghostDrop()-40/ST.view.scale}; render(); }
      else if(ST.drag.prev) ST.hover=ST.drag.prev;            // mere tap wiggle: ghost stays put
    }
  } else if(CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp)) render();  // ghost follows cursor
  updateCursor(w);
});
cv.addEventListener('pointerup', ()=>{
  if(ST.drag){
    if(ST.drag.mode==='tapplace' && !ST.drag.moved){   // only a plain tap places
      const w=ST.drag.w;
      if(ST.drag.kind==='text'){ clearSelection(); addText(w); }
      else if(ST.drag.kind==='sym'){ if(SYMBOLS[ST.tool]) placeSymbolAt(w); }
      else{
        // any tap confirms the ghost where it sits (aiming by tap is too
        // imprecise on touch - drag aims, tap commits)
        const at={x:ST.hover.x, y:ST.hover.y};
        if(ST.drag.kind==='stamp' && ST.activeStamp) placeStampAt(at);
        else if(ST.drag.kind==='piece' && CATALOG[ST.tool]) placePieceAt(at);
      }
    }
    if(ST.drag.mode==='gmove' && ST.drag.moved){
      ST.drag.ps.forEach(it=>{ delete it.p._ix; delete it.p._iy; });
      ST.drag.ts.forEach(it=>{ delete it.t._ix; delete it.t._iy; });
      ST.drag.ss.forEach(it=>{ delete it.s._ipts; });
    }
    if(ST.drag.mode==='gmove' && ST.drag.moved && ST.drag.touch) ST.pendingMove=true;   // confirmed by the next tap
    else if((ST.drag.mode==='gmove'&&ST.drag.moved)||ST.drag.mode==='rotate'||ST.drag.mode==='draw'||(ST.drag.mode==='erase'&&ST.drag.erased)
      || (ST.drag.mode==='imgresize'&&ST.drag.moved) || (ST.drag.mode==='strokeresize'&&ST.drag.moved)) snapshot();
  }
  ST.drag=null; ST.marquee=null; stage.classList.remove('c-panning','c-move'); render();
});
// double-click a text label to edit it
cv.addEventListener('dblclick', e=>{
  const w=evtW(e); const tt=hitText(w);
  if(tt){ clearSelection(); clearOverlaySel(); ST.selTexts=[tt.id]; render(); openTextEditor(tt, false); }
});
// right-click (and touch long-press) opens the context menu for whatever is
// under the cursor - see openCtx
cv.addEventListener('contextmenu', e=>{
  e.preventDefault();
  if(ST.drag || ST.pinch || tpts.size) return;   // mid-gesture: not a menu
  openCtx(e);
});
// Trackpads send a pinch as ctrl+wheel, and a two-finger swipe as a plain wheel
// with a horizontal component or fractional steps. A mouse wheel sends neither,
// so it keeps its zoom behaviour until a trackpad actually shows up.
export function noteTrackpad(e){
  if(e.ctrlKey || e.deltaX!==0) ST.trackpad=true;
  else if(e.deltaMode===0 && e.deltaY!==0 && Math.abs(e.deltaY)<50 && !Number.isInteger(e.deltaY)) ST.trackpad=true;
}
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  noteTrackpad(e);
  if(ST.trackpad && !e.ctrlKey){                 // two-finger swipe: pan the camera
    ST.view.ox-=e.deltaX; ST.view.oy-=e.deltaY;
    render(); updateStatus(); persist(); return;
  }
  const sc=evtS(e), before=screenToWorld(sc.x,sc.y);
  // pinch reports a continuous delta, a wheel notch a fixed step
  const f = e.ctrlKey ? Math.exp(-e.deltaY*0.01) : (e.deltaY<0?1.12:1/1.12);
  ST.view.scale=Math.min(6,Math.max(0.15,ST.view.scale*f));
  const after=screenToWorld(sc.x,sc.y);
  ST.view.ox+=(after.x-before.x)*ST.view.scale; ST.view.oy+=(after.y-before.y)*ST.view.scale;
  render(); updateStatus(); persist();
}, {passive:false});
