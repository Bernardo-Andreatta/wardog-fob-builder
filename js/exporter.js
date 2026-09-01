import { CATALOG } from './catalog.js';
import { curInk } from './core.js';
import { $, GRID, ctx } from './dom.js';
import { DRAWERS, drawPiece, roundRect } from './drawers.js';
import { LAYER_OFF, drawLayer, layerColor, layerOff, lowCounts, lowStyle, maskPiece, masksBelow, maxLayer, mixCol, pieceLayer, shortwallCells, swRank } from './floors.js';
import { drawText, textBox } from './overlays.js';
import { HATCH_ANGLES, builderOf, drawPlanFill, ensurePlan, planVisible, stageIndex, stageOf, tagInk } from './plan.js';
import { cssVar } from './render.js';
import { ST } from './state.js';
import { flashToast, saveFile } from './topbar.js';

// ---------------- image export (schematics the builders actually work from) --
// Every view is rendered into the whole build's frame - snapped out to whole
// grid blocks - so the PNGs stack and flip cleanly. On top of the map each one
// carries the context a builder needs on site: what they are looking at, how
// big it is in blocks, and a legend for the stages / builders in front of them.
// Which sheets to make is a per-sheet choice now (see sheetOn); these are the
// options that change how every sheet is drawn.
export const EXP_FIELDS=[['stagesCum','exp-stages-cum'],['fillBuilder','exp-fill-builder'],
  ['ghost','exp-ghost'],['grid','exp-grid'],['notes','exp-notes'],
  ['header','exp-header'],['ruler','exp-ruler'],['legend','exp-legend'],['zip','exp-zip']];
export function loadExpCfg(){
  try{ const o=JSON.parse(localStorage.getItem('wardog-fob-export')||'null');
    if(o&&typeof o==='object'){
      if(o.ppb==null && o.scale) o.ppb=Math.round(GRID*o.scale);   // pre-ppb settings
      delete o.scale; delete o.title;
      Object.assign(ST.expCfg,o);
    } }catch(e){}
}
export function saveExpCfg(){ try{ localStorage.setItem('wardog-fob-export', JSON.stringify(ST.expCfg)); }catch(e){} }
export function expToForm(){
  EXP_FIELDS.forEach(([k,id])=>{ const el=$(id); if(el) el.checked=!!ST.expCfg[k]; });
  $('exp-name').value=ST.expCfg.name||'';
  $('exp-ppb').value=String(ST.expCfg.ppb);
  updateExpCount();
}
export function expFromForm(){
  EXP_FIELDS.forEach(([k,id])=>{ const el=$(id); if(el) ST.expCfg[k]=el.checked; });
  ST.expCfg.name=$('exp-name').value.slice(0,48);
  ST.expCfg.ppb=parseInt($('exp-ppb').value,10)||80;
  saveExpCfg(); updateExpCount();
}
export function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||''; }
export function jobFile(kind, i, name){ const sl=slug(name), pre=kind+'-'+(i+1);
  return (sl===pre||sl===kind||!sl) ? pre : pre+'-'+sl; }
export function buildName(){ return slug(ST.expCfg.name) || 'fob-build'; }
// one job = one PNG: caption, filename, which pieces are in focus, and the two
// colour channels it paints them with (outline / fill)
// a tag nothing was built under would only ever render an empty sheet, so it is
// dropped from the batch (and takes its "all stages / all builders" sheet with it)
export function usedPlan(kind){
  const shown=ST.pieces.filter(planVisible), key = kind==='stage'?'st':'bd';
  return (kind==='stage'?ST.stages:ST.builders).filter(e=>shown.some(p=>p[key]===e.id));
}
// Every sheet this build could produce. The dialog lists these one by one, so
// what you tick is a page you can see rather than a category that quietly
// expands into five of them.
export function exportCandidates(){
  const jobs=[], all=()=>true;
  const uS=usedPlan('stage'), uB=usedPlan('builder');
  // outline channel = builder, fill channel = stage; on a stage sheet the builder
  // outline is the optional second read
  const so = ST.expCfg.fillBuilder && uB.length ? 'builder' : null;
  jobs.push({file:'whole-build', group:'whole', title:'Whole build', inc:all, col:null});
  if(uS.length) jobs.push({file:'all-stages', group:'stagesAll', title:'All stages', inc:all, col:so, fill:'stage'});
  uS.forEach(s=>{
    const i=ST.stages.indexOf(s), cum=ST.expCfg.stagesCum;
    // Only ever one stage is drawn solid: the one the sheet is for. A cumulative
    // sheet is a build-up, so everything already standing from the earlier
    // stages sits behind it as a ghost - which is what makes the new work on
    // this sheet readable at a glance. (Drawing them solid too, as it used to,
    // made stage 1 and stage 2 indistinguishable on the stage 2 sheet.)
    jobs.push({file:jobFile('stage',i,s.name), group:'stage',
      title:(cum?'Stages 1-'+(i+1)+': ':'Stage '+(i+1)+': ')+s.name,
      inc:p=>p.st===s.id,
      rest: cum ? (p=>{ const k=stageIndex(p); return k>=0 && k<i; }) : null,
      note:(s.note||'').trim(),
      col:so, fill:'stage', badge:{label:'Stage '+(i+1)+' · '+s.name, color:s.color, hatch:i}});
  });
  if(uB.length) jobs.push({file:'all-builders', group:'buildersAll', title:'All builders', inc:all, col:'builder'});
  uB.forEach(b=>
    jobs.push({file:jobFile('builder',ST.builders.indexOf(b),b.name), group:'builder', title:b.name,
      inc:p=>p.bd===b.id, col:'builder', badge:{label:b.name, color:b.color}}));
  // One page per hand-off: "Stage 1 - Builder 2" is what a single builder is
  // asked to put down in a single stage, so only pairs with work get a sheet.
  {
    const seen=ST.pieces.filter(planVisible);
    uS.forEach(s=>{ const i=ST.stages.indexOf(s);
      ST.builders.forEach(b=>{ const j=ST.builders.indexOf(b);
        if(!seen.some(p=>p.st===s.id && p.bd===b.id)) return;
        jobs.push({file:'stage-'+(i+1)+'-builder-'+(j+1), group:'pair',
          title:s.name+' · '+b.name,
          inc:p=>p.st===s.id && p.bd===b.id,
          note:(s.note||'').trim(), col:'builder', fill:'stage',
          badge:{label:b.name, color:b.color}});
      });
    });
  }
  if(keyEntries().length)
    jobs.push({file:'structure-key', group:'key', title:'Structure key', kind:'key', inc:all});
  return jobs;
}
// A sheet the user has never touched follows its group's default, so adding a
// stage adds its sheet without anyone going back to tick it.
const GROUP_ON={whole:true, stagesAll:true, stage:true, buildersAll:true, builder:true, pair:false, key:false};
export function sheetOn(j){
  const pick=ST.expCfg.sheets||{};
  return (j.file in pick) ? !!pick[j.file] : !!GROUP_ON[j.group];
}
export function setSheetOn(file, on){
  if(!ST.expCfg.sheets) ST.expCfg.sheets={};
  ST.expCfg.sheets[file]=!!on; saveExpCfg();
}
export function exportJobs(){ return exportCandidates().filter(sheetOn); }
// bounds of everything on the board, snapped out to whole blocks (so the ruler
// ticks land on grid lines) plus a one-block margin
export function contentBounds(){
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  ST.pieces.forEach(p=>{ const k=CATALOG[p.type]; if(!k) return;
    const rad=Math.abs(p.rot%180)===90, off=layerOff(pieceLayer(p));
    const hw=(rad?k.h:k.w)*GRID/2, hh=(rad?k.w:k.h)*GRID/2;
    a=Math.min(a,p.x-hw); c=Math.max(c,p.x+hw);
    b=Math.min(b,p.y-hh+off.y); d=Math.max(d,p.y+hh+off.y); });
  ST.strokes.forEach(s=>s.pts.forEach(pt=>{ a=Math.min(a,pt.x); c=Math.max(c,pt.x); b=Math.min(b,pt.y); d=Math.max(d,pt.y); }));
  ST.images.forEach(im=>{ a=Math.min(a,im.x-im.w/2); c=Math.max(c,im.x+im.w/2); b=Math.min(b,im.y-im.h/2); d=Math.max(d,im.y+im.h/2); });
  ST.texts.forEach(t=>{ const bx=textBox(t), r=t.rot?Math.hypot(bx.w,bx.h)/2:0, hw=r||bx.w/2, hh=r||bx.h/2;
    a=Math.min(a,t.x-hw); c=Math.max(c,t.x+hw); b=Math.min(b,t.y-hh); d=Math.max(d,t.y+hh); });
  if(a===Infinity) return null;
  const bx=Math.floor(a/GRID)*GRID, by=Math.floor(b/GRID)*GRID;
  const ex=Math.ceil(c/GRID)*GRID,  ey=Math.ceil(d/GRID)*GRID;
  return {minX:bx-GRID, minY:by-GRID, maxX:ex+GRID, maxY:ey+GRID,
          bx:bx, by:by, bw:Math.round((ex-bx)/GRID), bh:Math.round((ey-by)/GRID)};
}
// ---- schematic furniture: header, block ruler, legend -----------------------
export const EXP_PAD=GRID*0.5, EXP_HEAD=GRID*1.3, EXP_RULE=GRID*0.8, EXP_ROW=GRID*0.62;
export const EXP_SW=GRID*0.4;                     // legend swatch
export const F_TITLE=()=>'600 '+Math.round(GRID*0.5)+'px Oswald, sans-serif';
export const F_SUB  =()=>Math.round(GRID*0.3)+'px "IBM Plex Mono", monospace';
export const F_CHIP =()=>Math.round(GRID*0.32)+'px "IBM Plex Sans", sans-serif';
export const F_TICK =()=>Math.round(GRID*0.28)+'px "IBM Plex Mono", monospace';
export function measCtx(){ if(!ST._meas) ST._meas=document.createElement('canvas').getContext('2d'); return ST._meas; }
// what this image actually shows, as legend entries - only for channels it paints
export function legendChips(job, focus){
  const chips=[], count=f=>focus.reduce((n,p)=>n+(f(p)?1:0),0);
  const subject = job.fill || job.col;          // the tag this sheet is actually about
  const add=(kind, hatched)=>{
    const arr = kind==='stage'?ST.stages:ST.builders, key = kind==='stage'?'st':'bd';
    let any=false;
    arr.forEach((e,i)=>{ const n=count(p=>p[key]===e.id);
      if(n){ any=true; chips.push({label:e.name, color:e.color, n:n, hatch:hatched?i:null}); } });
    if(kind===subject && any){ const u=count(p=>p[key]==null);
      if(u) chips.push({label:'General', color:null, n:u}); }
  };
  if(job.col) add(job.col, false);              // outline swatch
  if(job.fill) add(job.fill, true);             // hatched swatch
  return chips;
}
// ---- structure key: its own sheet, drawn at the map's scale ----------------
// A swatch-sized icon tells a builder nothing about how much ground a structure
// eats. Here every structure is drawn at true scale, at the same px-per-block as
// the map, so a bunker really is four times a wall - and because it is a sheet
// of its own, it is the one page you hand to the crew.
const KEY_GAP=GRID*0.55, KEY_TEXT=GRID*3.6, KEY_MAXH=GRID*22;
// A couple of drawings reach past their own footprint - the door and gate swing
// arcs - so their row reserves the height the art really covers. The piece is
// still drawn at true scale; only the spacing around it grows.
const KEY_ART_H={gate:2.5, door:1.4};
export function keyEntries(){
  const shown=ST.pieces.filter(planVisible), seen=new Map();
  shown.forEach(p=>{ if(CATALOG[p.type]) seen.set(p.type, (seen.get(p.type)||0)+1); });
  return Object.keys(CATALOG).filter(t=>seen.has(t))
    .map(t=>({type:t, n:seen.get(t), c:CATALOG[t]}));
}
// entries flow down a column and start a new one once the column is tall enough,
// so one big structure does not stretch the sheet into a ribbon
export function keyLayout(){
  const entries=keyEntries();
  const cols=[[]]; let h=0;
  entries.forEach(e=>{
    e.rh=Math.max((KEY_ART_H[e.type]||e.c.h)*GRID, EXP_ROW*1.6)+KEY_GAP;
    if(h+e.rh>KEY_MAXH && cols[cols.length-1].length){ cols.push([]); h=0; }
    cols[cols.length-1].push(e); h+=e.rh;
  });
  const cw=cols.map(col=>Math.max(0,...col.map(e=>e.c.w*GRID))+KEY_TEXT+KEY_GAP*2);
  const ch=cols.map(col=>col.reduce((a,e)=>a+e.rh,0));
  const head=ST.expCfg.header?EXP_HEAD:0;
  return {cols, cw, ch, entries, head,
    w: EXP_PAD*2 + Math.max(GRID*4, cw.reduce((a,b)=>a+b,0)),
    h: EXP_PAD*2 + head + Math.max(GRID*2, ...ch)};
}
export function renderKeySheet(job){
  const K=keyLayout(), sc=expScaleFor(K.w,K.h);
  const cx=document.createElement('canvas');
  cx.width=Math.round(K.w*sc); cx.height=Math.round(K.h*sc);
  const g=cx.getContext('2d'); g.scale(sc,sc);
  const bg=cssVar('--canvas-bg'), ink=curInk();
  g.fillStyle=bg; g.fillRect(0,0,K.w,K.h);
  g.textBaseline='alphabetic';
  if(K.head){
    const nm=(ST.expCfg.name||'').trim();
    if(nm){ g.fillStyle=mixCol(ink,bg,0.42); g.font=F_SUB();
      g.fillText(nm.toUpperCase(), EXP_PAD, EXP_PAD+EXP_HEAD*0.32); }
    g.fillStyle=ink; g.font=F_TITLE();
    g.fillText(job.title, EXP_PAD, EXP_PAD+EXP_HEAD*(nm?0.86:0.62));
    g.font=F_SUB(); g.fillStyle=mixCol(ink,bg,0.4);
    const sub='drawn to scale';
    g.fillText(sub, K.w-EXP_PAD-g.measureText(sub).width, EXP_PAD+EXP_HEAD*0.86);
  }
  let x=EXP_PAD;
  K.cols.forEach((col,ci)=>{
    let y=EXP_PAD+K.head;
    const pw=Math.max(0,...col.map(e=>e.c.w*GRID));
    col.forEach(e=>{
      const mid=y+(e.rh-KEY_GAP)/2;
      // the structure at the size it really takes up on the map
      drawPiece(g, {type:e.type, x:x+KEY_GAP+pw/2, y:mid, rot:0, flip:false}, ink, 1);
      const tx=x+KEY_GAP*2+pw;
      g.fillStyle=ink; g.font=F_CHIP();
      g.fillText(e.c.name, tx, mid);
      g.fillStyle=mixCol(ink,bg,0.45); g.font=F_TICK();
      g.fillText(e.c.w+' x '+e.c.h+' blocks', tx, mid+GRID*0.34);
      const cnt='x '+e.n;
      g.fillStyle=mixCol(ink,bg,0.25); g.font=F_CHIP();
      g.fillText(cnt, x+K.cw[ci]-KEY_GAP-g.measureText(cnt).width, mid);
      y+=e.rh;
    });
    x+=K.cw[ci];
  });
  return cx;
}
export function packChips(chips, maxW){
  const ctx=measCtx(); ctx.font=F_CHIP();
  const rows=[[]]; let w=0;
  chips.forEach(c=>{
    c.w = EXP_SW + GRID*0.18 + ctx.measureText(c.label+'  '+c.n).width + GRID*0.42;
    if(w+c.w > maxW && rows[rows.length-1].length){ rows.push([]); w=0; }
    rows[rows.length-1].push(c); w+=c.w;
  });
  return rows[0].length ? rows : [];
}
export function drawSwatch(g, x, y, sz, col, hatch, ink, bg){
  if(col!=null) col=tagInk(col, bg);      // the same lift the pieces get
  g.save();
  if(col==null){ g.strokeStyle=mixCol(ink,bg,0.45); g.lineWidth=1.4; g.strokeRect(x,y,sz,sz); g.restore(); return; }
  if(hatch==null){ g.strokeStyle=col; g.lineWidth=2.2; g.strokeRect(x+1,y+1,sz-2,sz-2); }
  else {
    g.beginPath(); g.rect(x,y,sz,sz); g.clip();
    g.globalAlpha=0.18; g.fillStyle=col; g.fillRect(x,y,sz,sz);
    g.globalAlpha=0.85; g.strokeStyle=col; g.lineWidth=1.6;
    const n=HATCH_ANGLES.length, ang=HATCH_ANGLES[((hatch%n)+n)%n];
    g.translate(x+sz/2, y+sz/2); g.rotate(ang);
    g.beginPath(); for(let d=-sz; d<=sz; d+=sz/3.2){ g.moveTo(-sz,d); g.lineTo(sz,d); } g.stroke();
  }
  g.restore();
}
// dimension rulers along the top and left edges, ticked every block and
// numbered every 4 (matching the major grid) so a size can be read off directly
export function drawRuler(g, B, ink, bg){
  const x0=B.bx, y0=B.by, x1=B.bx+B.bw*GRID, y1=B.by+B.bh*GRID;
  const line=mixCol(ink,bg,0.35), tickCol=mixCol(ink,bg,0.55);
  const ty=y0-EXP_RULE*0.42, tx=x0-EXP_RULE*0.42;
  g.save();
  g.strokeStyle=line; g.lineWidth=1.4; g.lineCap='butt';
  g.beginPath(); g.moveTo(x0,ty); g.lineTo(x1,ty);            // top rail
  g.moveTo(x0,ty-EXP_RULE*0.16); g.lineTo(x0,ty+EXP_RULE*0.16);
  g.moveTo(x1,ty-EXP_RULE*0.16); g.lineTo(x1,ty+EXP_RULE*0.16);
  g.moveTo(tx,y0); g.lineTo(tx,y1);                            // left rail
  g.moveTo(tx-EXP_RULE*0.16,y0); g.lineTo(tx+EXP_RULE*0.16,y0);
  g.moveTo(tx-EXP_RULE*0.16,y1); g.lineTo(tx+EXP_RULE*0.16,y1);
  g.stroke();
  g.strokeStyle=tickCol; g.lineWidth=1;
  g.beginPath();
  for(let i=1;i<B.bw;i++){ const x=x0+i*GRID, t=(i%4===0)?EXP_RULE*0.13:EXP_RULE*0.07;
    g.moveTo(x,ty-t); g.lineTo(x,ty+t); }
  for(let i=1;i<B.bh;i++){ const y=y0+i*GRID, t=(i%4===0)?EXP_RULE*0.13:EXP_RULE*0.07;
    g.moveTo(tx-t,y); g.lineTo(tx+t,y); }
  g.stroke();
  g.fillStyle=tickCol; g.font=F_TICK(); g.textBaseline='alphabetic';
  measCtx().font=F_TICK();
  for(let i=0;i<=B.bw;i+=4){ const x=x0+i*GRID, s=String(i);
    g.fillText(s, x-measCtx().measureText(s).width/2, ty-EXP_RULE*0.26); }
  for(let i=0;i<=B.bh;i+=4){ const y=y0+i*GRID, s=String(i);
    g.save(); g.translate(tx-EXP_RULE*0.26, y); g.rotate(-Math.PI/2);
    g.fillText(s, -measCtx().measureText(s).width/2, 0); g.restore(); }
  g.restore();
}
// ---- one rendered view ------------------------------------------------------
export const EXP_MAX_DIM=16384, EXP_MAX_PX=90e6;   // stay well inside browser canvas limits
// px-per-block is honoured whatever the build's size, so a big base still zooms;
// only a canvas the browser would refuse gets scaled back
export function expScaleFor(w,h){
  const want=ST.expCfg.ppb/GRID;
  return Math.max(0.25, Math.min(want, EXP_MAX_DIM/w, EXP_MAX_DIM/h, Math.sqrt(EXP_MAX_PX/(w*h))));
}
export function expSheet(job, B){
  if(job.kind==='key'){ const K=keyLayout();
    return {key:K, focus:[], rest:[], rows:[], head:K.head, rule:0, legH:0,
            w:K.w, h:K.h, ox:0, oy:0}; }
  const shown=ST.pieces.filter(planVisible);
  const focus=shown.filter(job.inc);
  const chips=ST.expCfg.legend ? legendChips(job, focus) : [];
  // a stage note adds a line under the title, so the header grows to hold it
  const head=ST.expCfg.header ? (job.note?EXP_HEAD*1.42:EXP_HEAD) : 0;
  const rule=ST.expCfg.ruler?EXP_RULE:0;
  const mapW=B.maxX-B.minX, mapH=B.maxY-B.minY;
  const rows=chips.length ? packChips(chips, mapW) : [];
  const nrows=Math.max(rows.length, ST.expLegRows);
  const legH=nrows ? EXP_ROW*nrows + GRID*0.24 : 0;
  const w=EXP_PAD*2+rule+mapW, h=EXP_PAD*2+head+rule+mapH+legH;
  // a job may name its own ghost set (the cumulative build-up); otherwise the
  // "Ghost the pieces left out" switch decides whether the rest shows at all
  const rest = job.rest ? shown.filter(job.rest)
                        : (ST.expCfg.ghost ? shown.filter(p=>!job.inc(p)) : []);
  return {focus:focus, rest:rest,
          rows:rows, head:head, rule:rule, legH:legH, w:w, h:h,
          ox:EXP_PAD+rule-B.minX, oy:EXP_PAD+head+rule-B.minY};
}
export function renderExport(job, B){
  if(job.kind==='key') return renderKeySheet(job);
  const S=expSheet(job,B), sc=expScaleFor(S.w,S.h);
  const cx=document.createElement('canvas');
  cx.width=Math.round(S.w*sc); cx.height=Math.round(S.h*sc);
  const g=cx.getContext('2d'); g.scale(sc,sc); g.translate(S.ox,S.oy);
  const bg=cssVar('--canvas-bg'), ink=curInk();
  const L=-S.ox, T=-S.oy;                                // sheet corner, in world space
  g.fillStyle=bg; g.fillRect(L,T,S.w,S.h);
  if(ST.expCfg.grid){
    g.lineWidth=1;
    g.strokeStyle=cssVar('--grid'); g.beginPath();
    for(let x=Math.ceil(B.minX/GRID)*GRID;x<B.maxX;x+=GRID){ g.moveTo(x,B.minY); g.lineTo(x,B.maxY); }
    for(let y=Math.ceil(B.minY/GRID)*GRID;y<B.maxY;y+=GRID){ g.moveTo(B.minX,y); g.lineTo(B.maxX,y); }
    g.stroke();
    g.strokeStyle=cssVar('--grid-major'); g.beginPath();   // 4x4 blocks, as on the board
    for(let x=B.bx;x<=B.bx+B.bw*GRID;x+=GRID*4){ g.moveTo(x,B.minY); g.lineTo(x,B.maxY); }
    for(let y=B.by;y<=B.by+B.bh*GRID;y+=GRID*4){ g.moveTo(B.minX,y); g.lineTo(B.maxX,y); }
    g.stroke();
  }
  if(ST.expCfg.notes){
    ST.images.forEach(im=>{ if(im._img&&im._img.complete) g.drawImage(im._img, im.x-im.w/2, im.y-im.h/2, im.w, im.h); });
    ST.strokes.forEach(s=>{ if(!s.pts.length) return;
      g.beginPath(); g.moveTo(s.pts[0].x,s.pts[0].y); s.pts.forEach(pt=>g.lineTo(pt.x,pt.y));
      g.strokeStyle=s.color; g.lineWidth=s.width; g.lineJoin='round'; g.lineCap='round'; g.stroke(); });
  }
  const mxl=maxLayer();
  // out-of-focus pieces go down first as a faint ghost, the focused set on top
  const paint=(arr, ghost)=>{
    const lc=lowCounts(arr), swSet=shortwallCells(arr), drawn=new Set();
    arr.map((p,i)=>({p:p,i:i}))
      .sort((x,y)=> (drawLayer(x.p)-drawLayer(y.p)) || (swRank(x.p)-swRank(y.p)) || (x.i-y.i))
      .map(o=>o.p).forEach(p=>{
        const l=pieceLayer(p), dl=drawLayer(p), off=layerOff(l);
        let base=ink;
        if(job.col==='stage'){ const s=stageOf(p); base = s?tagInk(s.color,bg):mixCol(ink,bg,0.5); }
        else if(job.col==='builder'){ const b=builderOf(p); base = b?tagInk(b.color,bg):mixCol(ink,bg,0.5); }
        if(ghost) base=mixCol(base,bg,0.8);
        const st=lowStyle(p, layerColor(base,bg,dl,mxl), bg, lc, swSet, drawn);
        if(st.skip) return;
        g.save(); g.translate(off.x,off.y);
        if(!ghost && masksBelow(p)) maskPiece(g,p,bg);
        if(dl>l){ drawPiece(g,p, mixCol(st.col,bg,0.55), 1); g.translate(0,-LAYER_OFF); if(!ghost) maskPiece(g,p,bg); }
        if(!ghost && job.fill){ const arr = job.fill==='stage'?ST.stages:ST.builders;
          const e = job.fill==='stage'?stageOf(p):builderOf(p);
          if(e) drawPlanFill(g,p,tagInk(e.color,bg),arr.indexOf(e)); }
        drawPiece(g,p, st.col, 1); g.restore();
      });
  };
  paint(S.rest, true); paint(S.focus, false);
  if(ST.expCfg.notes) ST.texts.forEach(t=>drawText(g,t,ink));
  if(ST.expCfg.ruler) drawRuler(g, B, ink, bg);
  if(ST.expCfg.header) drawExpHeader(g, job, B, S, L, T, ink, bg);
  if(S.rows.length) drawExpLegend(g, S, B, ink, bg);
  return cx;
}
export function drawExpHeader(g, job, B, S, L, T, ink, bg){
  const x=L+EXP_PAD, y=T+EXP_PAD, right=L+S.w-EXP_PAD, m=measCtx();
  g.save(); g.textBaseline='alphabetic';
  const nm=(ST.expCfg.name||'').trim();
  if(nm){ g.fillStyle=mixCol(ink,bg,0.42); g.font=F_SUB();
    g.fillText(nm.toUpperCase(), x, y+EXP_HEAD*0.32); }
  g.fillStyle=ink; g.font=F_TITLE();
  g.fillText(job.title, x, y+EXP_HEAD*(nm?0.86:0.62));
  // what this stage is for, in the crew's own words
  if(job.note){ g.fillStyle=mixCol(ink,bg,0.42); g.font=F_SUB();
    g.fillText(job.note, x, y+EXP_HEAD*1.2); }
  // right-hand corner: the stage / builder this sheet is for, else the tally
  const size=B.bw+' x '+B.bh+' blocks', tally=S.focus.length+(S.focus.length===1?' piece':' pieces');
  g.font=F_SUB(); m.font=F_SUB();
  g.fillStyle=mixCol(ink,bg,0.4);
  g.fillText(size, right-m.measureText(size).width, y+EXP_HEAD*(job.badge?0.86:0.32));
  if(job.badge){
    const lab=job.badge.label; m.font=F_CHIP();
    const tw=m.measureText(lab).width, bw=EXP_SW+GRID*0.18+tw+GRID*0.34, bh=EXP_SW+GRID*0.22;
    const bx=right-bw, by=y+EXP_HEAD*0.06;
    g.globalAlpha=0.16; g.fillStyle=job.badge.color; roundRect(g,bx,by,bw,bh,GRID*0.12); g.fill();
    g.globalAlpha=1; g.strokeStyle=job.badge.color; g.lineWidth=1.4; roundRect(g,bx,by,bw,bh,GRID*0.12); g.stroke();
    drawSwatch(g, bx+GRID*0.17, by+(bh-EXP_SW)/2, EXP_SW, job.badge.color, job.badge.hatch, ink, bg);
    g.fillStyle=ink; g.font=F_CHIP();
    g.fillText(lab, bx+GRID*0.17+EXP_SW+GRID*0.18, by+bh*0.5+GRID*0.11);
  } else {
    g.fillStyle=mixCol(ink,bg,0.4); g.font=F_SUB();
    g.fillText(tally, right-m.measureText(tally).width, y+EXP_HEAD*0.86);
  }
  g.restore();
}
export function drawExpLegend(g, S, B, ink, bg){
  let y=B.maxY+GRID*0.28;
  g.save(); g.textBaseline='alphabetic';
  S.rows.forEach(row=>{
    let x=B.minX;
    row.forEach(c=>{
      drawSwatch(g, x, y+(EXP_ROW-EXP_SW)/2-GRID*0.06, EXP_SW, c.color, c.hatch, ink, bg);
      g.fillStyle=ink; g.font=F_CHIP();
      const tx=x+EXP_SW+GRID*0.18;
      g.fillText(c.label, tx, y+EXP_ROW*0.5+GRID*0.05);
      g.fillStyle=mixCol(ink,bg,0.45);
      // measure with g, which is already on F_CHIP - the shared measuring canvas
      // still carries whatever font the ruler or the header left on it, and that
      // put the count on top of the next chip's icon
      g.fillText('  '+c.n, tx+g.measureText(c.label).width, y+EXP_ROW*0.5+GRID*0.05);
      x+=c.w;
    });
    y+=EXP_ROW;
  });
  g.restore();
}
// ---- packaging: a set of sheets is one .zip folder, not a download stampede --
export const CRC_TABLE=(()=>{ const t=new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320^(c>>>1)) : (c>>>1); t[n]=c>>>0; }
  return t; })();
export function crc32(buf){ let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0; }
// minimal store-only ZIP: PNGs are already compressed, so there is nothing to gain
export function zipStore(files){
  const enc=new TextEncoder(), parts=[], dir=[]; let off=0;
  files.forEach(f=>{
    const nm=enc.encode(f.name), crc=crc32(f.data), sz=f.data.length;
    const lh=new Uint8Array(30+nm.length), dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0,true);
    dv.setUint16(8,0,true); dv.setUint16(10,0,true); dv.setUint16(12,0x21,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,sz,true); dv.setUint32(22,sz,true);
    dv.setUint16(26,nm.length,true); dv.setUint16(28,0,true);
    lh.set(nm,30);
    parts.push(lh, f.data); dir.push({nm:nm, crc:crc, sz:sz, off:off});
    off += lh.length + sz;
  });
  let dirSize=0;
  dir.forEach(e=>{
    const ch=new Uint8Array(46+e.nm.length), dv=new DataView(ch.buffer);
    dv.setUint32(0,0x02014b50,true); dv.setUint16(4,20,true); dv.setUint16(6,20,true);
    dv.setUint16(8,0,true); dv.setUint16(10,0,true); dv.setUint16(12,0,true); dv.setUint16(14,0x21,true);
    dv.setUint32(16,e.crc,true); dv.setUint32(20,e.sz,true); dv.setUint32(24,e.sz,true);
    dv.setUint16(28,e.nm.length,true); dv.setUint32(42,e.off,true);
    ch.set(e.nm,46);
    parts.push(ch); dirSize+=ch.length;
  });
  const end=new Uint8Array(22), dv=new DataView(end.buffer);
  dv.setUint32(0,0x06054b50,true);
  dv.setUint16(8,dir.length,true); dv.setUint16(10,dir.length,true);
  dv.setUint32(12,dirSize,true); dv.setUint32(16,off,true);
  parts.push(end);
  return new Blob(parts, {type:'application/zip'});
}
// a plain-text brief so the numbers survive outside the images
export function buildManifest(jobs, B, files){
  const L=[], tally=(arr,f)=>arr.map(e=>{ const n=ST.pieces.filter(p=>f(p)===e.id).length;
    const note=(e.note||'').trim();
    return '  '+e.name+' - '+n+(n===1?' piece':' pieces')+(note?'\n      '+note:''); }).join('\n');
  L.push((ST.expCfg.name||'FOB build').trim());
  L.push('='.repeat(Math.max(8,(ST.expCfg.name||'FOB build').trim().length)));
  L.push('');
  L.push('Footprint : '+B.bw+' x '+B.bh+' blocks');
  L.push('Pieces    : '+ST.pieces.length);
  L.push('Rendered  : '+ST.expCfg.ppb+' px per block');
  L.push('');
  L.push('STAGES'); L.push(tally(ST.stages, p=>p.st)||'  (none)');
  const us=ST.pieces.filter(p=>p.st==null).length; if(us) L.push('  General - '+us+(us===1?' piece':' pieces'));
  L.push('');
  L.push('BUILDERS'); L.push(tally(ST.builders, p=>p.bd)||'  (none)');
  const ub=ST.pieces.filter(p=>p.bd==null).length; if(ub) L.push('  General - '+ub+(ub===1?' piece':' pieces'));
  L.push('');
  L.push('SHEETS');
  files.forEach(f=>L.push('  '+f));
  L.push('');
  return L.join('\n');
}
export async function runExport(){
  const B=contentBounds();
  if(!B){ alert('Nothing to export yet.'); return; }
  const jobs=exportJobs();
  if(!jobs.length){ flashToast('Nothing to export - tick a sheet, or tag some pieces'); return; }
  const btn=$('exp-run'), lab=btn.querySelector('span');
  btn.disabled=true;
  const name=buildName();
  ST.expLegRows=jobs.reduce((m,j)=>Math.max(m, expSheet(j,B).rows.length), 0);
  try{
    const blobs=[];
    for(let i=0;i<jobs.length;i++){
      if(lab) lab.textContent='Rendering '+(i+1)+'/'+jobs.length;
      await new Promise(r=>requestAnimationFrame(r));      // let the label paint
      const cv2=renderExport(jobs[i], B);
      const blob=await new Promise(res=>cv2.toBlob(res,'image/png'));
      if(blob) blobs.push({job:jobs[i], blob:blob, n:i+1});
    }
    if(!blobs.length){ flashToast('Nothing rendered'); return; }
    closeExp();
    if(ST.expCfg.zip && blobs.length>1){
      const files=[], names=[];
      for(const b of blobs){
        const fn=String(b.n).padStart(2,'0')+'-'+b.job.file+'.png';
        names.push(fn);
        files.push({name:name+'/'+fn, data:new Uint8Array(await b.blob.arrayBuffer())});
      }
      files.unshift({name:name+'/00-build-info.txt',
        data:new TextEncoder().encode(buildManifest(jobs,B,names))});
      await saveFile(name+'.zip', zipStore(files));
      flashToast(blobs.length+' sheets zipped into '+name+'/');
    } else {
      for(const b of blobs) await saveFile(name+'-'+b.job.file+'.png', b.blob);
      flashToast(blobs.length+' image'+(blobs.length>1?'s':'')+' exported');
    }
  } finally { ST.expLegRows=0; btn.disabled=false; if(lab) lab.textContent='Export'; }
}
// ---- live preview ----------------------------------------------------------
// The switches above are abstract until you see what they make, so the sheet
// they add up to is drawn here as you tick them - at a coarse px-per-block,
// since this only has to read, not print.
// The sheet is drawn at the real px-per-block wherever that stays a sane canvas
// to hold live, so zooming in shows the detail the exported PNG will have.
const PREV_MAX_PX=2.2e6;
let prevPick='', pz={z:1,x:0,y:0};
function prevCanvas(){ const b=$('exp-prev-box'); return b?b.querySelector('canvas'):null; }
function applyPZ(){
  const c=prevCanvas(); if(!c) return;
  c.style.transform='translate(calc(-50% + '+pz.x+'px), calc(-50% + '+pz.y+'px)) scale('+pz.z+')';
  const z=$('exp-zoom-fit'); if(z) z.textContent=Math.round(pz.z*100)+'%';
}
// The box has no size for a frame or two after the dialog is unhidden, and
// fitting against a zero-width box lands on a nonsense (even negative) zoom, so
// wait for a real layout before measuring.
function fitPreview(tries){
  const box=$('exp-prev-box'), c=prevCanvas(); if(!box||!c) return;
  const w=box.clientWidth-16, h=box.clientHeight-16;
  const n=typeof tries==='number'?tries:0;
  if((w<40||h<40) && n<12){ requestAnimationFrame(()=>fitPreview(n+1)); return; }
  pz.z=Math.max(0.05, Math.min(w/c.width, h/c.height, 1));
  pz.x=0; pz.y=0; applyPZ();
}
function zoomBy(k, ax, ay){
  const c=prevCanvas(); if(!c) return;
  const nz=Math.max(0.05, Math.min(6, pz.z*k));
  const r=nz/pz.z;
  pz.x = ax - r*(ax - pz.x); pz.y = ay - r*(ay - pz.y); pz.z = nz;
  applyPZ();
}
// which sheets exist, which are ticked, and which one is on screen
export function renderSheetList(){
  const host=$('exp-sheets'); if(!host) return;
  const cands=exportCandidates();
  if(cands.every(j=>j.file!==prevPick)) prevPick = (cands.find(sheetOn)||cands[0]||{}).file||'';
  host.innerHTML='';
  cands.forEach(j=>{
    const on=sheetOn(j);
    const row=document.createElement('div');
    row.className='exp-sheet'+(on?' on':' off')+(j.file===prevPick?' cur':'');
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=on;
    cb.title=on?'Leave this sheet out':'Include this sheet';
    cb.onclick=ev=>{ ev.stopPropagation(); setSheetOn(j.file, cb.checked); updateExpCount(); };
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=j.title; nm.title=j.title;
    row.appendChild(cb); row.appendChild(nm);
    row.onclick=()=>{ prevPick=j.file; renderSheetList(); updateExpPreview(); };
    host.appendChild(row);
  });
  if(!cands.length){
    const d=document.createElement('div'); d.className='exp-prev-empty';
    d.style.padding='8px'; d.textContent='Nothing on the board yet'; host.appendChild(d);
  }
}
export function updateExpPreview(){
  const box=$('exp-prev-box'), meta=$('exp-prev-meta'), ttl=$('exp-prev-title');
  if(!box) return;
  const cands=exportCandidates(), B=contentBounds();
  const job=cands.find(j=>j.file===prevPick);
  box.innerHTML='';
  if(!job || (!B && job.kind!=='key')){
    if(meta) meta.textContent=''; if(ttl) ttl.textContent='Preview';
    const d=document.createElement('div'); d.className='exp-prev-empty';
    d.textContent = cands.length ? 'Nothing on the board yet' : 'No sheets to show';
    box.appendChild(d); return;
  }
  if(ttl) ttl.textContent=job.title;
  const realPpb=ST.expCfg.ppb;
  try{
    // reserve the same legend depth the batch would, so previews frame like the sheets
    ST.expLegRows=exportJobs().reduce((m,j)=>Math.max(m, expSheet(j,B).rows.length), 0);
    const S=expSheet(job,B), sc=expScaleFor(S.w,S.h);
    if(meta) meta.textContent=Math.round(S.w*sc)+'x'+Math.round(S.h*sc)+' px';
    const cap=GRID*Math.sqrt(PREV_MAX_PX/Math.max(1,S.w*S.h));
    ST.expCfg.ppb=Math.max(8, Math.min(realPpb, cap));
    box.appendChild(renderExport(job, B));
  } catch(e){
    box.innerHTML='';
    const d=document.createElement('div'); d.className='exp-prev-empty';
    d.textContent='Preview unavailable'; box.appendChild(d);
  } finally { ST.expCfg.ppb=realPpb; ST.expLegRows=0; }
  fitPreview();
}
export function updateExpCount(){
  const el=$('exp-count'); if(!el) return;
  const jobs=exportJobs(), B=contentBounds();
  if(!jobs.length){ el.textContent='nothing selected'; return; }
  let txt=jobs.length+' sheet'+(jobs.length>1?'s':'');
  if(B){
    ST.expLegRows=jobs.reduce((m,j)=>Math.max(m, expSheet(j,B).rows.length), 0);
    const S=expSheet(jobs[0],B), sc=expScaleFor(S.w,S.h);
    ST.expLegRows=0;
    txt += ' · '+Math.round(S.w*sc)+'x'+Math.round(S.h*sc)+' px';
    if(sc < ST.expCfg.ppb/GRID - 0.001) txt += ' (capped)';
    txt += ' · '+B.bw+'x'+B.bh+' blocks';
  }
  if(ST.expCfg.zip && jobs.length>1) txt += ' · '+buildName()+'.zip';
  el.textContent=txt;
  renderSheetList();
  updateExpPreview();
}
export function openExp(){ ensurePlan(); expToForm(); $('exp-modal').hidden=false; }
export function closeExp(){ $('exp-modal').hidden=true; }
$('exp-close').onclick=closeExp;
$('exp-bg').onclick=closeExp;
$('exp-modal').addEventListener('change', expFromForm);
$('exp-name').addEventListener('input', expFromForm);
$('exp-name').addEventListener('keydown', e=>e.stopPropagation());
$('exp-zoom-in').onclick=()=>zoomBy(1.25,0,0);
$('exp-zoom-out').onclick=()=>zoomBy(1/1.25,0,0);
$('exp-zoom-fit').onclick=()=>fitPreview();
$('exp-prev-box').addEventListener('wheel', e=>{
  if(!prevCanvas()) return;
  e.preventDefault();
  const r=e.currentTarget.getBoundingClientRect();
  zoomBy(e.deltaY<0?1.12:1/1.12, e.clientX-r.left-r.width/2, e.clientY-r.top-r.height/2);
}, {passive:false});
$('exp-prev-box').addEventListener('pointerdown', e=>{
  const box=e.currentTarget; if(!prevCanvas()) return;
  box.classList.add('panning');
  const sx=e.clientX-pz.x, sy=e.clientY-pz.y;
  try{ box.setPointerCapture(e.pointerId); }catch(_){}
  const move=ev=>{ pz.x=ev.clientX-sx; pz.y=ev.clientY-sy; applyPZ(); };
  const up=()=>{ box.classList.remove('panning');
    box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up);
    box.removeEventListener('pointercancel', up); };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
});
$('exp-run').onclick=runExport;
