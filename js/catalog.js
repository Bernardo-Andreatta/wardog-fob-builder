export const CATALOG = {
  wall:     {name:'Single Wall',  w:1, h:1},
  shortwall:{name:'Short Wall',   w:1, h:1},
  quadra:   {name:'Quad Wall',    w:4, h:1},
  bunker:   {name:'Bunker',       w:4, h:4},
  door:     {name:'Door',         w:1, h:1},
  barbed:   {name:'Barbed Wire',  w:2, h:1},
  gate:     {name:'Gate',         w:4, h:1},
  sandbags: {name:'Sandbags',     w:2, h:0.5},
  tower:    {name:'Lookout Tower',w:4, h:4},
  mortar:   {name:'Mortar',       w:2, h:2},
  drill:    {name:'Drill',        w:2, h:2},
  aa:       {name:'AA Gun',       w:2, h:2},
  sam:      {name:'SAM',          w:2, h:2},
  spawn:    {name:'Spawn Vehicle',w:2, h:3},
  hedgehog: {name:'Hedgehog',     w:1, h:1},
  fob:      {name:'FOB',          w:2, h:2},
  helipad:  {name:'Helipad',      w:2, h:2},
  supply:   {name:'Supply Area',  w:2, h:2},
  parking:  {name:'Parking',      w:2, h:2},
  codetower:{name:'Code Tower',   w:10, h:10},
};
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
