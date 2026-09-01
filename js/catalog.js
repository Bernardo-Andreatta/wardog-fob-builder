// Names follow the game's own, shortened where the full one would not fit a
// tile. `cost` is the piece's build supply price; the four logistics markers and
// the spawn vehicle have none, because the game does not charge supplies for
// them - a vehicle is bought with cash, and the rest are places, not structures.
export const CATALOG = {
  wall:     {name:'Bremmer Wall', w:1, h:1,   cost:13},
  shortwall:{name:'Hesco Block',  w:1, h:1,   cost:13},
  quadra:   {name:'Hesco Wall',   w:4, h:1,   cost:61},
  bunker:   {name:'Bunker',       w:4, h:4,   cost:81},
  door:     {name:'Door',         w:1, h:1,   cost:19},
  barbed:   {name:'Barbed Wire',  w:2, h:1,   cost:7},
  gate:     {name:'Gate',         w:4, h:1,   cost:69},
  sandbags: {name:'Sandbag Wall', w:2, h:0.5, cost:13},
  tower:    {name:'Recon Tower',  w:4, h:4,   cost:81},
  mortar:   {name:'L81 Mortar',   w:2, h:2,   cost:121},
  drill:    {name:'Drill Rig',    w:2, h:2,   cost:1801},
  aa:       {name:'AA Gun',       w:2, h:2,   cost:1201},
  sam:      {name:'Talon SAM',    w:2, h:2,   cost:801},
  spawn:    {name:'M113 APC',     w:2, h:3},
  hedgehog: {name:'Hedgehog',     w:1, h:1,   cost:19},
  fob:      {name:'FOB',          w:2, h:2,   cost:30},
  helipad:  {name:'Helipad',      w:2, h:2},
  supply:   {name:'Supply Area',  w:2, h:2},
  parking:  {name:'Parking',      w:2, h:2},
  codetower:{name:'Code Tower',   w:10, h:10},
};
export function supplyOf(p){ const c=CATALOG[p.type]; return (c && c.cost) || 0; }
export function supplySum(list){ return list.reduce((n,p)=>n+supplyOf(p), 0); }
// "3 pieces . 47 supplies" - the pair every readout and sheet quotes. The bar on
// a phone shares its line with the stage name, and the spelt-out word ate enough
// of it to truncate the name, so there it takes the short form the builder rows
// already use.
export function tallyText(list, short){
  const n=list.length, s=supplySum(list);
  return n+(n===1?' piece':' pieces')+' \u00b7 '+s+(short?'s':' supplies');
}
export const PIECE_ORDER = ['wall','shortwall','quadra','bunker','door','barbed','gate','sandbags','hedgehog','tower','mortar','drill','aa','sam','spawn','fob'];
export const LOGI_ORDER = ['helipad','supply','parking','codetower'];
export const DRAW_COLORS = ['#e6a51e','#e0574a','#7ec46a','#4aa3e0','#e9ead9','#1a1a14'];
// simple annotation symbols: placed as strokes (point outlines), so they move /
// rotate / mirror / erase / serialize exactly like free drawings
export const SYMBOLS = {
  'sym-rect': (cx,cy,r)=>[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]].map(([a,b])=>({x:cx+a*r, y:cy+b*r})),
  'sym-tri':  (cx,cy,r)=>[[0,-1],[1,1],[-1,1],[0,-1]].map(([a,b])=>({x:cx+a*r, y:cy+b*r})),
  'sym-circle': (cx,cy,r)=>{ const pts=[];
    for(let k=0;k<=40;k++){ const a=k/40*2*Math.PI; pts.push({x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r}); }
    return pts; },
};
