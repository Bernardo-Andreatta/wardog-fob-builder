import { CATALOG } from './catalog.js';
import { GRID } from './dom.js';
import { mixCol } from './floors.js';
import { ST } from './state.js';

// ---------------- build plan: stages + builders -------------------------------
// A stage answers *when* a piece goes down (early walls -> deployables -> fluff);
// a builder answers *who* puts it there. Both are plain tags on a piece (p.st /
// p.bd), independent of floors and layers, so they survive move / rotate /
// duplicate and can be re-tagged long after the build is finished.
export const PLAN_COLORS=['#e6a51e','#4aa3e0','#7ec46a','#e0574a','#b98cff','#3fd0c9','#ff8fbf','#8fb0ff'];
// Names only: what a stage is for is the crew's call, so the note starts empty
// and is theirs to fill in (see the Build Plan modal).
export const DEFAULT_STAGES=['Early','Mid','Late'];
export function ensurePlan(){
  if(!Array.isArray(ST.stages) || !ST.stages.length)
    ST.stages=DEFAULT_STAGES.map((s,i)=>({id:ST.stageUid++, name:s, color:PLAN_COLORS[i], visible:true}));
  if(!Array.isArray(ST.builders) || !ST.builders.length)
    ST.builders=[1,2].map(n=>({id:ST.builderUid++, name:'Builder '+n, color:PLAN_COLORS[(n+2)%PLAN_COLORS.length], visible:true}));
  ST.stages.concat(ST.builders).forEach(e=>{ if(e.visible==null) e.visible=true; });
  ST.stageUid=Math.max(ST.stageUid, ...ST.stages.map(s=>s.id+1));
  ST.builderUid=Math.max(ST.builderUid, ...ST.builders.map(b=>b.id+1));
  // both tags start (and stay) Unassigned until the user picks one, so a piece is
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
  if(ST.planColorBy==='builder'||ST.planColorBy==='both'){ const b=builderOf(p); return b?b.color:mixCol(ink,bg,0.5); }
  return ink;
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
export function planFill(g, p){
  if(ST.planColorBy!=='stage' && ST.planColorBy!=='both') return;
  const s=stageOf(p); if(!s) return;
  drawPlanFill(g, p, s.color, ST.stages.indexOf(s));
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
