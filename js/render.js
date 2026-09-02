import { CATALOG } from './catalog.js';
import { curInk } from './core.js';
import { GRID, ctx, cv, stage } from './dom.js';
import { drawPiece } from './drawers.js';
import { LAYER_OFF, drawLayer, fobArea, fobList, layerColor, layerOff, lowCounts, lowStyle, maskPiece, masksBelow, mixCol, pieceLayer, placeError, shortwallCells, swRank } from './floors.js';
import { screenToWorld, snapCenter } from './geometry.js';
import { ensureLayers, itemLayerId, zOrder } from './layers.js';
import { drawImageSel, drawStrokeSel, drawText, drawTextSel } from './overlays.js';
import { planColorOf, planFill, planLit } from './plan.js';
import { selectedPieces } from './selection.js';
import { stampInstance } from './stamps.js';
import { ST } from './state.js';

// ================= render =================
export function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
export function resize(){
  const dpr=window.devicePixelRatio||1, w=stage.clientWidth, h=stage.clientHeight;
  // Whatever was in the middle of the board stays in the middle of it. The
  // board changes size whenever a panel comes or goes - most sharply when a
  // phone clears the chrome to aim a piece - and leaving the origin alone would
  // slide the map out from under the very thing being aimed.
  const pw=cv._cssW, ph=cv._cssH;
  if(pw && ph && (pw!==w || ph!==h)){
    ST.view.ox += (w-pw)/2;
    ST.view.oy += (h-ph)/2;
  }
  cv._cssW=w; cv._cssH=h;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.width=w+'px'; cv.style.height=h+'px'; cv._dpr=dpr;
  if(!ST.oc){ ST.oc=document.createElement('canvas'); ST.octx=ST.oc.getContext('2d'); }
  ST.oc.width=cv.width; ST.oc.height=cv.height;
  render();
}
export function render(){
  const dpr=cv._dpr||1;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
  ctx.setTransform(dpr*ST.view.scale,0,0,dpr*ST.view.scale, dpr*ST.view.ox, dpr*ST.view.oy);
  const colInk=curInk(), colAcc=cssVar('--accent');
  if(ST.showGrid) drawGrid(cssVar('--grid'), cssVar('--grid-major'));
  drawFobAreas(colAcc);
  // draw each Photoshop layer bottom -> top; a layer under 100% opacity renders
  // to an offscreen buffer and composites at its opacity (true layer alpha, so
  // the floor/mask logic inside stays exactly as-is)
  const bg=cssVar('--canvas-bg');
  ensureLayers();
  const gMaxL=ST.curLayer;   // depth dimming is relative to the current build floor,
                          // so lower floors darken as you climb even before placing
  for(const L of zOrder()){                       // bottom -> top, grouped by floor order
    if(!L.visible) continue;
    const useOff = L.opacity < 0.999 && ST.oc;
    const g = useOff ? ST.octx : ctx;
    if(useOff){
      ST.octx.setTransform(1,0,0,1,0,0); ST.octx.clearRect(0,0,ST.oc.width,ST.oc.height);
      ST.octx.setTransform(dpr*ST.view.scale,0,0,dpr*ST.view.scale, dpr*ST.view.ox, dpr*ST.view.oy);
    }
    drawLayerContent(g, L, colInk, bg, gMaxL);
    if(useOff){
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha = Math.max(0,Math.min(1,L.opacity));
      ctx.drawImage(ST.oc, 0, 0); ctx.restore();
      ctx.setTransform(dpr*ST.view.scale,0,0,dpr*ST.view.scale, dpr*ST.view.ox, dpr*ST.view.oy);
    }
  }
  ctx.globalAlpha=1;
  const selPs=selectedPieces();
  const soloPiece = selPs.length===1 && !ST.selImages.length && !ST.selTexts.length && !ST.selStrokes.length;
  selPs.forEach(p=>{ const off=layerOff(pieceLayer(p));
    ctx.save(); ctx.translate(off.x,off.y); drawSelection(p, colAcc, soloPiece); ctx.restore(); });
  const soloImg = ST.selImages.length===1 && !ST.selected.length && !ST.selTexts.length && !ST.selStrokes.length;
  ST.selImages.forEach(id=>{ const im=ST.images.find(i=>i.id===id); if(im) drawImageSel(im,colAcc,soloImg); });
  ST.selTexts.forEach(id=>{ const t=ST.texts.find(x=>x.id===id); if(t) drawTextSel(t,colAcc); });
  const soloStroke = ST.selStrokes.length===1 && !ST.selected.length && !ST.selImages.length && !ST.selTexts.length;
  ST.selStrokes.forEach(s=>drawStrokeSel(s,colAcc,soloStroke));
  if(ST.marquee) drawMarquee(colAcc);
  const goff=layerOff(ST.curLayer), colBad=cssVar('--bad');
  if(ST.tool==='stamp' && ST.activeStamp){
    ctx.save(); ctx.translate(goff.x,goff.y);
    stampInstance(ST.activeStamp, ST.hover.x, ST.hover.y, ST.placeRot, ST.placeFlip).forEach(ip=>{
      const ok=!placeError(ip.type,ip.x,ip.y,ip.rot,ST.curLayer);
      drawPiece(ctx,ip, ok?colAcc:colBad, 0.5); });
    ctx.restore();
  } else if(CATALOG[ST.tool]){ const c=snapCenter(ST.tool,ST.placeRot,ST.hover.x,ST.hover.y);
    const ok=!placeError(ST.tool,c.x,c.y,ST.placeRot,ST.curLayer);
    if(ST.tool==='fob'){ ctx.save(); ctx.translate(goff.x,goff.y);   // preview the zone this FOB would claim
      const a=fobArea(c.x,c.y); ctx.globalAlpha=1; ctx.strokeStyle=ok?colAcc:colBad; ctx.lineWidth=1.5/ST.view.scale;
      ctx.setLineDash([10/ST.view.scale,7/ST.view.scale]); ctx.strokeRect(a.minx,a.miny,a.maxx-a.minx,a.maxy-a.miny); ctx.setLineDash([]); ctx.restore(); }
    ctx.save(); ctx.translate(goff.x,goff.y);
    drawPiece(ctx,{type:ST.tool,x:c.x,y:c.y,rot:ST.placeRot,flip:ST.placeFlip}, ok?colAcc:colBad, 0.5);
    ctx.restore();
  }
}
// draw one layer's items (images, drawings, floor-sorted pieces, labels) to g
export function drawLayerContent(g, L, colInk, bg, maxL){
  const lid=L.id;
  for(const im of ST.images){ if(itemLayerId(im)!==lid) continue;
    if(im._img && im._img.complete){ g.globalAlpha=1; g.drawImage(im._img, im.x-im.w/2, im.y-im.h/2, im.w, im.h); } }
  for(const s of ST.strokes){ if(itemLayerId(s)!==lid || !s.pts.length) continue;
    g.beginPath(); g.moveTo(s.pts[0].x,s.pts[0].y);
    for(let i=1;i<s.pts.length;i++) g.lineTo(s.pts[i].x,s.pts[i].y);
    if(s.pts.length===1) g.lineTo(s.pts[0].x+0.1,s.pts[0].y);
    g.strokeStyle=s.color; g.lineWidth=s.width; g.lineJoin='round'; g.lineCap='round'; g.globalAlpha=1; g.stroke(); }
  const lp=ST.pieces.filter(p=>itemLayerId(p)===lid);
  const lc=lowCounts(lp), swSet=shortwallCells(lp), lowDrawn=new Set();
  // Ghosted work goes down before the stage in view, the way the export sheets
  // already lay it down. Otherwise a piece from a later stage, drawn after its
  // neighbour, paints its own near-paper body over the shared edge and the wall
  // in focus reads as cut open where the two meet.
  const sorted=lp.map((p,i)=>({p,i}))
    .filter(o=>pieceLayer(o.p)<=ST.curLayer)
    .sort((a,b)=> (planLit(a.p)?1:0)-(planLit(b.p)?1:0)
      || (drawLayer(a.p)-drawLayer(b.p)) || (swRank(a.p)-swRank(b.p)) || (a.i-b.i))
    .map(o=>o.p);
  for(const p of sorted){ const l=pieceLayer(p), dl=drawLayer(p), off=layerOff(l);
    const st=lowStyle(p, layerColor(planColorOf(p,colInk,bg),bg,dl,maxL), bg, lc, swSet, lowDrawn);
    if(st.skip) continue;
    g.save(); g.translate(off.x,off.y);
    if(masksBelow(p)) maskPiece(g,p,bg);
    if(dl>l){ drawPiece(g,p, mixCol(st.col,bg,0.55), 1); g.translate(0,-LAYER_OFF); maskPiece(g,p,bg); }
    planFill(g,p,bg);
    drawPiece(g,p, st.col, 1); g.restore(); }
  for(const t of ST.texts){ if(itemLayerId(t)!==lid) continue; drawText(g,t,colInk); }
}
// each FOB's 40x40 build zone, drawn as a faint dashed boundary
export function drawFobAreas(col){
  const fs=fobList(); if(!fs.length) return;
  ctx.save(); ctx.globalAlpha=0.4; ctx.strokeStyle=col; ctx.lineWidth=1.5/ST.view.scale;
  ctx.setLineDash([10/ST.view.scale,7/ST.view.scale]);
  fs.forEach(f=>{ const off=layerOff(pieceLayer(f)), a=fobArea(f.x+off.x,f.y+off.y);
    ctx.strokeRect(a.minx,a.miny,a.maxx-a.minx,a.maxy-a.miny); });
  ctx.setLineDash([]); ctx.restore();
}
export function drawMarquee(col){
  const x=Math.min(ST.marquee.x0,ST.marquee.x1), y=Math.min(ST.marquee.y0,ST.marquee.y1);
  const w=Math.abs(ST.marquee.x1-ST.marquee.x0), h=Math.abs(ST.marquee.y1-ST.marquee.y0);
  ctx.save(); ctx.globalAlpha=1;
  ctx.fillStyle=col; ctx.globalAlpha=0.10; ctx.fillRect(x,y,w,h); ctx.globalAlpha=1;
  ctx.strokeStyle=col; ctx.lineWidth=1.2/ST.view.scale; ctx.setLineDash([5/ST.view.scale,4/ST.view.scale]);
  ctx.strokeRect(x,y,w,h); ctx.setLineDash([]); ctx.restore();
}
export function drawGrid(col,colM){
  const w=cv.width/(cv._dpr||1), h=cv.height/(cv._dpr||1);
  const tl=screenToWorld(0,0), br=screenToWorld(w,h);
  const x0=Math.floor(tl.x/GRID)*GRID, x1=Math.ceil(br.x/GRID)*GRID;
  const y0=Math.floor(tl.y/GRID)*GRID, y1=Math.ceil(br.y/GRID)*GRID;
  ctx.globalAlpha=1;
  ctx.strokeStyle=col; ctx.lineWidth=1/ST.view.scale; ctx.beginPath();
  for(let x=x0;x<=x1;x+=GRID){ if(Math.round(x/GRID)%4===0)continue; ctx.moveTo(x,y0); ctx.lineTo(x,y1); }
  for(let y=y0;y<=y1;y+=GRID){ if(Math.round(y/GRID)%4===0)continue; ctx.moveTo(x0,y); ctx.lineTo(x1,y); }
  ctx.stroke();
  ctx.strokeStyle=colM; ctx.lineWidth=1.4/ST.view.scale; ctx.beginPath();
  for(let x=x0;x<=x1;x+=GRID){ if(Math.round(x/GRID)%4!==0)continue; ctx.moveTo(x,y0); ctx.lineTo(x,y1); }
  for(let y=y0;y<=y1;y+=GRID){ if(Math.round(y/GRID)%4!==0)continue; ctx.moveTo(x0,y); ctx.lineTo(x1,y); }
  ctx.stroke();
  ctx.strokeStyle=colM; ctx.lineWidth=2/ST.view.scale; ctx.beginPath();
  ctx.moveTo(-GRID*0.3,0); ctx.lineTo(GRID*0.3,0); ctx.moveTo(0,-GRID*0.3); ctx.lineTo(0,GRID*0.3); ctx.stroke();
}
export function drawSelection(p,col,showHandle){
  const c=CATALOG[p.type], W=c.w*GRID, H=c.h*GRID;
  ctx.save(); ctx.translate(p.x,p.y); if(p.flip) ctx.scale(-1,1); ctx.rotate(p.rot*Math.PI/180);
  ctx.globalAlpha=1; ctx.strokeStyle=col; ctx.lineWidth=1.4/ST.view.scale;
  ctx.setLineDash([6/ST.view.scale,4/ST.view.scale]);
  const pad=5/ST.view.scale;
  ctx.strokeRect(-W/2-pad,-H/2-pad,W+2*pad,H+2*pad);
  ctx.setLineDash([]);
  if(showHandle){
    const dist=H/2+24/ST.view.scale, r=6/ST.view.scale;
    ctx.beginPath(); ctx.moveTo(0,-H/2-pad); ctx.lineTo(0,-dist); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-dist,r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
  }
  ctx.restore();
}
// axis-aligned bounding box of a piece (accounts for 90/270 footprint swap)
export function pieceAABB(p){
  const c=CATALOG[p.type]; let w=c.w*GRID, h=c.h*GRID;
  const r=((Math.round(p.rot)%360)+360)%360;
  if(r===90||r===270){ const t=w; w=h; h=t; }
  return {minx:p.x-w/2, miny:p.y-h/2, maxx:p.x+w/2, maxy:p.y+h/2};
}
