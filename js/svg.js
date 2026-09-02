// Inline SVG markup for the tool tiles. No dependencies of its own, so any
// module can pull an icon in without dragging the rail's wiring along - and
// without forming an import cycle back through it.
export const GRIP_SVG='<svg viewBox="0 0 16 16"><circle cx="5.5" cy="4" r="1.3"/><circle cx="10.5" cy="4" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12" r="1.3"/><circle cx="10.5" cy="12" r="1.3"/></svg>';
export const TOOL_ICONS = {
  draw:'<svg viewBox="0 0 24 24"><path d="M15 4l5 5L9 20l-5 1 1-5z"/><path d="M13 6l5 5"/></svg>',
  erase:'<svg viewBox="0 0 24 24"><path d="M4 15l7-7 6 6-5 5H8z"/><path d="M9 20h11"/><path d="M11 8l6 6"/></svg>',
  eyedrop:'<svg viewBox="0 0 24 24"><path d="M15.5 4.5l4 4M17.6 2.4a2.1 2.1 0 0 1 3 3l-3.1 3.1 1 1-2 2-1-1L8 18.9 4.4 20l1.1-3.6 7.4-7.4-1-1 2-2 1 1z"/></svg>',
  text:'<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  image:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/></svg>',
};
