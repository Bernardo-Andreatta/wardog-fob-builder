import { cssVar } from './render.js';

export const STAMP_CAP = 14;       // max non-favorite recents kept
// Base structure/label colour. There is no global ink picker any more: a piece's
// colour says which stage / builder it belongs to (see planColorOf), so this is
// only the neutral theme colour everything falls back to.
export function curInk(){ return cssVar('--piece'); }
