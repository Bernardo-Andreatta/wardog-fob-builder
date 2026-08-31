// Leaf module: the canvas handles and the few constants everything else is
// built on. It imports nothing, so it always finishes evaluating first and no
// import cycle can catch GRID or cv in the temporal dead zone.
export const GRID = 40, SNAP = GRID/2;
export const cv = document.getElementById('board');
export const ctx = cv.getContext('2d');
export const stage = document.getElementById('stage');
export const $ = id => document.getElementById(id);
// touch-first device? gates every mobile-only behavior below (live query:
// convertibles / docking a mouse can flip it after load)
export const COARSE_MQ = matchMedia('(pointer:coarse)');
export const isCoarse = ()=>COARSE_MQ.matches;
