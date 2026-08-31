import { CATALOG } from './catalog.js';
import { GRID } from './dom.js';
import { cssVar } from './render.js';

// ================= structure drawers (all take a context g) =================
export function drawSingleWall(g,W,H){
  const i=Math.min(W,H)*0.16;
  g.beginPath(); g.rect(-W/2,-H/2,W,H); g.stroke();
  g.beginPath(); g.rect(-W/2+i,-H/2+i,W-2*i,H-2*i); g.stroke();
}
export function drawQuadra(g,W,H){
  // four single-wall tiles in a row
  const cell=W/4;
  for(let k=0;k<4;k++){
    g.save(); g.translate(-W/2+cell/2+cell*k,0);
    drawSingleWall(g,cell,H);
    g.restore();
  }
}
// the "bottom" edge wall between two corner tiles: a thin double line spanning
// x in [-span,span] with a centered opening. Interior is toward -y so the
// door/stair are drawn inward, staying inside the footprint.
export function fortEdge(g,S,t,span,gh,type){
  g.beginPath();
  g.moveTo(-span,S); g.lineTo(-gh,S); g.moveTo(gh,S); g.lineTo(span,S);           // outer, broken
  g.moveTo(-span,S-t); g.lineTo(-gh,S-t); g.moveTo(gh,S-t); g.lineTo(span,S-t);   // inner, broken
  g.moveTo(-gh,S); g.lineTo(-gh,S-t); g.moveTo(gh,S); g.lineTo(gh,S-t);           // jambs
  g.stroke();
  if(type==='window'){
    g.beginPath(); g.moveTo(-gh,S-t/2); g.lineTo(gh,S-t/2); g.stroke();   // glass pane
  } else if(type==='door'){
    const leaf=2*gh, hx=-gh, hy=S-t/2;
    g.beginPath(); g.moveTo(hx,hy); g.lineTo(hx,hy-leaf); g.stroke();     // leaf, swung in
    g.beginPath(); g.arc(hx,hy,leaf,-Math.PI/2,0,false); g.stroke();      // swing arc
  } else if(type==='stair'){
    const steps=5, depth=S*0.42, x0=-gh, x1=gh;
    g.beginPath();
    for(let k=0;k<=steps;k++){ const y=(S-t)-depth*k/steps; g.moveTo(x0,y); g.lineTo(x1,y); }
    g.moveTo(x0,S-t); g.lineTo(x0,S-t-depth); g.moveTo(x1,S-t); g.lineTo(x1,S-t-depth);
    g.stroke();
  }
}
// hollow fort: four 1x1 wall tiles at the corners, thin walls between them, a
// 2x2 open interior (4 spaces), windows on 3 sides, entrance on the 4th.
export function drawFort(g,W,H,entrance){
  const S=W/2, cell=GRID, t=GRID*0.16, cc=S-cell/2, span=S-cell;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{            // corner tiles
    g.save(); g.translate(sx*cc,sy*cc); drawSingleWall(g,cell,cell); g.restore();
  });
  const types=[entrance,'window','window','window'];
  const gh=cell*0.5;
  for(let s=0;s<4;s++){ g.save(); g.rotate(s*Math.PI/2); fortEdge(g,S,t,span,gh,types[s]); g.restore(); }
}
export function drawBunker(g,W,H){ drawFort(g,W,H,'door'); }
export function drawDoor(g,W,H){
  const open=W*0.62, jamb=(W-open)/2, th=H*0.5;
  g.save(); g.fillStyle=g.strokeStyle;
  g.fillRect(-W/2,-th/2,jamb,th);
  g.fillRect(W/2-jamb,-th/2,jamb,th);
  g.restore();
  const hx=-W/2+jamb, hy=0;
  g.beginPath(); g.moveTo(hx,hy); g.lineTo(hx,hy+open); g.stroke();
  g.beginPath(); g.arc(hx,hy,open,Math.PI/2,0,true); g.stroke();
}
// concertina / spiral razor wire: a run of interlinked coils with short barbs
export function drawBarbed(g,W,H){
  const r=H*0.34, overlap=1.30;
  const n=Math.max(4, Math.round((W-2*r)/(r*overlap))+1);
  const step=(W-2*r)/(n-1);
  for(let k=0;k<n;k++){
    const cx=-W/2+r+step*k;
    g.beginPath(); g.arc(cx,0,r,0,Math.PI*2); g.stroke();
    const bs=r*0.55;
    for(let a=0;a<4;a++){ const ang=Math.PI/4+a*Math.PI/2;
      g.beginPath();
      g.moveTo(cx+Math.cos(ang)*r*0.7, Math.sin(ang)*r*0.7);
      g.lineTo(cx+Math.cos(ang)*(r+bs), Math.sin(ang)*(r+bs));
      g.stroke();
    }
  }
}
export function drawGate(g,W,H){
  // a double-swing vehicle gate set into a wall line
  const th=H*0.5, stub=W*0.16;
  g.save(); g.fillStyle=g.strokeStyle;
  g.fillRect(-W/2,-th/2,stub,th);          // left wall stub
  g.fillRect(W/2-stub,-th/2,stub,th);      // right wall stub
  g.restore();
  const lh=-W/2+stub, rh=W/2-stub;         // hinge x positions
  g.beginPath(); g.moveTo(lh,0); g.lineTo(rh,0); g.stroke();   // bar connecting the two square posts (kept)
  // two swing arcs (round pieces), one hinged on each post, NOT joined in the middle
  const leaf=(rh-lh)/2*0.9;
  g.beginPath(); g.arc(lh,0,leaf,0,Math.PI*0.5); g.stroke();          // left door swing
  g.beginPath(); g.arc(rh,0,leaf,Math.PI*0.5,Math.PI); g.stroke();    // right door swing
}
// top-down sandbags: a single row of round bags spanning the full length
export function drawSandbags(g,W,H){
  const n=Math.max(2,Math.round(W/H));   // ~one bag per row-height of length
  const r=W/(2*n);                       // sized to fill edge-to-edge (bags touch)
  for(let k=0;k<n;k++){
    const x=-W/2+r+2*r*k;
    g.beginPath(); g.arc(x,0,r,0,Math.PI*2); g.stroke();
  }
}
export function drawTower(g,W,H){
  drawFort(g,W,H,'stair');
  // "feel high": raised inner platform + diagonals from the corner tiles inward,
  // so it reads as looking down a tall tower
  const S=W/2, ci=S-GRID, P=S-GRID*1.35;   // ci = inner corner of the corner tiles
  g.beginPath();
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{ g.moveTo(sx*ci,sy*ci); g.lineTo(sx*P,sy*P); });
  g.stroke();
  g.beginPath(); g.rect(-P,-P,2*P,2*P); g.stroke();
}
export function roundRect(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath();
}
// a plain 2x2 pallet base (border only), drawn under emplaced weapons
export function drawPallet(g,W,H){
  const ps=Math.min(W,H)/2*0.9;
  g.beginPath(); g.rect(-ps,-ps,2*ps,2*ps); g.stroke();
}
// mortar pit: pallet base, ring of sandbags, mortar tube + bipod in the middle
export function drawMortar(g,W,H){
  const R=Math.min(W,H)/2;
  drawPallet(g,W,H);
  const rr=R*0.72, sb=R*0.15, n=10;                // sandbag ring
  for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; g.beginPath(); g.arc(Math.cos(a)*rr,Math.sin(a)*rr,sb,0,Math.PI*2); g.stroke(); }
  g.beginPath(); g.arc(0,0,R*0.14,0,Math.PI*2); g.stroke();        // baseplate
  g.beginPath(); g.moveTo(0,0); g.lineTo(0,-R*0.5); g.stroke();    // barrel
  g.beginPath(); g.arc(0,-R*0.5,R*0.07,0,Math.PI*2); g.stroke();   // muzzle
  g.beginPath(); g.moveTo(0,-R*0.28); g.lineTo(-R*0.18,-R*0.02);   // bipod legs
  g.moveTo(0,-R*0.28); g.lineTo(R*0.18,-R*0.02); g.stroke();
}
// drill / derrick tower, top-down: leg posts, outer frame, corner bracing, and a
// drill-bit icon in the throat
export function drawDrill(g,W,H){
  const S=Math.min(W,H)/2*0.9, lp=S*0.14;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>{ g.beginPath(); g.rect(x*S-lp,y*S-lp,2*lp,2*lp); g.stroke(); });
  g.beginPath(); g.rect(-S,-S,2*S,2*S); g.stroke();
  const rc=S*0.5;                                          // corner braces, stop short of center
  g.beginPath(); [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,y])=>{ g.moveTo(x*S,y*S); g.lineTo(x*rc,y*rc); }); g.stroke();
  g.beginPath(); g.arc(0,0,S*0.4,0,Math.PI*2); g.stroke(); // mount ring
  // drill bit, pointing down
  const b=S*0.14;
  g.beginPath(); g.rect(-b*1.5,-S*0.34,b*3,S*0.16); g.stroke();          // motor body
  const sy0=-S*0.18, sy1=S*0.16;
  g.beginPath(); g.moveTo(-b,sy0); g.lineTo(-b,sy1); g.moveTo(b,sy0); g.lineTo(b,sy1); g.stroke();  // shaft sides
  g.beginPath();
  for(let k=0;k<3;k++){ const y=sy0+(sy1-sy0)*(k+0.35)/3; g.moveTo(-b,y-b*0.6); g.lineTo(b,y); g.lineTo(-b,y+b*0.6); }
  g.stroke();                                                            // helical flutes
  g.beginPath(); g.moveTo(-b,sy1); g.lineTo(0,S*0.36); g.lineTo(b,sy1); g.stroke();                 // tip
}
// CIWS (Phalanx-style) AA gun: circular mount, radome dome, gatling barrels up
export function drawAA(g,W,H){
  drawPallet(g,W,H);
  const R=Math.min(W,H)/2*0.9;
  g.beginPath(); g.arc(0,0,R,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(0,0,R*0.62,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(0,R*0.2,R*0.4,0,Math.PI*2); g.stroke();     // radome, aft
  const by=-R*0.18, bl=R*0.8;
  g.beginPath(); g.arc(0,by,R*0.16,0,Math.PI*2); g.stroke();       // barrel housing
  for(let k=-1;k<=1;k++){ const x=k*R*0.08; g.beginPath(); g.moveTo(x,by); g.lineTo(x,by-bl); g.stroke(); }
}
// single-rail rocket launcher with a small operator console + seat
export function drawSAM(g,W,H){
  const R=Math.min(W,H)/2, cx=-R*0.15;
  drawPallet(g,W,H);
  roundRect(g,-R*0.9,-R*0.6,R*1.8,R*1.5,R*0.14); g.stroke();          // chassis
  g.beginPath(); g.rect(cx-R*0.26,-R*0.5,R*0.52,R*0.95); g.stroke();  // launch rail
  const mw=R*0.22, bodyTop=-R*0.42, bodyBot=R*0.4, noseY=-R*0.88;     // single rocket
  g.beginPath(); g.rect(cx-mw/2,bodyTop,mw,bodyBot-bodyTop); g.stroke();
  g.beginPath(); g.moveTo(cx-mw/2,bodyTop); g.lineTo(cx,noseY); g.lineTo(cx+mw/2,bodyTop); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(cx-mw/2,bodyBot-R*0.12); g.lineTo(cx-mw*0.95,bodyBot);
  g.moveTo(cx+mw/2,bodyBot-R*0.12); g.lineTo(cx+mw*0.95,bodyBot); g.stroke();   // tail fins
  const ox=R*0.55;                                                   // operator station
  g.beginPath(); g.rect(ox-R*0.28,-R*0.55,R*0.5,R*0.34); g.stroke();          // console
  g.beginPath(); g.moveTo(ox-R*0.28,-R*0.38); g.lineTo(ox+R*0.22,-R*0.38); g.stroke(); // screen line
  g.beginPath(); g.arc(ox-R*0.03,R*0.08,R*0.19,0,Math.PI*2); g.stroke();      // seat
  g.beginPath(); g.arc(ox-R*0.03,R*0.08,R*0.09,0,Math.PI*2); g.stroke();      // operator
}
// vehicle spawn marker: a solid placard filling the footprint, with a knocked-out
// deploy-beacon glyph tilted 45deg -> reads like the red sign with a white icon
export function drawSpawnVeh(g,W,H){
  const bg=cssVar('--canvas-bg');
  g.save(); g.fillStyle=g.strokeStyle;
  const rw=W*0.9, rh=H*0.92;
  roundRect(g,-rw/2,-rh/2,rw,rh,Math.min(rw,rh)*0.16); g.fill();   // solid placard rectangle
  // beacon glyph, knocked out, rotated 45deg
  g.rotate(Math.PI/4); g.fillStyle=bg;
  const s=Math.min(W,H)*0.52;
  g.beginPath(); g.arc(0,-s*0.16,s*0.5,Math.PI,2*Math.PI); g.closePath(); g.fill();  // dome cap
  g.fillRect(-s*0.5,-s*0.18,s,s*0.1);                  // cap underside
  g.fillRect(-s*0.06,-s*0.12,s*0.12,s*0.34);           // antenna / stalk (thinner + shorter)
  g.fillRect(-s*0.28,s*0.22,s*0.56,s*0.11);            // base
  g.restore();
}
// parking zone: corner brackets + a bold, centered P
export function drawParking(g,W,H){
  const S=Math.min(W,H)/2;
  zoneCorners(g,S);
  const top=-S*0.36, bot=S*0.36, bowlBot=S*0.08; // loop runs a bit below centre
  const r=(bowlBot-top)/2;                        // bigger, rounder loop
  const x=-r/2;                                   // centre the P on its bounding box
  g.beginPath();
  g.moveTo(x,bot); g.lineTo(x,top);               // stem
  g.arc(x, top+r, r, -Math.PI/2, Math.PI/2, false);   // loop (right side)
  g.lineTo(x,bowlBot);                            // close loop back onto the stem
  g.stroke();
}
// FOB: a square perimeter with a chess-rook tower silhouette
export function drawFOB(g,W,H){
  const S=Math.min(W,H)/2;
  g.beginPath(); g.rect(-S*0.94,-S*0.94,S*1.88,S*1.88); g.stroke();               // FOB square
  const shaftW=S*0.5;
  g.beginPath(); g.rect(-shaftW/2,-S*0.22,shaftW,S*0.62); g.stroke();             // shaft
  g.beginPath(); g.rect(-S*0.4,S*0.4,S*0.8,S*0.22); g.stroke();                   // base
  const topW=S*0.74, bandY=-S*0.56, bandH=S*0.2;
  g.beginPath(); g.rect(-topW/2,bandY,topW,bandH); g.stroke();                    // battlement band
  const mW=topW/5;
  [-1,0,1].forEach(i=>{ g.beginPath(); g.rect(i*(topW/3)-mW/2,bandY-bandH*0.7,mW,bandH*0.7); g.stroke(); }); // merlons
}
// corner-bracket helper for zone markers (organizational, no in-game object)
export function zoneCorners(g,S){
  const c=S*0.9, len=S*0.42;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{
    g.beginPath();
    g.moveTo(sx*c, sy*c - sy*len); g.lineTo(sx*c, sy*c); g.lineTo(sx*c - sx*len, sy*c);
    g.stroke();
  });
}
// helipad zone: corner brackets + a centered H
export function drawHelipad(g,W,H){
  const S=Math.min(W,H)/2;
  zoneCorners(g,S);
  const hw=S*0.26, hh=S*0.42;
  g.beginPath();
  g.moveTo(-hw,-hh); g.lineTo(-hw,hh);
  g.moveTo(hw,-hh); g.lineTo(hw,hh);
  g.moveTo(-hw,0); g.lineTo(hw,0);
  g.stroke();
}
// supply zone: corner brackets + two crates
export function drawSupply(g,W,H){
  const S=Math.min(W,H)/2;
  zoneCorners(g,S);
  const cs=S*0.44;
  [-1,1].forEach(sx=>{ const cx=sx*cs*0.62;
    g.beginPath(); g.rect(cx-cs/2,-cs/2,cs,cs); g.stroke();
    g.beginPath(); g.moveTo(cx-cs/2,-cs/2); g.lineTo(cx+cs/2,cs/2);
    g.moveTo(cx+cs/2,-cs/2); g.lineTo(cx-cs/2,cs/2); g.stroke();
  });
}
// Code Tower: a 10x10 perimeter square with a tiered petrol-rig silhouette
export function drawCodeTower(g,W,H){
  const S=Math.min(W,H)/2;
  g.beginPath(); g.rect(-S*0.97,-S*0.97,S*1.94,S*1.94); g.stroke();   // 10x10 perimeter
  const u=S*0.5;
  // base legs (X-braced trapezoid)
  const bl=-u*0.55, br=u*0.55, by=u*1.0, ty=u*0.35, tl=-u*0.4, tr=u*0.4;
  g.beginPath();
  g.moveTo(bl,by); g.lineTo(tl,ty); g.moveTo(br,by); g.lineTo(tr,ty);
  g.moveTo(bl,by); g.lineTo(tr,ty); g.moveTo(br,by); g.lineTo(tl,ty);
  g.moveTo(tl,ty); g.lineTo(tr,ty);
  g.stroke();
  // lower tier box (with windows)
  g.beginPath(); g.rect(-u*0.45,u*0.02,u*0.9,u*0.33); g.stroke();
  g.beginPath(); g.rect(-u*0.28,u*0.12,u*0.16,u*0.14); g.rect(u*0.12,u*0.12,u*0.16,u*0.14); g.stroke();
  // stilts up to the main deck
  g.beginPath();
  g.moveTo(-u*0.35,u*0.02); g.lineTo(-u*0.35,-u*0.25);
  g.moveTo(u*0.35,u*0.02); g.lineTo(u*0.35,-u*0.25);
  g.moveTo(0,u*0.02); g.lineTo(0,-u*0.25);
  g.stroke();
  // upper main deck (wider, overhangs)
  g.beginPath(); g.rect(-u*0.62,-u*0.62,u*1.24,u*0.37); g.stroke();
  // rooftop units
  g.beginPath(); g.rect(-u*0.42,-u*0.77,u*0.3,u*0.15); g.rect(u*0.06,-u*0.77,u*0.3,u*0.15); g.stroke();
  // smokestack
  g.beginPath(); g.rect(u*0.16,-u*1.06,u*0.13,u*0.31); g.stroke();
}
// Czech hedgehog anti-tank obstacle: three crossed I-beams, a 6-point star
export function drawHedgehog(g,W,H){
  const R=Math.min(W,H)/2*0.86, cl=R*0.18;
  for(let k=0;k<3;k++){
    const a=k*Math.PI/3, dx=Math.cos(a)*R, dy=Math.sin(a)*R;
    const px=Math.cos(a+Math.PI/2), py=Math.sin(a+Math.PI/2);
    g.beginPath(); g.moveTo(-dx,-dy); g.lineTo(dx,dy); g.stroke();          // beam
    g.beginPath();                                                          // angle-iron end caps
    g.moveTo(dx-px*cl,dy-py*cl); g.lineTo(dx+px*cl,dy+py*cl);
    g.moveTo(-dx-px*cl,-dy-py*cl); g.lineTo(-dx+px*cl,-dy+py*cl); g.stroke();
  }
  g.beginPath(); g.arc(0,0,R*0.14,0,Math.PI*2); g.stroke();                 // center gusset
}
export const DRAWERS = {wall:drawSingleWall, quadra:drawQuadra, bunker:drawBunker, door:drawDoor,
  barbed:drawBarbed, gate:drawGate, sandbags:drawSandbags, tower:drawTower,
  mortar:drawMortar, drill:drawDrill, aa:drawAA, sam:drawSAM, spawn:drawSpawnVeh,
  hedgehog:drawHedgehog, fob:drawFOB, helipad:drawHelipad, supply:drawSupply, parking:drawParking,
  codetower:drawCodeTower, shortwall:drawSingleWall};

export function drawPiece(g,p,color,alpha,lw){
  const c=CATALOG[p.type];
  g.save();
  g.translate(p.x,p.y); if(p.flip) g.scale(-1,1); g.rotate(p.rot*Math.PI/180);
  g.globalAlpha = alpha==null?1:alpha;
  g.strokeStyle = color; g.lineWidth = lw||2.4; g.lineJoin='round'; g.lineCap='round';
  DRAWERS[p.type](g, c.w*GRID, c.h*GRID);
  g.restore();
}
