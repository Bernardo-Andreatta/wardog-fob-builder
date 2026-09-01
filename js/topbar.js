import { deleteSel, duplicateSel, mirrorGroup, rotStep, rotateGroup, stepPlaceRot } from './actions.js';
import { CATALOG } from './catalog.js';
import { $, GRID, stage } from './dom.js';
import { openExp } from './exporter.js';
import { pieceLayer } from './floors.js';
import { screenToWorld } from './geometry.js';
import { groupSel, ungroupSel } from './groups.js';
import { persist, redo, snapshot, undo } from './history.js';
import { ensureLayers } from './layers.js';
import { renderLayerPanel } from './layerspanel.js';
import { adoptPlan, cleanPlan } from './plan.js';
import { renderPlanPanel } from './planpanel.js';
import { refreshIcons } from './rail.js';
import { cssVar, render } from './render.js';
import { anySelected, clearOverlaySel, clearSelection, hasRotSel, hydrateImages, imagesData } from './selection.js';
import { ST } from './state.js';
import { updateStatus } from './status.js';
import { inNavTool, setTool } from './tools.js';

// ---------------- top bar buttons
$('tool-exit').onclick=()=>{
  // with a selection in a nav tool the chip just deselects; otherwise it exits the tool
  if(inNavTool() && anySelected()){ clearSelection(); clearOverlaySel(); render(); updateStatus(); return; }
  clearSelection(); clearOverlaySel(); setTool(ST.lastNavTool);
};
export const inGhost=()=>CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp);
export function fabRot(d){
  if(hasRotSel()) rotateGroup(d);
  else if(inGhost()){ ST.placeRot=((ST.placeRot+d)%360+360)%360; render(); }
}
$('rot-cw').onclick=()=>fabRot(45);
$('rot-ccw').onclick=()=>fabRot(-45);
$('fab-mirror').onclick=()=>{
  if(hasRotSel()) mirrorGroup();
  else if(inGhost()){ ST.placeFlip=!ST.placeFlip; render(); }
};
$('fab-copy').onclick=()=>duplicateSel();
$('fab-group').onclick=()=>groupSel();
$('fab-ungroup').onclick=()=>ungroupSel();
$('fab-delete').onclick=()=>deleteSel();
$('fab-undo').onclick=()=>undo();
$('fab-redo').onclick=()=>redo();
$('btn-theme').onclick=()=>{
  const root=document.documentElement;
  const cur=root.getAttribute('data-theme');
  const sysDark=matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = cur==='dark' || (cur===null && sysDark);
  root.setAttribute('data-theme', isDark?'light':'dark');
  refreshIcons(); render();
};
$('btn-delete').onclick=deleteSel;
$('btn-rotate').onclick=()=>{ if(hasRotSel()) rotateGroup(rotStep()); else stepPlaceRot(1); };
$('btn-mirror').onclick=()=>{
  if(hasRotSel()) mirrorGroup();
  else if(CATALOG[ST.tool] || (ST.tool==='stamp'&&ST.activeStamp)){ ST.placeFlip=!ST.placeFlip; render(); }
};
$('btn-duplicate').onclick=duplicateSel;
// Clear: two-click confirm (browser confirm() is blocked in the artifact sandbox)
export function resetClearBtn(){ ST.clearArm=false; const b=$('btn-clear'); b.classList.remove('armed'); b.querySelector('span').textContent='Clear'; }
$('btn-clear').onclick=()=>{
  if(!ST.pieces.length && !ST.strokes.length && !ST.images.length && !ST.texts.length && ST.layers.length<=1){ return; }
  const b=$('btn-clear');
  if(!ST.clearArm){
    ST.clearArm=true; b.classList.add('armed'); b.querySelector('span').textContent='Confirm?';
    ST.clearTimer=setTimeout(resetClearBtn, 2600); return;
  }
  clearTimeout(ST.clearTimer); resetClearBtn();
  ST.pieces=[]; ST.strokes=[]; ST.images=[]; ST.texts=[]; clearSelection(); clearOverlaySel();
  ST.layers=[]; ST.selLayers=[]; ST.curLayerId=0; ST.curLayer=0; ensureLayers();   // back to a single Ground layer
  $('layer-val').textContent='G'; renderLayerPanel();
  renderPlanPanel();
  snapshot(); render(); updateStatus();
};
// unified save: uses the artifact downloads capability when present, else a normal browser download
export async function saveFile(filename, data){
  let dl=null;
  try{ if(window.claude && claude.use) dl = await claude.use('downloads'); }catch(e){ dl=null; }
  if(dl){
    try{ await dl.save({filename, data}); }
    catch(e){ if(e && e.code && e.code!=='declined') alert('Could not save file: '+(e.message||e.code)); }
    return;
  }
  const blob = (data instanceof Blob) ? data : new Blob([data]);
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
export function exportFile(){
  // strip runtime-only fields (_ix/_iy/_ipts rotation ideals) from the file
  const P=ST.pieces.map(p=>({id:p.id,type:p.type,x:p.x,y:p.y,rot:p.rot||0,flip:!!p.flip,l:p.l||0,
    st:p.st==null?null:p.st, bd:p.bd==null?null:p.bd}));
  const S=ST.strokes.map(s=>({pts:s.pts,color:s.color,width:s.width}));
  const T=ST.texts.map(t=>({id:t.id,text:t.text,x:t.x,y:t.y,size:t.size,color:t.color,rot:t.rot||0}));
  saveFile('fob-layout.json', JSON.stringify({pieces:P,strokes:S,view:ST.view,images:imagesData(),texts:T,stages:ST.stages,builders:ST.builders},null,2));
}
export function importFile(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=()=>{ const f=inp.files[0]; if(!f)return; const rd=new FileReader();
    rd.onload=()=>{ try{ const o=JSON.parse(rd.result); ST.pieces=o.pieces||[]; ST.strokes=o.strokes||[];
      ST.images=o.images||[]; ST.texts=o.texts||[]; hydrateImages(); clearOverlaySel();
      const map=adoptPlan(o);            // the file brings its own stage/builder tables
      ST.pieces.forEach(p=>{ p.st=map('stage',p); p.bd=map('builder',p); });
      cleanPlan(); renderPlanPanel();
      if(o.view)ST.view=o.view; ST.uid=Math.max(1,...ST.pieces.map(p=>p.id||0), ...ST.images.map(i=>i.id||0), ...ST.texts.map(t=>t.id||0))+1; clearSelection();
      snapshot(); render(); updateStatus(); closeFile(); }catch(err){ alert('Could not read that file.'); } };
    rd.readAsText(f); };
  inp.click();
}
export function openFile(){ $('file-modal').hidden=false; }
export function closeFile(){ $('file-modal').hidden=true; }
$('btn-file').onclick=openFile;
$('file-close').onclick=closeFile;
$('file-bg').onclick=closeFile;
$('file-export').onclick=()=>{ exportFile(); closeFile(); };
$('file-import').onclick=importFile;
$('file-png').onclick=()=>{ closeFile(); openExp(); };
// ---- shareable build code (base64 of the build JSON) ----
// Fixed type list for share codes: APPEND-ONLY (indices must never change, or
// old codes break). Decoupled from PIECE_ORDER so the rail can be reordered.
export const CODE_TYPES=['wall','quadra','bunker','door','barbed','gate','sandbags','hedgehog','tower','mortar','drill','aa','sam','spawn','fob','helipad','supply','parking','codetower','shortwall'];
// URL/Reddit-safe base64: no + / = (those wrap or get mangled in links & comments)
export function b64enc(str){ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export function b64dec(str){ let s=str.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return decodeURIComponent(escape(atob(s))); }
// ---- v3: delta-encoded payload, deflated. Neighbouring pieces sit a cell or
// two apart, so storing offsets instead of absolute coordinates leaves a very
// repetitive string that deflate crushes (~25x smaller links than v2).
export const CAN_ZIP = typeof CompressionStream!=='undefined' && typeof DecompressionStream!=='undefined';
export function b64bytes(bytes){ let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export function bytesFromB64(str){ let s=str.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const bin=atob(s), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out; }
export async function zip(str){
  const cs=new CompressionStream('deflate-raw');
  const w=cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
export async function unzip(bytes){
  const ds=new DecompressionStream('deflate-raw');
  const w=ds.writable.getWriter(); w.write(bytes); w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}
export function payloadV3(){
  let px=0, py=0;
  const P=ST.pieces.map(p=>{
    const x=Math.round(p.x), y=Math.round(p.y);
    const a=[CODE_TYPES.indexOf(p.type), x-px, y-py, Math.round(p.rot)||0, p.flip?1:0, p.l||0,
      p.st==null?0:ST.stages.findIndex(t=>t.id===p.st)+1, p.bd==null?0:ST.builders.findIndex(t=>t.id===p.bd)+1];
    px=x; py=y;
    while(a.length>3 && a[a.length-1]===0) a.pop();
    return a;
  });
  const obj={d:P};
  const S=(ST.strokes||[]).filter(s=>s.pts&&s.pts.length).map(s=>{
    let qx=0, qy=0; const f=[];
    s.pts.forEach(pt=>{ const x=Math.round(pt.x), y=Math.round(pt.y);
      f.push(x-qx, y-qy); qx=x; qy=y; });
    return [s.color, Math.round(s.width), f];
  });
  if(S.length) obj.s=S;
  const T=(ST.texts||[]).filter(t=>t.text).map(t=>[t.text, Math.round(t.x), Math.round(t.y), Math.round(t.size), t.color, Math.round(t.rot||0)]);
  if(T.length) obj.t=T;
  if(ST.stages.length) obj.g=ST.stages.map(t=>t.note?[t.name,t.color,t.note]:[t.name,t.color]);
  if(ST.builders.length) obj.b=ST.builders.map(t=>[t.name,t.color]);
  return obj;
}
export async function encodeBuild(){
  if(CAN_ZIP){
    try{ return 'FOB3.'+b64bytes(await zip(JSON.stringify(payloadV3()))); }
    catch(e){}   // no compression support: fall back to the plain v2 code
  }
  return encodeBuildV2();
}
// v2: compact arrays, type as an index, no ids, default rot/flip trimmed
export function encodeBuildV2(){
  const P=ST.pieces.map(p=>{
    const a=[CODE_TYPES.indexOf(p.type), Math.round(p.x), Math.round(p.y), Math.round(p.rot)||0, p.flip?1:0, p.l||0];
    while(a.length>3 && a[a.length-1]===0) a.pop();   // trim trailing floor / flip / rot zeros
    return a;
  });
  const obj={p:P};
  const S=(ST.strokes||[]).filter(s=>s.pts&&s.pts.length).map(s=>[s.color, Math.round(s.width),
    s.pts.flatMap(pt=>[Math.round(pt.x),Math.round(pt.y)])]);
  if(S.length) obj.s=S;
  // labels ride along (small); uploaded images do not (too large for a code)
  const T=(ST.texts||[]).filter(t=>t.text).map(t=>[t.text, Math.round(t.x), Math.round(t.y), Math.round(t.size), t.color, Math.round(t.rot||0)]);
  if(T.length) obj.t=T;
  return 'FOB2.'+b64enc(JSON.stringify(obj));
}
export async function decodeBuild(code){
  let s=(code||'').trim().replace(/\s+/g,'');
  if(s.startsWith('FOB3.')){
    const o=JSON.parse(await unzip(bytesFromB64(s.slice(5))));
    if(!o||!Array.isArray(o.d)) throw new Error('bad');
    let px=0, py=0;
    const dPieces=o.d.map(a=>{ const t=CODE_TYPES[a[0]]; if(!t) throw new Error('bad');
      px+=a[1]||0; py+=a[2]||0;
      return {type:t, x:px, y:py, rot:a[3]||0, flip:!!a[4], l:a[5]||0, _s:a[6]||0, _b:a[7]||0}; });
    const dStrokes=(o.s||[]).map(a=>{ const f=a[2]||[], pts=[]; let qx=0, qy=0;
      for(let i=0;i+1<f.length;i+=2){ qx+=f[i]; qy+=f[i+1]; pts.push({x:qx,y:qy}); }
      return {color:a[0], width:a[1], pts}; });
    const dTexts=(o.t||[]).map(a=>({text:a[0], x:a[1], y:a[2], size:a[3]||GRID*0.6, color:a[4], rot:a[5]||0}));
    return {pieces:dPieces, strokes:dStrokes, texts:dTexts, ink:o.c||null,
      stages:(o.g||[]).map(a=>({name:a[0], color:a[1], note:a[2]||undefined})),
      builders:(o.b||[]).map(a=>({name:a[0], color:a[1]}))};
  }
  if(s.startsWith('FOB2.')){
    const o=JSON.parse(b64dec(s.slice(5)));
    if(!o||!Array.isArray(o.p)) throw new Error('bad');
    const dPieces=o.p.map(a=>{ const t=CODE_TYPES[a[0]]; if(!t) throw new Error('bad');
      return {type:t, x:a[1], y:a[2], rot:a[3]||0, flip:!!a[4], l:a[5]||0}; });
    const dStrokes=(o.s||[]).map(a=>{ const f=a[2]||[], pts=[];
      for(let i=0;i+1<f.length;i+=2) pts.push({x:f[i],y:f[i+1]});
      return {color:a[0], width:a[1], pts}; });
    const dTexts=(o.t||[]).map(a=>({text:a[0], x:a[1], y:a[2], size:a[3]||GRID*0.6, color:a[4], rot:a[5]||0}));
    return {pieces:dPieces, strokes:dStrokes, texts:dTexts, ink:o.c||null};
  }
  // legacy FOB1: base64 of the full JSON
  if(s.startsWith('FOB1.')) s=s.slice(5);
  const o=JSON.parse(b64dec(s));
  if(!o || !Array.isArray(o.pieces)) throw new Error('bad');
  return o;
}
export function loadBuild(o){
  const map=adoptPlan(o);
  ST.pieces=(o.pieces||[]).map(p=>({id:ST.uid++, type:p.type, x:p.x, y:p.y, rot:p.rot||0, flip:!!p.flip, l:p.l||0,
    st:map('stage',p), bd:map('builder',p)}));
  cleanPlan(); renderPlanPanel();
  ST.strokes=o.strokes||[];
  ST.texts=(o.texts||[]).map(t=>({id:ST.uid++, text:t.text, x:t.x, y:t.y, size:t.size||GRID*0.6, color:t.color||cssVar('--piece'), rot:t.rot||0}));
  ST.images=[]; clearOverlaySel();
  clearSelection(); snapshot(); render(); updateStatus();
}
export async function openCode(){
  $('code-in').value=''; $('code-copymsg').textContent=''; $('code-loadmsg').textContent='';
  $('code-out').value='Building code…';
  $('code-modal').hidden=false;
  $('code-out').value=await encodeBuild();
}
export function closeCode(){ $('code-modal').hidden=true; }
$('btn-code').onclick=openCode;
$('code-close').onclick=closeCode;
$('code-bg').onclick=closeCode;
export function buildLink(code){ return location.origin + location.pathname + '#' + code; }
export async function copyText(text, label){
  const msg=$('code-copymsg'); msg.className='code-msg';
  try{ await navigator.clipboard.writeText(text); }
  catch(e){ const ta=$('code-out'); const keep=ta.value; ta.value=text; ta.select();
    try{ document.execCommand('copy'); }catch(_){}; ta.value=keep; }
  msg.textContent=label; setTimeout(()=>{ if(msg.textContent===label) msg.textContent=''; }, 1800);
}
$('code-copy').onclick=()=>copyText($('code-out').value, 'Code copied!');
$('code-copylink').onclick=()=>copyText(buildLink($('code-out').value), 'Link copied!');
$('code-load').onclick=async ()=>{
  const msg=$('code-loadmsg'); msg.className='code-msg';
  try{ const o=await decodeBuild($('code-in').value); loadBuild(o); msg.textContent='Build loaded.';
    setTimeout(closeCode, 700); }
  catch(e){ msg.className='code-msg bad'; msg.textContent='Not a valid build code.'; }
};

// zoom buttons
export function zoomBy(f){ const cx=stage.clientWidth/2, cy=stage.clientHeight/2;
  const before=screenToWorld(cx,cy); ST.view.scale=Math.min(6,Math.max(0.15,ST.view.scale*f));
  const after=screenToWorld(cx,cy); ST.view.ox+=(after.x-before.x)*ST.view.scale; ST.view.oy+=(after.y-before.y)*ST.view.scale;
  render(); updateStatus(); persist(); }
$('zoom-in').onclick=()=>zoomBy(1.2);
$('zoom-out').onclick=()=>zoomBy(1/1.2);
$('zoom-fit').onclick=()=>{ ST.view={ox:stage.clientWidth/2, oy:stage.clientHeight/2, scale:1}; render(); updateStatus(); persist(); };

// snap toggle
export function toggleSnap(){ ST.snapOn=!ST.snapOn; $('btn-snap').classList.toggle('on',ST.snapOn); render(); updateStatus(); }
$('btn-snap').onclick=toggleSnap;

// ---------------- layers (experimental build-up)
export function flashToast(msg){ const t=$('toast'); t.textContent=msg; t.hidden=false;
  clearTimeout(ST.toastTimer); ST.toastTimer=setTimeout(()=>{ t.hidden=true; }, 1600); }
export function flashLayerMsg(){ flashToast('Floor '+ST.curLayer+' needs a wall or bunker below'); }
export function setLayer(n){ ST.curLayer=Math.max(0,n); $('layer-val').textContent = ST.curLayer===0?'G':ST.curLayer;
  // pieces on now-hidden floors can't stay selected
  ST.selected=ST.selected.filter(id=>{ const p=ST.pieces.find(x=>x.id===id); return p && pieceLayer(p)<=ST.curLayer; });
  render(); updateStatus(); }
$('layer-up').onclick=()=>setLayer(ST.curLayer+1);
$('layer-down').onclick=()=>setLayer(ST.curLayer-1);
