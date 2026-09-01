// Bundles the ES modules back into the single self-contained index.html the
// project has always shipped: one file, no imports, opens straight off disk.
// The modules in js/ are the source of truth - dist/index.html is generated.
//   node build.js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const JSDIR = path.join(ROOT, 'js');
const OUT = path.join(ROOT, 'dist');

// follow the import graph from main.js so modules land in evaluation order
function order(entry) {
  const seen = new Set(), out = [];
  (function visit(name) {
    if (seen.has(name)) return;
    seen.add(name);
    const src = fs.readFileSync(path.join(JSDIR, name), 'utf8');
    for (const m of src.matchAll(/^\s*import\s+(?:[^'"]*from\s*)?['"]\.\/([\w.-]+)['"]/gm))
      visit(m[1]);
    out.push(name);
  })(entry);
  return out;
}

// in one shared scope the imports are redundant and the exports are just decls
function strip(src) {
  return src
    .replace(/^\s*import\s+[^;]*?;[ \t]*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// In the bundle every module shares one scope, so two modules declaring the same
// top-level name silently collapse into one - the last declaration wins and the
// other module's callers quietly get the wrong function. Modules never notice,
// which is exactly why this has to be checked here.
function collisions(files) {
  const seen = new Map(), dups = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(JSDIR, f), 'utf8');
    for (const line of src.split('\n')) {
      if (!line || /^\s/.test(line)) continue;
      const m = line.match(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/);
      if (!m) continue;
      const prev = seen.get(m[1]);
      if (prev && prev !== f) dups.push(m[1] + ': ' + prev + ' and ' + f);
      else seen.set(m[1], f);
    }
  }
  return dups;
}

const files = order('main.js');
const clash = collisions(files);
if (clash.length) {
  console.error('name collisions would break the bundle:\n  ' + clash.join('\n  '));
  process.exit(1);
}
const bundle = files
  .map(f => '/* ===== ' + f + ' ===== */\n' + strip(fs.readFileSync(path.join(JSDIR, f), 'utf8')))
  .join('\n\n');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tag = '<script type="module" src="js/main.js"></script>';
if (!html.includes(tag)) { console.error('index.html: module script tag not found'); process.exit(1); }

// the bundle runs as one classic script, so it needs its own scope + strict mode
const inline = '<script>\n(function(){\n"use strict";\n' + bundle + '\n})();\n</script>';
fs.mkdirSync(OUT, { recursive: true });
// A function replacer, not a string: `$&`, `$1` and friends are substitution
// patterns to String.replace, and the bundled code legitimately contains them.
fs.writeFileSync(path.join(OUT, 'index.html'), html.replace(tag, () => inline));

console.log('bundled ' + files.length + ' modules -> dist/index.html (' +
  Math.round(fs.statSync(path.join(OUT, 'index.html')).size / 1024) + ' KB)');
console.log('order: ' + files.join(' '));
