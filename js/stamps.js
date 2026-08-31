import { CATALOG } from './catalog.js';
import { STAMP_CAP } from './core.js';
import { snapCenter } from './geometry.js';
import { buildRecent } from './icons.js';
import { render } from './render.js';
import { clearSelection } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { setTool } from './tools.js';

// ---------------- stamps (reusable ghost brushes)
// parts store each piece relative to an anchor (parts[0]); the anchor is the
// top-left-most piece, which gives a stable point to snap the whole stamp by.
export function makeStampFromSel(items){
  const a=items.reduce((best,p)=> (p.y<best.y || (p.y===best.y && p.x<best.x)) ? p : best, items[0]);
  const rest=items.filter(p=>p!==a);
  const ordered=[a,...rest];
  const parts=ordered.map(p=>({type:p.type, dx:p.x-a.x, dy:p.y-a.y, rot:((Math.round(p.rot)%360)+360)%360, flip:!!p.flip}));
  return {sid:0, name:stampName(items), parts, fav:false, ts:Date.now()};
}
export function stampName(items){
  if(items.length===1) return CATALOG[items[0].type].name;
  return items.length+' PIECES';
}
export function stampKey(st){ return st.parts.map(p=>p.type+'@'+Math.round(p.dx)+','+Math.round(p.dy)+':'+p.rot).join('|'); }
// rotate an offset by a right-angle multiple (screen space, y-down)
// rotate an offset by any angle (matches the discrete 90/180/270 cases exactly)
export function rotOff(dx,dy,r){
  const rad=r*Math.PI/180, c=Math.cos(rad), s=Math.sin(rad);
  return [dx*c - dy*s, dx*s + dy*c];
}
// resolve a stamp to concrete piece placements at (cx,cy) with extra rotation R.
// Snap only the anchor, keep every offset rigid -> whole stamp lands on grid.
export function stampInstance(st, cx, cy, R, flip){
  R=((Math.round(R||0)%360)+360)%360;
  const a=st.parts[0], aRot=((a.rot+R)%360+360)%360;
  const snap=snapCenter(a.type, aRot, cx, cy);
  return st.parts.map(pt=>{ const o=rotOff(pt.dx,pt.dy,R); const ox=flip?-o[0]:o[0];
    // a part stored flipped rotates the opposite way: rot' = prot - R (see rotateGroup)
    const pr=pt.flip?-R:R;
    return {type:pt.type, x:snap.x+ox, y:snap.y+o[1], rot:((pt.rot+pr)%360+360)%360, flip:(!!pt.flip)!==!!flip}; });
}
export function addStamp(st){
  const key=stampKey(st);
  const hit=ST.stamps.find(s=>stampKey(s)===key);
  if(hit){ hit.ts=Date.now(); sortStamps(); persistStamps(); buildRecent(); return hit; }
  st.sid=ST.stampUid++;
  ST.stamps.unshift(st);
  // evict oldest non-favorites past the cap
  const recents=ST.stamps.filter(s=>!s.fav);
  if(recents.length>STAMP_CAP){ const kill=new Set(recents.slice(STAMP_CAP).map(s=>s.sid));
    ST.stamps=ST.stamps.filter(s=>!kill.has(s.sid)); }
  sortStamps(); persistStamps(); buildRecent();
  return st;
}
export function sortStamps(){ ST.stamps.sort((a,b)=> (b.fav-a.fav) || (b.ts-a.ts)); }
export function startPlacing(st){ ST.activeStamp=st; ST.placeRot=0; ST.placeFlip=false; clearSelection(); setTool('stamp'); render(); updateStatus(); }
export function persistStamps(){ try{ localStorage.setItem('wardog-fob-stamps', JSON.stringify(ST.stamps)); }catch(e){} }
export function removeStamp(sid){
  ST.stamps=ST.stamps.filter(s=>s.sid!==sid);
  if(ST.activeStamp && ST.activeStamp.sid===sid){ ST.activeStamp=null; if(ST.tool==='stamp') setTool('select'); }
  persistStamps(); buildRecent();
}
