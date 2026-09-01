// Minimal PDF writer, just enough to be a real document: a catalog, a page
// tree, one page per schematic sheet and an xref table. Each sheet goes in
// losslessly as a Flate-compressed RGB image, because these are line drawings
// and JPEG ringing shows on every wall - JPEG is only the fallback for browsers
// without CompressionStream.
const A4=[595.28, 841.89], MARGIN=26, FOOT=20;

function enc(str){
  const a=new Uint8Array(str.length);
  for(let i=0;i<str.length;i++) a[i]=str.charCodeAt(i)&0xff;
  return a;
}
function pdfStr(s){ return '('+String(s).replace(/[\\()]/g,'\\$&')+')'; }
function rgbBytes(cv){
  const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  const out=new Uint8Array(cv.width*cv.height*3);
  for(let i=0,j=0;i<d.length;i+=4){ out[j++]=d[i]; out[j++]=d[i+1]; out[j++]=d[i+2]; }
  return out;
}
async function deflate(bytes){
  if(typeof CompressionStream!=='function') return null;
  try{
    const cs=new CompressionStream('deflate');
    const buf=await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  }catch(e){ return null; }
}
function jpegBytes(cv){
  const b64=cv.toDataURL('image/jpeg',0.94).split(',')[1];
  const bin=atob(b64), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
// one sheet -> the image stream the page will draw
async function sheetImage(cv){
  const flat=await deflate(rgbBytes(cv));
  return flat ? {data:flat, filter:'/FlateDecode'} : {data:jpegBytes(cv), filter:'/DCTDecode'};
}
// the page follows the sheet: a tall sheet gets a portrait page, a wide one
// landscape, and the drawing is centred with room for a footer line
function pageBox(cv){
  const portrait = cv.height >= cv.width;
  const W = portrait?A4[0]:A4[1], H = portrait?A4[1]:A4[0];
  const availW = W-MARGIN*2, availH = H-MARGIN*2-FOOT;
  const s = Math.min(availW/cv.width, availH/cv.height);
  const w = cv.width*s, h = cv.height*s;
  return {W, H, w, h, x:(W-w)/2, y:MARGIN+FOOT+(availH-h)/2};
}
// PDF colours are 0..1 triples; the app hands over the theme it is drawing in
function pdfRgb(c){ return (c||[0,0,0]).map(v=>(v/255).toFixed(3)).join(' '); }
export async function buildPdf(sheets, name, theme){
  const paper = pdfRgb((theme&&theme.bg)||[255,255,255]);
  const rule  = pdfRgb((theme&&theme.line)||[128,128,128]);
  const type  = pdfRgb((theme&&theme.muted)||[110,110,110]);
  const chunks=[], offsets=[]; let len=0;
  const put=u8=>{ chunks.push(u8); len+=u8.length; };
  const putStr=s=>put(enc(s));
  const obj=(n, body, stream)=>{
    offsets[n]=len;
    putStr(n+' 0 obj\n'+body+'\n');
    if(stream){ putStr('stream\n'); put(stream); putStr('\nendstream\n'); }
    putStr('endobj\n');
  };
  const imgs=[];
  for(const s of sheets) imgs.push(await sheetImage(s.canvas));

  // 1 catalog, 2 pages, 3 font, then three objects per sheet
  const first=4, total=3+sheets.length*3;
  const pageIds=sheets.map((_,i)=>first+i*3);
  putStr('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+sheets.length+' >>');
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  sheets.forEach((s,i)=>{
    const pid=first+i*3, iid=pid+1, cid=pid+2;
    const cv=s.canvas, box=pageBox(cv), im=imgs[i];
    obj(pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+box.W.toFixed(2)+' '+box.H.toFixed(2)+']'
      +' /Resources << /XObject << /Im0 '+iid+' 0 R >> /Font << /F1 3 0 R >> >>'
      +' /Contents '+cid+' 0 R >>');
    obj(iid, '<< /Type /XObject /Subtype /Image /Width '+cv.width+' /Height '+cv.height
      +' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter '+im.filter
      +' /Length '+im.data.length+' >>', im.data);
    const foot=(name?name+'  ·  ':'')+s.title+'  ·  '+(i+1)+' / '+sheets.length;
    // The page is the board's own paper, not white: the sheet sits on the ground
    // it was drawn on, inside a hairline frame, with a rule above the footer -
    // a blueprint rather than a screenshot pasted onto a white page.
    const fx=box.x-6, fy=box.y-6, fw=box.w+12, fh=box.h+12;
    const content=enc(
      paper+' rg 0 0 '+box.W.toFixed(2)+' '+box.H.toFixed(2)+' re f\n'
      +'q\n'+box.w.toFixed(2)+' 0 0 '+box.h.toFixed(2)+' '
      +box.x.toFixed(2)+' '+box.y.toFixed(2)+' cm\n/Im0 Do\nQ\n'
      +rule+' RG 0.7 w '+fx.toFixed(2)+' '+fy.toFixed(2)+' '+fw.toFixed(2)+' '+fh.toFixed(2)+' re S\n'
      +rule+' RG 0.5 w '+MARGIN.toFixed(2)+' '+(MARGIN+FOOT-4).toFixed(2)+' m '
      +(box.W-MARGIN).toFixed(2)+' '+(MARGIN+FOOT-4).toFixed(2)+' l S\n'
      +'BT /F1 8 Tf '+type+' rg '+MARGIN.toFixed(2)+' '+(MARGIN+4).toFixed(2)+' Td '
      +pdfStr(foot)+' Tj ET\n');
    obj(cid, '<< /Length '+content.length+' >>', content);
  });

  const xref=len;
  let tbl='xref\n0 '+(total+1)+'\n0000000000 65535 f \n';
  for(let n=1;n<=total;n++) tbl+=String(offsets[n]||0).padStart(10,'0')+' 00000 n \n';
  putStr(tbl);
  putStr('trailer\n<< /Size '+(total+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks, {type:'application/pdf'});
}
