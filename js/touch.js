import { cv, stage } from './dom.js';
import { persist } from './history.js';
import { render } from './render.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';

// ---------------- touch: two-finger pinch zoom / pan (capture on stage runs
// before the canvas handlers, so a second finger hijacks any single-finger
// gesture into a pinch without desktop code ever seeing it)
export const tpts = new Map();     // active touch pointers on the canvas (screen coords)
stage.addEventListener('pointerdown', e=>{
  if(e.pointerType!=='touch' || e.target!==cv) return;
  tpts.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(tpts.size===2){ e.preventDefault(); e.stopPropagation(); beginPinch(); }
  else if(tpts.size>2){ e.stopPropagation(); }
}, true);
export function beginPinch(){
  if(ST.drag){   // roll back whatever the first finger started
    if(ST.drag.mode==='draw') ST.strokes.pop();
    else if(ST.drag.mode==='gmove'){
      ST.drag.ps.forEach(it=>{ it.p.x=it.ox; it.p.y=it.oy; });
      ST.drag.ims.forEach(it=>{ it.im.x=it.ox; it.im.y=it.oy; });
      ST.drag.ts.forEach(it=>{ it.t.x=it.ox; it.t.y=it.oy; });
      ST.drag.ss.forEach(it=>{ it.s.pts.forEach((pt,k)=>{ pt.x=it.pts[k].x; pt.y=it.pts[k].y; }); });
    }
    else if(ST.drag.mode==='imgresize'){ ST.drag.im.w=ST.drag.ow; ST.drag.im.h=ST.drag.ow/ST.drag.ar; }
    ST.drag=null; ST.marquee=null; stage.classList.remove('c-panning','c-move');
  }
  for(const id of tpts.keys()){ try{ cv.setPointerCapture(id); }catch(_){} }
  const [a,b]=[...tpts.values()];
  ST.pinch={d:Math.max(10,Math.hypot(a.x-b.x,a.y-b.y)), cx:(a.x+b.x)/2, cy:(a.y+b.y)/2,
    scale:ST.view.scale, ox:ST.view.ox, oy:ST.view.oy};
  render();
}
stage.addEventListener('pointermove', e=>{
  if(e.pointerType!=='touch') return;
  if(tpts.has(e.pointerId)) tpts.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(!ST.pinch || tpts.size<2) return;
  e.stopPropagation();
  const rc=cv.getBoundingClientRect();
  const [a,b]=[...tpts.values()];
  const d=Math.max(10,Math.hypot(a.x-b.x,a.y-b.y));
  const cx=(a.x+b.x)/2-rc.left, cy=(a.y+b.y)/2-rc.top;
  const ns=Math.min(6, Math.max(0.15, ST.pinch.scale*(d/ST.pinch.d)));
  // keep the world point that was under the start midpoint glued to the current midpoint
  const wx=((ST.pinch.cx-rc.left)-ST.pinch.ox)/ST.pinch.scale, wy=((ST.pinch.cy-rc.top)-ST.pinch.oy)/ST.pinch.scale;
  ST.view.scale=ns; ST.view.ox=cx-wx*ns; ST.view.oy=cy-wy*ns;
  render(); updateStatus();
}, true);
export function endTouch(e){
  if(e.pointerType!=='touch') return;
  tpts.delete(e.pointerId);
  if(ST.pinch){ e.stopPropagation(); if(tpts.size<2){ ST.pinch=null; persist(); } }
  else if(e.type==='pointercancel' && ST.drag){   // OS stole the touch: drop the gesture
    ST.drag=null; ST.marquee=null; stage.classList.remove('c-panning','c-move'); render();
  }
}
stage.addEventListener('pointerup', endTouch, true);
stage.addEventListener('pointercancel', endTouch, true);
