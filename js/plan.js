import { CATALOG } from './catalog.js';
import { GRID } from './dom.js';
import { _hx, mixCol } from './floors.js';
import { ST } from './state.js';

// ---------------- build plan: stages + builders -------------------------------
// A stage answers *when* a piece goes down (early walls -> deployables -> fluff);
// a builder answers *who* puts it there. Both are plain tags on a piece (p.st /
// p.bd), independent of floors and layers, so they survive move / rotate /
// duplicate and can be re-tagged long after the build is finished.
// Mid-tone hues on purpose: a pale tag vanishes on the sand-coloured board and
// a dark one vanishes on the near-black one. tagInk() then nudges whichever is
// drawn away from the canvas it lands on.
export const PLAN_COLORS=['#c8871a','#2f7fc4','#4e9b3f','#c8402f','#8a5cd6','#149c92','#cc4f86','#4a6fc4'];
// Stages and builders share the one palette, and a new tag takes the first
// colour nobody is using - starting from an offset picked per session, so two
// builds do not both open with the same yellow, then the same blue.
let colSeed = Math.floor(Math.random()*PLAN_COLORS.length);
export function nextPlanColor(){
  const used=new Set(ST.stages.concat(ST.builders).map(e=>(e.color||'').toLowerCase()));
  for(let i=0;i<PLAN_COLORS.length;i++){
    const c=PLAN_COLORS[(colSeed+i)%PLAN_COLORS.length];
    if(!used.has(c.toLowerCase())){ colSeed=(colSeed+i+1)%PLAN_COLORS.length; return c; }
  }
  const c=PLAN_COLORS[colSeed%PLAN_COLORS.length];
  colSeed=(colSeed+1)%PLAN_COLORS.length; return c;
}
// A tag's stored colour is its identity and never changes; what gets *drawn* is
// pushed away from the board underneath it, so the same tag stays legible in
// both themes instead of washing out on one of them.
function lightBg(bg){ const c=_hx(bg); return (c[0]*0.299+c[1]*0.587+c[2]*0.114) > 140; }
export function tagInk(col, bg){
  return lightBg(bg) ? mixCol(col,'#241d10',0.28) : mixCol(col,'#fbf7ea',0.22);
}
// A build starts with no plan at all - no stages, no builders. Naming them is
// the crew's call, and pieces stay General until someone does, so nothing on
// the board is ever tagged with a name nobody chose.
export function ensurePlan(){
  if(!Array.isArray(ST.stages)) ST.stages=[];
  if(!Array.isArray(ST.builders)) ST.builders=[];
  ST.stages.concat(ST.builders).forEach(e=>{ if(e.visible==null) e.visible=true; });
  ST.stageUid=Math.max(ST.stageUid, ...ST.stages.map(s=>s.id+1));
  ST.builderUid=Math.max(ST.builderUid, ...ST.builders.map(b=>b.id+1));
  // both tags start (and stay) General until the user picks one, so a piece is
  // never silently stamped with a stage / builder nobody chose
  if(ST.curStageId===undefined) ST.curStageId = null;
  if(ST.curBuilderId===undefined) ST.curBuilderId = null;
  if(ST.curStageId!=null && !stageById(ST.curStageId)) ST.curStageId = null;
  if(ST.curBuilderId!=null && !builderById(ST.curBuilderId)) ST.curBuilderId = null;
}
export function stageById(id){ return ST.stages.find(s=>s.id===id)||null; }
export function builderById(id){ return ST.builders.find(b=>b.id===id)||null; }
export function stageOf(p){ return p.st==null?null:stageById(p.st); }
export function builderOf(p){ return p.bd==null?null:builderById(p.bd); }
export function stageIndex(p){ const s=stageOf(p); return s?ST.stages.indexOf(s):-1; }
// a piece shows on the board only while both of its tags are unfiltered
export function planVisible(p){
  const s=stageOf(p), b=builderOf(p);
  return (s?s.visible:ST.showNoStage) && (b?b.visible:ST.showNoBuilder);
}
// Two channels, and they never swap: the OUTLINE says *who* (builder), the FILL
// says *when* (stage). Colour-by 'stage' therefore leaves the outline neutral and
// paints the stage on as a wash; untagged pieces stay ink, dimmed.
export function planColorOf(p, ink, bg){
  // General is nobody in particular: with no builder in view there is no crew
  // to pick out, so the outlines drop back to plain ink instead of showing the
  // whole roster's colours at once
  const b = ST.hlBuilder===undefined ? null : builderOf(p);
  let col = b ? tagInk(b.color, bg) : ink;
  if(!planLit(p)) col=mixCol(col,bg,0.78);      // out of view: ghosted, as on a sheet
  return col;
}
// The board shows one stage at a time: what carries it reads normally, each
// piece in its builder's colour, and the other stages drop back without leaving
// the board. Pick a builder inside the stage and only their work stays up.
//
// General is the exception at both ends. Selecting it is not "show me the
// untagged", it is "show me everything" - and a piece left on General belongs
// to no stage in particular, so it stands in every stage's view rather than
// being ghosted out of the one you are working in.
export function planLit(p){
  const cur = ST.curStageId==null ? null : ST.curStageId;
  const st  = p.st==null ? null : p.st;
  if(cur!==null && st!==null && st!==cur) return false;
  if(ST.hlBuilder===undefined) return true;     // General builder: every hand
  const bd = p.bd==null ? null : p.bd;
  return bd===null || bd===ST.hlBuilder;        // General work stands alongside
}

// The fill channel. The outline says *who* (builder); this one says *when*: a
// translucent wash plus a hatch whose angle belongs to that stage, so the two
// dimensions read at the same time - and the hatch still separates stages in
// greyscale or for anyone who can't split the colours apart.
export const HATCH_ANGLES=[Math.PI/4, -Math.PI/4, 0, Math.PI/2, Math.PI/8, -Math.PI/8, 3*Math.PI/8, -3*Math.PI/8];
export function drawPlanFill(g, p, col, idx){
  const c=CATALOG[p.type]; if(!c) return;
  const w=c.w*GRID, h=c.h*GRID, r=(p.rot||0)*Math.PI/180;
  const n=HATCH_ANGLES.length, ang=HATCH_ANGLES[((idx%n)+n)%n];
  g.save();
  g.translate(p.x,p.y); g.rotate(r);
  g.beginPath(); g.rect(-w/2,-h/2,w,h); g.clip();
  g.globalAlpha=0.14; g.fillStyle=col; g.fillRect(-w/2,-h/2,w,h);
  g.rotate(ang-r);                       // hatch angle is absolute, not per-piece
  const R=Math.hypot(w,h)/2+GRID/4, step=GRID/3.2;
  g.globalAlpha=0.42; g.strokeStyle=col; g.lineWidth=1.5; g.lineCap='butt';
  g.beginPath();
  for(let d=-R; d<=R; d+=step){ g.moveTo(-R,d); g.lineTo(R,d); }
  g.stroke();
  g.restore();
}
// the board's own fill pass (export builds its own from the job's fill channel)
export function planFill(g, p, bg){
  if(!planLit(p)) return;                       // a ghosted piece carries no hatch
  if(ST.curStageId==null) return;               // General: no stage in view, no wash
  const s=stageOf(p); if(!s) return;
  drawPlanFill(g, p, tagInk(s.color, bg), ST.stages.indexOf(s));
}
export function planCount(kind, id){
  return ST.pieces.filter(p=>{ const v = kind==='stage'?p.st:p.bd; return (v==null?null:v)===id; }).length;
}
// filtering a tag off the board must not leave its pieces selected
export function pruneSelToPlan(){
  ST.selected=ST.selected.filter(id=>{ const p=ST.pieces.find(x=>x.id===id); return p && planVisible(p); });
}
// share codes and .json files carry their own tag tables: adopt them under fresh
// local ids and hand back a mapper from a stored tag (index or old id) to the new id
export function adoptPlan(o){
  const S=(o.stages||[]).map((s,i)=>({id:ST.stageUid++, name:s.name||('Stage '+(i+1)),
    note:s.note||undefined, color:s.color||PLAN_COLORS[i%PLAN_COLORS.length], visible:true, _old:s.id}));
  const B=(o.builders||[]).map((b,i)=>({id:ST.builderUid++, name:b.name||('Builder '+(i+1)),
    color:b.color||PLAN_COLORS[(i+2)%PLAN_COLORS.length], visible:true, _old:b.id}));
  if(S.length) ST.stages=S;
  if(B.length) ST.builders=B;
  ST.curStageId=undefined; ST.curBuilderId=undefined; ST.showNoStage=true; ST.showNoBuilder=true;
  ensurePlan();
  return (kind,p)=>{
    const arr = kind==='stage'?ST.stages:ST.builders;
    const idx = kind==='stage'?p._s:p._b, old = kind==='stage'?p.st:p.bd;
    if(idx){ const e=arr[idx-1]; return e?e.id:null; }          // v3 code: 1-based index
    if(old!=null){ const e=arr.find(x=>x._old===old); return e?e.id:null; }   // .json: old id
    return null;
  };
}
export function cleanPlan(){ ST.stages.concat(ST.builders).forEach(e=>{ delete e._old; }); }
