import { render } from './render.js';
import { ST } from './state.js';

// ---------------- selection helpers
export function isSel(id){ return ST.selected.indexOf(id)!==-1; }
export function selectedPieces(){ return ST.pieces.filter(p=>isSel(p.id)); }
export function clearSelection(){ ST.selected = []; }
export function clearOverlaySel(){ ST.selImages = []; ST.selTexts = []; ST.selStrokes = []; }
export function anySelected(){ return ST.selected.length||ST.selImages.length||ST.selTexts.length||ST.selStrokes.length; }
// anything rotatable/mirrorable selected? (pieces, labels, drawings)
export function hasRotSel(){ return ST.selected.length||ST.selTexts.length||ST.selStrokes.length; }
// strip the runtime-only _img cache before serializing
export function imagesData(){ return ST.images.map(im=>({id:im.id,x:im.x,y:im.y,w:im.w,h:im.h,src:im.src})); }
// rebuild the HTMLImageElement cache after loading images from data
export function hydrateImages(){ ST.images.forEach(im=>{ if(!im._img && im.src){ const i=new Image(); i.onload=render; i.src=im.src; im._img=i; } }); }
