import { pieceLayer } from './floors.js';
import { snapshot } from './history.js';
import { layerEditable } from './layers.js';
import { render } from './render.js';
import { isSel, selectedPieces } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { flashToast } from './topbar.js';

// ---------------- groups (persistent binding of placed items) -----------------
// every item may carry `g` (a shared group id). Selecting any member selects the
// whole group, so it moves / rotates / duplicates / deletes as one unit.
export function selItemObjs(){
  return { ps:selectedPieces(),
           ims:ST.images.filter(i=>ST.selImages.includes(i.id)),
           ts:ST.texts.filter(t=>ST.selTexts.includes(t.id)),
           ss:ST.strokes.filter(s=>ST.selStrokes.indexOf(s)!==-1) };
}
export function groupSel(){
  const {ps,ims,ts,ss}=selItemObjs();
  const all=[...ps,...ims,...ts,...ss];
  if(all.length<2){ flashToast('Select 2+ items to group'); return; }
  const gid=ST.groupUid++;
  all.forEach(it=>it.g=gid);
  snapshot(); render(); updateStatus(); flashToast('Grouped '+all.length+' items');
}
export function ungroupSel(){
  const {ps,ims,ts,ss}=selItemObjs(); let any=false;
  [...ps,...ims,...ts,...ss].forEach(it=>{ if(it.g!=null){ delete it.g; any=true; } });
  if(any){ snapshot(); render(); updateStatus(); flashToast('Ungrouped'); }
}
export function hasGroupInSel(){ return selItemObjs && [...selItemObjs().ps,...selItemObjs().ims,...selItemObjs().ts,...selItemObjs().ss].some(it=>it.g!=null); }
// pull every sibling of an already-selected grouped item into the selection
export function expandGroups(){
  const gids=new Set();
  const {ps,ims,ts,ss}=selItemObjs();
  [...ps,...ims,...ts,...ss].forEach(it=>{ if(it.g!=null) gids.add(it.g); });
  if(!gids.size) return;
  ST.pieces.forEach(p=>{ if(p.g!=null&&gids.has(p.g)&&!isSel(p.id)&&layerEditable(p)&&pieceLayer(p)<=ST.curLayer) ST.selected.push(p.id); });
  ST.images.forEach(i=>{ if(i.g!=null&&gids.has(i.g)&&!ST.selImages.includes(i.id)&&layerEditable(i)) ST.selImages.push(i.id); });
  ST.texts.forEach(t=>{ if(t.g!=null&&gids.has(t.g)&&!ST.selTexts.includes(t.id)&&layerEditable(t)) ST.selTexts.push(t.id); });
  ST.strokes.forEach(s=>{ if(s.g!=null&&gids.has(s.g)&&ST.selStrokes.indexOf(s)===-1&&layerEditable(s)) ST.selStrokes.push(s); });
}
