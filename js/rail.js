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
      const src=ST.dragCtx.type, tgt=btn.dataset.tool; clearDropCues(grid);
      if(src===tgt) return;
      const r=btn.getBoundingClientRect();
      const after = ((e.clientY-r.top)/r.height + (e.clientX-r.left)/r.width) > 1;  // diagonal split (works for rows & columns)
      const from=order.indexOf(src); if(from<0) return; order.splice(from,1);
      let to=order.indexOf(tgt); if(to<0){ order.splice(from,0,src); return; }
      order.splice(after?to+1:to, 0, src);
      persistOrder(key, order);
      fillPieceGrid(gridId, order, key);
    });
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
