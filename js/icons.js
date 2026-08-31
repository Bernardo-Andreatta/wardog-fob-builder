import { CATALOG } from './catalog.js';
import { $, GRID } from './dom.js';
import { DRAWERS } from './drawers.js';
import { LOW_TYPES, mixCol } from './floors.js';
import { cssVar } from './render.js';
import { persistStamps, removeStamp, sortStamps, startPlacing } from './stamps.js';
import { ST } from './state.js';

// ---------------- icons (render each drawer to an offscreen canvas)
export function makeIcon(type, px){
  const size=px||36, pad=5, dpr=2;
  const c=document.createElement('canvas'); c.width=size*dpr; c.height=size*dpr;
  const g=c.getContext('2d'); g.scale(dpr,dpr);
  const cat=CATALOG[type], s=(size-pad*2)/(Math.max(cat.w,cat.h)*GRID);
  g.translate(size/2,size/2); g.scale(s,s);
  g.strokeStyle = LOW_TYPES.indexOf(type)!==-1 ? mixCol(cssVar('--ink'),cssVar('--canvas-bg'),0.5) : cssVar('--ink');
  g.fillStyle=g.strokeStyle;
  g.lineWidth=1.8/s; g.lineJoin='round'; g.lineCap='round';
  DRAWERS[type](g, cat.w*GRID, cat.h*GRID);
  return c.toDataURL();
}
// render a whole stamp (all parts) fitted into one small icon
export function makeStampIcon(st, px){
  const size=px||36, pad=5, dpr=2;
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  st.parts.forEach(pt=>{ const c=CATALOG[pt.type], r=((Math.round(pt.rot)%360)+360)%360;
    const w=(r===90||r===270?c.h:c.w)*GRID, h=(r===90||r===270?c.w:c.h)*GRID;
    mnx=Math.min(mnx,pt.dx-w/2); mxx=Math.max(mxx,pt.dx+w/2);
    mny=Math.min(mny,pt.dy-h/2); mxy=Math.max(mxy,pt.dy+h/2); });
  const bw=mxx-mnx, bh=mxy-mny, ox=(mnx+mxx)/2, oy=(mny+mxy)/2;
  const c=document.createElement('canvas'); c.width=size*dpr; c.height=size*dpr;
  const g=c.getContext('2d'); g.scale(dpr,dpr);
  const s=(size-pad*2)/Math.max(bw,bh,GRID);
  g.translate(size/2,size/2); g.scale(s,s); g.translate(-ox,-oy);
  g.strokeStyle=cssVar('--ink'); g.fillStyle=g.strokeStyle;
  g.lineWidth=1.8/s; g.lineJoin='round'; g.lineCap='round';
  st.parts.forEach(pt=>{ const cat=CATALOG[pt.type];
    g.save(); g.translate(pt.dx,pt.dy); g.rotate(pt.rot*Math.PI/180);
    DRAWERS[pt.type](g, cat.w*GRID, cat.h*GRID); g.restore(); });
  return c.toDataURL();
}
export function highlightRecent(){
  document.querySelectorAll('#recent-grid .piece-tool').forEach(b=>
    b.classList.toggle('active', !!ST.activeStamp && +b.dataset.sid===ST.activeStamp.sid));
}
export function buildRecent(){
  const wrap=$('recent-wrap'), grid=$('recent-grid'); if(!grid) return;
  sortStamps(); grid.innerHTML='';
  wrap.style.display = ST.stamps.length ? '' : 'none';
  ST.stamps.forEach(st=>{
    const b=document.createElement('button');
    b.className='piece-tool'+(ST.activeStamp&&ST.activeStamp.sid===st.sid?' active':'');
    b.dataset.sid=st.sid; b.title='Place '+st.name+' - click, then stamp on grid';
    const img=document.createElement('img'); img.src=makeStampIcon(st); img.alt=st.name;
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=st.name;
    const star=document.createElement('button'); star.className='star'+(st.fav?' on':'');
    star.innerHTML = st.fav?'&#9733;':'&#9734;';
    star.title = st.fav?'Unstar':'Star to keep in Recent';
    star.onclick=(e)=>{ e.stopPropagation(); st.fav=!st.fav; persistStamps(); buildRecent(); };
    const rm=document.createElement('button'); rm.className='rm'; rm.innerHTML='&minus;';
    rm.title='Remove from Recent';
    rm.onclick=(e)=>{ e.stopPropagation(); removeStamp(st.sid); };
    b.appendChild(img); b.appendChild(nm); b.appendChild(star); b.appendChild(rm);
    b.onclick=()=>{ startPlacing(st); };
    grid.appendChild(b);
  });
}
