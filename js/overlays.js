import { GRID, ctx, isCoarse, stage } from './dom.js';
import { editNewOverlay } from './tools.js';
import { screenToWorld, worldToScreen } from './geometry.js';
import { snapshot } from './history.js';
import { layerEditable } from './layers.js';
import { segDist } from './pointer.js';
import { cssVar, render } from './render.js';
import { clearOverlaySel, clearSelection } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';

// ---------------- text + image overlays
export function drawText(g,t,col){
  g.save(); g.globalAlpha=1; g.fillStyle=col||t.color||cssVar('--piece');
  g.font='600 '+t.size+'px Oswald, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  g.translate(t.x,t.y); g.rotate((t.rot||0)*Math.PI/180);
  g.fillText(t.text||'', 0, 0); g.restore();
}
export function textBox(t){
  ctx.save(); ctx.font='600 '+t.size+'px Oswald, sans-serif';
  const w=Math.max(ctx.measureText(t.text||' ').width, t.size*0.5), h=t.size*1.25;
  ctx.restore(); return {w,h};
}
export function hitText(pt){ const pad=4/ST.view.scale;
  for(let i=ST.texts.length-1;i>=0;i--){ const t=ST.texts[i]; if(!layerEditable(t)) continue; const b=textBox(t);
    const rad=-(t.rot||0)*Math.PI/180, dx=pt.x-t.x, dy=pt.y-t.y;
    const lx=dx*Math.cos(rad)-dy*Math.sin(rad), ly=dx*Math.sin(rad)+dy*Math.cos(rad);
    if(Math.abs(lx)<=b.w/2+pad && Math.abs(ly)<=b.h/2+pad) return t; }
  return null;
}
export function drawTextSel(t,col){ const b=textBox(t), pad=6/ST.view.scale;
  ctx.save(); ctx.translate(t.x,t.y); ctx.rotate((t.rot||0)*Math.PI/180);
  ctx.strokeStyle=col; ctx.lineWidth=1.4/ST.view.scale; ctx.setLineDash([6/ST.view.scale,4/ST.view.scale]);
  ctx.strokeRect(-b.w/2-pad, -b.h/2-pad, b.w+2*pad, b.h+2*pad); ctx.setLineDash([]); ctx.restore();
}
export function hitImage(pt){ for(let i=ST.images.length-1;i>=0;i--){ const im=ST.images[i]; if(!layerEditable(im)) continue;
  if(Math.abs(pt.x-im.x)<=im.w/2 && Math.abs(pt.y-im.y)<=im.h/2) return im; } return null; }
export function hitStroke(pt){
  for(let i=ST.strokes.length-1;i>=0;i--){ const s=ST.strokes[i]; if(!layerEditable(s)) continue; const th=s.width/2 + 9/ST.view.scale;
    if(s.pts.length<2){ if(Math.hypot(pt.x-s.pts[0].x, pt.y-s.pts[0].y)<th) return s; }
    else { for(let k=1;k<s.pts.length;k++){
      if(segDist(pt.x,pt.y, s.pts[k-1].x,s.pts[k-1].y, s.pts[k].x,s.pts[k].y)<th) return s; } }
  }
  return null; }
export function imgHandleXY(im){ return {x:im.x+im.w/2, y:im.y+im.h/2}; }
export function drawImageSel(im,col,handle){
  ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.4/ST.view.scale; ctx.setLineDash([6/ST.view.scale,4/ST.view.scale]);
  ctx.strokeRect(im.x-im.w/2, im.y-im.h/2, im.w, im.h); ctx.setLineDash([]);
  if(handle){ const h=imgHandleXY(im), r=6/ST.view.scale; ctx.fillStyle=col; ctx.fillRect(h.x-r,h.y-r,2*r,2*r); }
  ctx.restore();
}
export function strokeBBox(s){ if(!s.pts||!s.pts.length) return null;
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  s.pts.forEach(pt=>{ a=Math.min(a,pt.x);c=Math.max(c,pt.x);b=Math.min(b,pt.y);d=Math.max(d,pt.y); });
  return {minx:a,miny:b,maxx:c,maxy:d}; }
export function drawStrokeSel(s,col,handle){ const bb=strokeBBox(s); if(!bb) return; const pad=6/ST.view.scale;
  ctx.save(); ctx.strokeStyle=col; ctx.lineWidth=1.4/ST.view.scale; ctx.setLineDash([6/ST.view.scale,4/ST.view.scale]);
  ctx.strokeRect(bb.minx-pad,bb.miny-pad,(bb.maxx-bb.minx)+2*pad,(bb.maxy-bb.miny)+2*pad); ctx.setLineDash([]);
  if(handle){ const r=6/ST.view.scale; ctx.fillStyle=col; ctx.fillRect(bb.maxx-r,bb.maxy-r,2*r,2*r); }
  ctx.restore(); }
export function uploadImage(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f) return; const rd=new FileReader();
    rd.onload=()=>{ const src=rd.result, img=new Image();
      img.onload=()=>{ const ctr=screenToWorld(stage.clientWidth/2, stage.clientHeight/2);
        const scl=(GRID*8)/Math.max(img.naturalWidth, img.naturalHeight);
        const im={id:ST.uid++, x:ctr.x, y:ctr.y, w:img.naturalWidth*scl, h:img.naturalHeight*scl, src, _img:img, ly:ST.curLayerId};
        ST.images.push(im); clearSelection(); clearOverlaySel(); ST.selImages=[im.id]; editNewOverlay();
        snapshot(); render(); };
      img.src=src; };
    rd.readAsDataURL(f); };
  inp.click();
}
export function addText(pt){
  const t={id:ST.uid++, x:pt.x, y:pt.y, text:'', size:GRID*0.6, color:cssVar('--piece'), ly:ST.curLayerId};
  ST.texts.push(t); clearSelection(); clearOverlaySel(); ST.selTexts=[t.id];
  openTextEditor(t, true); render();
}
export function openTextEditor(t, isNew){
  const ed=document.createElement('input'); ed.type='text'; ed.value=t.text||''; ed.className='text-edit'; ed.spellcheck=false;
  const place=()=>{ const s=worldToScreen(t.x,t.y); ed.style.left=s.x+'px'; ed.style.top=s.y+'px';
    ed.style.font='600 '+Math.max(isCoarse()?16:13,t.size*ST.view.scale)+'px Oswald, sans-serif'; };  // >=16px stops iOS zoom
  stage.appendChild(ed); place(); setTimeout(()=>{ ed.focus(); ed.select(); },0);
  let done=false;
  const finish=(keep)=>{ if(done) return; done=true;
    if(keep) t.text=ed.value.trim(); ed.remove();
    if(!t.text){ ST.texts=ST.texts.filter(x=>x.id!==t.id); ST.selTexts=ST.selTexts.filter(id=>id!==t.id); }
    // a fresh label stays selected and lands in Select, so it can be dragged
    // straight away instead of the next tap making another one
    else if(isNew) editNewOverlay();
    snapshot(); render(); updateStatus(); };
  ed.addEventListener('keydown', ev=>{ ev.stopPropagation();
    if(ev.key==='Enter'){ ev.preventDefault(); finish(true); }
    else if(ev.key==='Escape'){ ev.preventDefault(); finish(!isNew); } });
  ed.addEventListener('blur', ()=>finish(true));
}

// ================= interaction =================
