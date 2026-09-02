import { CATALOG, DRAW_COLORS, LOGI_ORDER, PIECE_ORDER } from './catalog.js';
import { $ } from './dom.js';
import { GRIP_SVG, TOOL_ICONS } from './svg.js';
import { buildRecent, makeIcon } from './icons.js';
import { uploadImage } from './overlays.js';
import { ST } from './state.js';
import { setTool } from './tools.js';

// ---------------- build rail UI
export function buildRail(){
  const tg=$('tool-grid'); tg.innerHTML='';
  [['pan','Pan'],['select','Select'],['eyedrop','Eyedrop']].forEach(([t,label])=>{
    const b=document.createElement('button');
    b.className='tool'; b.dataset.tool=t; b.title=label;
    b.innerHTML=TOOL_ICONS[t]+'<span class="cap">'+label+'</span>';
    b.onclick=()=>{ ST.userPickedTool=true; setTool(t); }; tg.appendChild(b);
  });
  // Snap and Clear live with the nav tools: always reachable, never a "mode"
  tg.appendChild($('btn-snap'));
  tg.appendChild($('btn-clear'));
  // symbol tools (placed as resizable drawings)
  const SYM_ICONS={
    'sym-rect':'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16"/></svg>',
    'sym-tri':'<svg viewBox="0 0 24 24"><path d="M12 4l8 16H4z"/></svg>',
    'sym-circle':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/></svg>',
  };
  const sg=$('sym-grid'); if(sg){ sg.innerHTML='';
    [['draw','Draw'],['erase','Erase'],['text','Text'],
     ['sym-rect','Square'],['sym-tri','Triangle'],['sym-circle','Circle']].forEach(([t,label])=>{
      const b=document.createElement('button');
      b.className='tool'; b.dataset.tool=t; b.title=label;
      b.innerHTML=(SYM_ICONS[t]||TOOL_ICONS[t])+'<span class="cap">'+label+'</span>';
      b.onclick=()=>{ ST.userPickedTool=true; setTool(t); }; sg.appendChild(b);
    });
    // Image = an action (opens the file picker), not a persistent tool
    const ib=document.createElement('button');
    ib.className='tool'; ib.title='Upload an image overlay';
    ib.innerHTML=TOOL_ICONS.image+'<span class="cap">Image</span>';
    ib.onclick=uploadImage; sg.appendChild(ib);
  }
  fillPieceGrid('piece-grid', PIECE_ORDER, 'wardog-fob-order');
  fillPieceGrid('logi-grid', LOGI_ORDER, 'wardog-fob-logi');
}
export function fillPieceGrid(gridId, order, key){
  const pg=$(gridId); if(!pg) return; pg.innerHTML='';
  order.forEach(type=>{
    const b=document.createElement('button');
    b.className='piece-tool'; b.dataset.tool=type; b.title=CATALOG[type].name+' - click to place, or drag to reorder';
    const img=document.createElement('img'); img.src=makeIcon(type); img.alt=CATALOG[type].name; img.draggable=false;
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=CATALOG[type].name;
    const grip=document.createElement('span'); grip.className='grip'; grip.innerHTML=GRIP_SVG;
    b.appendChild(grip); b.appendChild(img); b.appendChild(nm);
    b.onclick=()=>{ ST.placeRot=0; ST.placeFlip=false; setTool(type); };
    pg.appendChild(b);
  });
  if(key) makeGridSortable(gridId, order, key);
}
// drag-and-drop reordering of the tiles in a grid (visual order only; the
// share-code type indices in CODE_TYPES never change, so codes stay compatible)
export function makeGridSortable(gridId, order, key){
  const grid=$(gridId); if(!grid) return;
  [...grid.children].forEach(btn=>{
    btn.draggable=true;
    btn.addEventListener('dragstart', e=>{ ST.dragCtx={gridId, type:btn.dataset.tool}; btn.classList.add('dragging');
      e.dataTransfer.effectAllowed='move'; try{ e.dataTransfer.setData('text/plain', btn.dataset.tool); }catch(_){} });
    btn.addEventListener('dragend', ()=>{ btn.classList.remove('dragging'); clearDropCues(grid); ST.dragCtx=null; });
    btn.addEventListener('dragover', e=>{ if(!ST.dragCtx||ST.dragCtx.gridId!==gridId) return; e.preventDefault(); e.dataTransfer.dropEffect='move';
      clearDropCues(grid); if(btn.dataset.tool!==ST.dragCtx.type) btn.classList.add('drop-here'); });
    btn.addEventListener('dragleave', ()=>btn.classList.remove('drop-here'));
    btn.addEventListener('drop', e=>{ if(!ST.dragCtx||ST.dragCtx.gridId!==gridId) return; e.preventDefault();
      clearDropCues(grid);
      dropTile(order, key, gridId, ST.dragCtx.type, btn, e);
    });
    gripDrag(grid, btn, order, key, gridId);
  });
}
// where a tile lands: the drop point is split diagonally, which reads the same
// whether the grid flows in rows (desktop rail) or columns (mobile bar)
function dropTile(order, key, gridId, src, el, ev){
  const tgt=el.dataset.tool;
  if(!src || src===tgt) return;
  const r=el.getBoundingClientRect();
  const after = ((ev.clientY-r.top)/r.height + (ev.clientX-r.left)/r.width) > 1;
  const from=order.indexOf(src); if(from<0) return; order.splice(from,1);
  let to=order.indexOf(tgt); if(to<0){ order.splice(from,0,src); return; }
  order.splice(after?to+1:to, 0, src);
  persistOrder(key, order);
  fillPieceGrid(gridId, order, key);
}
// Touch has no HTML5 drag-and-drop, so on those devices the grip stops being a
// hint and becomes the handle: hold it, then slide onto another tile. Only the
// grip starts a reorder, so tapping the tile itself still arms the piece.
//
// The hold is the point. Taking the finger on contact meant every swipe that
// began on a grip was a reorder instead of a scroll, and the grips sit in the
// corner of every tile - there was nowhere safe to start a swipe. So the press
// has to stand still for HOLD_MS before it becomes a drag; move sooner and the
// rail scrolls as though the grip were not there.
const HOLD_MS=280, HOLD_SLOP=8;
function gripDrag(grid, btn, order, key, gridId){
  const grip=btn.querySelector('.grip'); if(!grip) return;
  grip.addEventListener('click', e=>{ e.stopPropagation(); e.preventDefault(); });
  grip.addEventListener('pointerdown', e=>{
    if(e.pointerType==='mouse') return;          // mouse keeps the native drag
    const sx=e.clientX, sy=e.clientY;
    let armed=false, moved=false, timer=0;
    const tileUnder=ev=>{
      const el=document.elementFromPoint(ev.clientX, ev.clientY);
      const t=el&&el.closest ? el.closest('.piece-tool') : null;
      return (t && t.parentElement===grid && t!==btn) ? t : null;
    };
    // once armed the finger belongs to the drag, and a non-passive touchmove is
    // what actually stops the rail scrolling under it
    const block=ev=>ev.preventDefault();
    const arm=()=>{
      armed=true; timer=0;
      btn.classList.add('dragging');
      try{ grip.setPointerCapture(e.pointerId); }catch(_){}
      document.addEventListener('touchmove', block, {passive:false});
      try{ navigator.vibrate && navigator.vibrate(12); }catch(_){}
    };
    const move=ev=>{
      if(!armed){
        // still deciding: a finger that travels is a swipe, so let it go
        if(Math.hypot(ev.clientX-sx, ev.clientY-sy)>HOLD_SLOP) stop();
        return;
      }
      moved=true; clearDropCues(grid);
      const t=tileUnder(ev); if(t) t.classList.add('drop-here');
    };
    const stop=()=>{
      if(timer) clearTimeout(timer); timer=0;
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', stop);
      document.removeEventListener('touchmove', block, {passive:false});
      btn.classList.remove('dragging'); clearDropCues(grid);
      armed=false;
    };
    const end=ev=>{
      const t=(armed && moved) ? tileUnder(ev) : null;
      stop();
      if(t) dropTile(order, key, gridId, btn.dataset.tool, t, ev);
    };
    timer=setTimeout(arm, HOLD_MS);
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', stop);
  });
}
export function clearDropCues(grid){ grid.querySelectorAll('.drop-here').forEach(x=>x.classList.remove('drop-here')); }
export function persistOrder(key, order){ try{ localStorage.setItem(key, JSON.stringify(order)); }catch(e){} }
// reorder an order array to match a saved list, keeping any newly-added types at the end
export function applySavedOrder(order, key){
  try{ const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(Array.isArray(saved)){
      const set=new Set(order), out=saved.filter(t=>set.has(t));
      order.forEach(t=>{ if(!out.includes(t)) out.push(t); });
      order.splice(0, order.length, ...out);
    }
  }catch(e){}
}
export function refreshIcons(){
  document.querySelectorAll('#piece-grid .piece-tool img').forEach((img,i)=>{ img.src=makeIcon(PIECE_ORDER[i]); });
  document.querySelectorAll('#logi-grid .piece-tool img').forEach((img,i)=>{ img.src=makeIcon(LOGI_ORDER[i]); });
  buildRecent();   // stamp icons use theme colors too
}

// ---------------- swatches
export function buildSwatches(){
  const sw=$('swatches'); sw.innerHTML='';
  DRAW_COLORS.forEach(col=>{
    const b=document.createElement('button');
    b.className='sw'+(col===ST.drawColor?' active':''); b.style.background=col; b.title=col;
    b.onclick=()=>{ ST.drawColor=col; document.querySelectorAll('.sw').forEach(x=>x.classList.remove('active')); b.classList.add('active'); };
    sw.appendChild(b);
  });
}
