// Every piece of mutable app state lives on one object. Modules import ST and
// read/write through it, so a reassignment made in one module is seen by all of
// them - which plain ES module bindings cannot do (imports are read-only).
import { DRAW_COLORS } from './catalog.js';

export const ST = {
  userPickedTool: false,
  view: {ox:0, oy:0, scale:1},
  pieces: [],                               // {id,type,x,y,rot}
  strokes: [],                              // {pts:[{x,y}], color, width}
  tool: 'select',
  selected: [],                             // array of selected piece ids
  marquee: null,                            // {x0,y0,x1,y1} world coords, during rubber-band select
  placeRot: 0,
  placeFlip: false,
  snapOn: true,
  buildHold: false,                         // phone: stay in the fullscreen build view with no ghost armed
  uid: 1,
  curLayer: 0,                              // active build floor for placement (experimental)
  hover: {x:0,y:0},
  drawColor: DRAW_COLORS[0],
  drawWidth: 3,
  stamps: [],                               // reusable stamps: {sid,name,parts:[{type,dx,dy,rot}],fav,ts}
  activeStamp: null,                        // stamp currently in ghost-placement mode (parts[0] = snap anchor)
  stampUid: 1,
  images: [],                               // uploaded overlays: {id,x,y,w,h,src,_img}  (center x,y)
  texts: [],                                // labels: {id,x,y,text,size,color}          (center x,y)
  selImages: [],                            // multi-select of overlays (ids / stroke refs)
  selTexts: [],
  selStrokes: [],
  stages: [],                               // {id,name,color,visible}
  builders: [],
  stageUid: 1,
  builderUid: 1,
  curStageId: undefined,                    // tags stamped onto newly placed pieces (undefined = never chosen)
  curBuilderId: undefined,
  hlBuilder: undefined,                     // builder in focus (undefined = General, every hand)
  layers: [],                               // {id,name,visible,opacity,locked}
  curLayerId: 0,                            // primary active layer new items land on
  selLayers: [],                            // active layer set (panel multi-select); canvas Select only touches these
  layerUid: 1,
  groupUid: 1,                              // shared id binding items into a movable Group
  higherFloorOnTop: true,                   // draw/stack order across floors (switchable)
  history: [],
  hidx: -1,
  oc: null,                                 // offscreen buffer for compositing semi-transparent layers
  octx: null,
  drag: null,
  spaceDown: false,
  trackpad: false,
  pinch: null,
  panRAF: 0,
  panLast: 0,
  lastNavTool: 'select',                    // what placement flows return to
  dragCtx: null,
  clearArm: false,
  clearTimer: null,
  toastTimer: null,
  dragLayerId: null,
  expCfg: {name:'', sheets:{}, stagesCum:false, fillBuilder:true, ghost:true, grid:true,
           notes:true, header:true, ruler:true, legend:true, zip:true, ppb:80, format:'png'},
  _meas: null,
  expLegRows: 0,                            // legend depth reserved for the whole batch (see runExport)
};
