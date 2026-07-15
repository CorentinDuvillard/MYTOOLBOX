import { useState, useEffect, useRef, useCallback } from "react";

// ─── Chargement dynamique des libs externes ───
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
];

// ─── Utilitaires couleur ───
const hex2rgba = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};
const hex2rgb01 = (hex) => {
  if (!hex || hex[0] !== "#") return [0,0,0];
  return [parseInt(hex.slice(1,3),16)/255, parseInt(hex.slice(3,5),16)/255, parseInt(hex.slice(5,7),16)/255];
};
const color2hex = (c) => {
  if (!c) return "#000000";
  if (c[0] === "#") return c.substring(0,7);
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return "#" + [m[1],m[2],m[3]].map(x => parseInt(x).toString(16).padStart(2,"0")).join("");
  return "#000000";
};
const parseRGBA = (c) => {
  if (c?.startsWith("rgba")) {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
    if (m) return { r: +m[1]/255, g: +m[2]/255, b: +m[3]/255, a: m[4] ? +m[4] : 1 };
  }
  if (c?.[0] === "#") { const v = hex2rgb01(c); return { r:v[0], g:v[1], b:v[2], a:1 }; }
  return { r:0, g:0, b:0, a:1 };
};

// ─── Icônes SVG inline ───
const I = {
  cursor: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>,
  text: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9.5" y1="20" x2="14.5" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  rect: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  ellipse: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="10" ry="8"/></svg>,
  line: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>,
  arrow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="12 5 19 5 19 12"/></svg>,
  pencil: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>,
  eraser: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7L3 16c-.4-.4-.4-1 0-1.4l9.6-9.6a2 2 0 012.8 0L20 9.6a2 2 0 010 2.8L11.4 21"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  merge: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="8" height="8" rx="1"/><rect x="14" y="13" width="8" height="8" rx="1"/><path d="M10 7h4v4"/><path d="M14 17h-4v-4"/></svg>,
  zoomIn: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  zoomOut: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  fit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/></svg>,
  layerUp: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="14" height="14" rx="1"/><rect x="2" y="8" width="14" height="14" rx="1" opacity=".4"/></svg>,
  layerDown: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="8" width="14" height="14" rx="1"/><rect x="8" y="2" width="14" height="14" rx="1" opacity=".4"/></svg>,
  close: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  chevL: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"/></svg>,
  file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

// ─── Palette (centralisée via theme.css — modifiable en un seul endroit) ───
const C = {
  bg:"var(--bg)", surface:"var(--surface)", surface2:"var(--surface-2)", surface3:"var(--surface-3)",
  line:"var(--line)", text:"var(--text)", muted:"var(--muted)", faint:"var(--faint)",
  accent:"var(--accent)", accentSoft:"var(--accent-soft)", onAccent:"var(--on-accent)",
};

// ─── Styles CSS-in-JS ───
const S = {
  app: { display:"flex", flexDirection:"column", height:"100vh", width:"100vw", background:C.bg, color:C.text, fontFamily:"var(--font)", overflow:"hidden", fontSize:13 },
  topbar: { display:"flex", alignItems:"center", justifyContent:"space-between", height:46, padding:"0 14px", background:C.surface2, borderBottom:"1px solid "+C.line, flexShrink:0, zIndex:50 },
  brand: { display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:15, letterSpacing:"-0.3px" },
  topActions: { display:"flex", gap:6, alignItems:"center" },
  btn: { display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:6, border:"1px solid "+C.line, background:C.surface, color:C.text, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all .12s", whiteSpace:"nowrap", fontFamily:"inherit" },
  btnPrimary: { background:C.accent, borderColor:C.accent, color:C.onAccent, fontWeight:600 },
  body: { display:"flex", flex:1, overflow:"hidden" },
  toolbar: { width:48, flexShrink:0, background:C.surface2, borderRight:"1px solid "+C.line, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 0", gap:2, overflowY:"auto" },
  toolBtn: (active) => ({ width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:6, cursor:"pointer", color: active ? C.accent : C.muted, background: active ? C.accentSoft : "transparent", border:"none", transition:"all .1s", fontFamily:"inherit" }),
  toolSep: { width:24, height:1, background:C.line, margin:"4px 0" },
  canvasArea: { flex:1, display:"flex", flexDirection:"column", background:C.surface2, overflow:"hidden", position:"relative" },
  pageNav: { display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"7px 0", background:C.surface3, borderBottom:"1px solid "+C.line, flexShrink:0 },
  navBtn: (disabled) => ({ width:28, height:26, display:"flex", alignItems:"center", justifyContent:"center", background:C.surface, border:"1px solid "+C.line, borderRadius:5, color: disabled ? C.faint : C.text, cursor: disabled ? "default" : "pointer", opacity: disabled ? .5 : 1 }),
  canvasScroll: { flex:1, overflow:"auto", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:24 },
  canvasWrap: { position:"relative", boxShadow:"0 4px 24px rgba(20,20,20,.16)", background:"#fff" },
  panel: { width:240, flexShrink:0, background:C.surface2, borderLeft:"1px solid "+C.line, overflowY:"auto", fontSize:12 },
  section: { padding:"12px 14px", borderBottom:"1px solid "+C.line },
  sectionTitle: { fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".7px", color:C.faint, marginBottom:8 },
  propRow: { display:"flex", alignItems:"center", gap:6, marginBottom:6 },
  propLabel: { fontSize:11, color:C.muted, minWidth:55 },
  propInput: { flex:1, padding:"4px 7px", background:C.bg, border:"1px solid "+C.line, borderRadius:5, color:C.text, fontFamily:"var(--font-mono)", fontSize:11, outline:"none" },
  welcome: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, textAlign:"center" },
  dropzone: { border:"2px dashed "+C.line, borderRadius:12, padding:"50px 60px", cursor:"pointer", transition:"all .2s", textAlign:"center" },
  statusbar: { height:28, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 14px", background:C.surface2, borderTop:"1px solid "+C.line, fontSize:11, color:C.faint, flexShrink:0 },
  modal: { position:"fixed", inset:0, background:"rgba(20,20,20,.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:500 },
  modalBox: { background:C.surface, border:"1px solid "+C.line, borderRadius:12, width:460, maxHeight:"75vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(20,20,20,.22)" },
  modalHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid "+C.line },
  modalBody: { padding:18, overflowY:"auto", flex:1 },
  modalFoot: { display:"flex", justifyContent:"flex-end", gap:8, padding:"12px 18px", borderTop:"1px solid "+C.line },
  mergeItem: { display:"flex", alignItems:"center", gap:8, padding:"8px 10px", marginBottom:5, background:C.surface, borderRadius:6, border:"1px solid "+C.line },
};

export default function PDFStudio() {
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);

  // Tool state
  const [tool, setToolState] = useState("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState("#e10b0b");
  const [fillOpacity, setFillOpacity] = useState(20);
  const [fontFamily, setFontFamily] = useState("Helvetica");
  const [fontSize, setFontSize] = useState(18);
  const [textColor, setTextColor] = useState("#000000");
  const [objCount, setObjCount] = useState(0);
  const [selObj, setSelObj] = useState(null);

  // Merge
  const [showMerge, setShowMerge] = useState(false);
  const [mergeFiles, setMergeFiles] = useState([]);

  // Loading
  const [loading, setLoading] = useState(false);

  // Refs
  const fabricRef = useRef(null);
  const canvasElRef = useRef(null);
  const scrollRef = useRef(null);
  const pageBgRef = useRef({});
  const pageDimRef = useRef({});
  const pageObjRef = useRef({});
  const drawRef = useRef({ drawing: false, start: null, shape: null });
  const currentPageRef = useRef(1);
  const zoomRef = useRef(1);
  const fileInputRef = useRef(null);
  const mergeInputRef = useRef(null);
  const pdfBytesRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ─── Load external libs ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const src of SCRIPTS) await loadScript(src);
        if (!cancelled) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setLoadErr("Impossible de charger les dépendances. Vérifiez votre connexion.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Init / resize Fabric canvas ───
  const initCanvas = useCallback((w, h) => {
    if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    if (!canvasElRef.current) return;

    const fc = new window.fabric.Canvas(canvasElRef.current, {
      width: w, height: h, backgroundColor: "#ffffff",
      selection: true, preserveObjectStacking: true,
    });
    fabricRef.current = fc;

    fc.on("mouse:down", onMouseDown);
    fc.on("mouse:move", onMouseMove);
    fc.on("mouse:up", onMouseUp);
    fc.on("selection:created", onSel);
    fc.on("selection:updated", onSel);
    fc.on("selection:cleared", () => setSelObj(null));
    fc.on("object:added", updateCount);
    fc.on("object:removed", updateCount);

    return fc;
  }, []);

  const updateCount = useCallback(() => {
    if (!fabricRef.current) return;
    setObjCount(fabricRef.current.getObjects().filter(o => !o._bg).length);
  }, []);

  const onSel = useCallback(() => {
    const a = fabricRef.current?.getActiveObject();
    if (a && !a._bg) setSelObj({ type: a.type, left: Math.round(a.left||0), top: Math.round(a.top||0) });
  }, []);

  // ─── Canvas mouse events for shape drawing ───
  const currentToolRef = useRef("select");
  useEffect(() => { currentToolRef.current = tool; }, [tool]);

  const strokeRef = useRef(strokeColor);
  const strokeWRef = useRef(strokeWidth);
  const fillCRef = useRef(fillColor);
  const fillORef = useRef(fillOpacity);
  const fontRef = useRef(fontFamily);
  const fontSzRef = useRef(fontSize);
  const textCRef = useRef(textColor);
  useEffect(() => { strokeRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { strokeWRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { fillCRef.current = fillColor; }, [fillColor]);
  useEffect(() => { fillORef.current = fillOpacity; }, [fillOpacity]);
  useEffect(() => { fontRef.current = fontFamily; }, [fontFamily]);
  useEffect(() => { fontSzRef.current = fontSize; }, [fontSize]);
  useEffect(() => { textCRef.current = textColor; }, [textColor]);

  const onMouseDown = useCallback((opt) => {
    const fc = fabricRef.current; if (!fc) return;
    const t = currentToolRef.current;
    const p = fc.getPointer(opt.e);

    if (t === "eraser") {
      const target = fc.findTarget(opt.e);
      if (target && !target._bg) { fc.remove(target); fc.renderAll(); }
      return;
    }
    if (t === "text") {
      const tx = new window.fabric.IText("Texte", {
        left: p.x, top: p.y, fontFamily: fontRef.current,
        fontSize: fontSzRef.current, fill: textCRef.current, _objType:"text",
      });
      fc.add(tx); fc.setActiveObject(tx); tx.enterEditing(); fc.renderAll();
      return;
    }
    if (["rect","ellipse","line","arrow"].includes(t)) {
      drawRef.current.drawing = true;
      drawRef.current.start = { x: p.x, y: p.y };
      const sc = strokeRef.current, sw = strokeWRef.current;
      const fc2 = fillCRef.current, fo = fillORef.current / 100;
      let obj;
      if (t === "rect") obj = new window.fabric.Rect({ left:p.x, top:p.y, width:0, height:0, fill:hex2rgba(fc2,fo), stroke:sc, strokeWidth:sw, _objType:"rect" });
      else if (t === "ellipse") obj = new window.fabric.Ellipse({ left:p.x, top:p.y, rx:0, ry:0, fill:hex2rgba(fc2,fo), stroke:sc, strokeWidth:sw, _objType:"ellipse" });
      else obj = new window.fabric.Line([p.x,p.y,p.x,p.y], { stroke:sc, strokeWidth:sw, selectable:true, _objType:t });
      drawRef.current.shape = obj;
      fc.add(obj);
    }
  }, []);

  const onMouseMove = useCallback((opt) => {
    if (!drawRef.current.drawing || !drawRef.current.shape) return;
    const fc = fabricRef.current; if (!fc) return;
    const p = fc.getPointer(opt.e);
    const { x: sx, y: sy } = drawRef.current.start;
    const o = drawRef.current.shape;
    const t = currentToolRef.current;
    if (t === "rect") o.set({ left:Math.min(sx,p.x), top:Math.min(sy,p.y), width:Math.abs(p.x-sx), height:Math.abs(p.y-sy) });
    else if (t === "ellipse") o.set({ left:Math.min(sx,p.x), top:Math.min(sy,p.y), rx:Math.abs(p.x-sx)/2, ry:Math.abs(p.y-sy)/2 });
    else o.set({ x2:p.x, y2:p.y });
    o.setCoords(); fc.renderAll();
  }, []);

  const onMouseUp = useCallback(() => {
    if (!drawRef.current.drawing) return;
    const fc = fabricRef.current;
    const t = currentToolRef.current;
    const o = drawRef.current.shape;
    if (t === "arrow" && o && fc) {
      const angle = Math.atan2(o.y2-o.y1, o.x2-o.x1), hl = 14;
      const pts = [{ x:o.x2, y:o.y2 }, { x:o.x2-hl*Math.cos(angle-Math.PI/6), y:o.y2-hl*Math.sin(angle-Math.PI/6) }, { x:o.x2-hl*Math.cos(angle+Math.PI/6), y:o.y2-hl*Math.sin(angle+Math.PI/6) }];
      const head = new window.fabric.Polygon(pts, { fill:o.stroke, stroke:o.stroke, strokeWidth:1, selectable:false, evented:false });
      const grp = new window.fabric.Group([o, head], { _objType:"arrow" });
      fc.remove(o); fc.add(grp); fc.renderAll();
    }
    drawRef.current = { drawing:false, start:null, shape:null };
    fc?.renderAll();
  }, []);

  // ─── Tool switching ───
  const setTool = useCallback((t) => {
    setToolState(t);
    const fc = fabricRef.current; if (!fc) return;
    fc.isDrawingMode = t === "pencil";
    fc.selection = t === "select";
    if (t === "pencil") {
      fc.freeDrawingBrush.color = strokeRef.current;
      fc.freeDrawingBrush.width = strokeWRef.current;
    }
    if (t === "select") fc.forEachObject(o => { if (!o._bg) o.selectable = true; });
    else {
      fc.discardActiveObject();
      if (t !== "pencil") fc.forEachObject(o => { if (!o._bg) o.selectable = t === "eraser"; });
      fc.renderAll();
    }
  }, []);

  // Update brush when props change and pencil active
  useEffect(() => {
    const fc = fabricRef.current; if (!fc || tool !== "pencil") return;
    fc.freeDrawingBrush.color = strokeColor;
    fc.freeDrawingBrush.width = strokeWidth;
  }, [strokeColor, strokeWidth, tool]);

  // ─── Page rendering ───
  const renderPage = useCallback(async (doc, num) => {
    const page = await doc.getPage(num);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    pageBgRef.current[num] = c.toDataURL("image/png");
    pageDimRef.current[num] = { width: vp.width/2, height: vp.height/2 };
  }, []);

  const savePageObjects = useCallback(() => {
    const fc = fabricRef.current; if (!fc) return;
    const objs = fc.getObjects().filter(o => !o._bg);
    const z = zoomRef.current;
    pageObjRef.current[currentPageRef.current] = objs.map(o => {
      const j = o.toJSON(["_bg","_objType"]);
      j.left = (j.left||0)/z; j.top = (j.top||0)/z;
      j.scaleX = (j.scaleX||1)/z; j.scaleY = (j.scaleY||1)/z;
      return j;
    });
  }, []);

  const showPage = useCallback(async (num, z) => {
    savePageObjects();
    const dim = pageDimRef.current[num]; if (!dim) return;
    const w = Math.round(dim.width * z), h = Math.round(dim.height * z);
    const fc = initCanvas(w, h); if (!fc) return;

    const bg = pageBgRef.current[num];
    window.fabric.Image.fromURL(bg, (img) => {
      img.scaleToWidth(w);
      img.set({ selectable:false, evented:false, _bg:true });
      fc.setBackgroundImage(img, fc.renderAll.bind(fc));
    });

    const saved = pageObjRef.current[num];
    if (saved?.length) {
      const scaled = saved.map(o => {
        const c = JSON.parse(JSON.stringify(o));
        c.left = (c.left||0)*z; c.top = (c.top||0)*z;
        c.scaleX = (c.scaleX||1)*z; c.scaleY = (c.scaleY||1)*z;
        return c;
      });
      window.fabric.util.enlivenObjects(scaled, (arr) => {
        arr.forEach(o => fc.add(o));
        fc.renderAll();
      });
    }
  }, [initCanvas, savePageObjects]);

  // ─── Load PDF ───
  const loadPDF = useCallback(async (file) => {
    setLoading(true);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
      pdfBytesRef.current = new Uint8Array(bytes);
      setPdfDoc(doc);
      setFileName(file.name); setTotalPages(doc.numPages);
      pageObjRef.current = {}; pageBgRef.current = {}; pageDimRef.current = {};
      for (let i = 1; i <= doc.numPages; i++) await renderPage(doc, i);
      setCurrentPage(1); setZoom(1);
      await showPage(1, 1);
    } catch (e) {
      console.error(e);
      alert("Erreur lors du chargement du PDF.");
    }
    setLoading(false);
  }, [renderPage, showPage]);

  // Page navigation
  const goPage = useCallback(async (n) => {
    if (n < 1 || n > totalPages) return;
    setCurrentPage(n);
    await showPage(n, zoomRef.current);
  }, [totalPages, showPage]);

  // Zoom
  const doZoom = useCallback(async (nz) => {
    nz = Math.max(.25, Math.min(3, nz));
    setZoom(nz);
    await showPage(currentPageRef.current, nz);
  }, [showPage]);

  const zoomFit = useCallback(async () => {
    const dim = pageDimRef.current[currentPageRef.current];
    const el = scrollRef.current;
    if (!dim || !el) return;
    const nz = Math.min((el.clientWidth-50)/dim.width, (el.clientHeight-50)/dim.height, 2);
    await doZoom(nz);
  }, [doZoom]);

  // ─── Object actions ───
  const deleteSelected = useCallback(() => {
    const fc = fabricRef.current; if (!fc) return;
    const a = fc.getActiveObject();
    if (!a || a._bg) return;
    if (a.type === "activeSelection") a.forEachObject(o => fc.remove(o));
    else fc.remove(a);
    fc.discardActiveObject(); fc.renderAll();
    setSelObj(null);
  }, []);

  const bringFwd = useCallback(() => {
    const fc = fabricRef.current; const o = fc?.getActiveObject();
    if (o && !o._bg) { fc.bringForward(o); fc.renderAll(); }
  }, []);
  const sendBck = useCallback(() => {
    const fc = fabricRef.current; const o = fc?.getActiveObject();
    if (o && !o._bg && fc.getObjects().indexOf(o) > 0) { fc.sendBackwards(o); fc.renderAll(); }
  }, []);

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      const a = fabricRef.current?.getActiveObject();
      if ((e.key === "Delete" || e.key === "Backspace") && a && !a.isEditing) deleteSelected();
      if (e.key === "Escape") { fabricRef.current?.discardActiveObject(); fabricRef.current?.renderAll(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deleteSelected]);

  // ─── Export ───
  const exportPDF = useCallback(async () => {
    if (!pdfBytesRef.current) { alert("Aucun document ouvert."); return; }
    setLoading(true);
    savePageObjects();
    try {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.load(pdfBytesRef.current);
      const tp = doc.getPageCount();

      for (let pn = 1; pn <= tp; pn++) {
        const page = doc.getPages()[pn-1];
        const { width: pW, height: pH } = page.getSize();
        const dim = pageDimRef.current[pn]; if (!dim) continue;
        const sx = pW/dim.width, sy = pH/dim.height;
        const objs = pageObjRef.current[pn] || [];

        for (const obj of objs) {
          const left = (obj.left||0)*sx, top = (obj.top||0)*sy, pdfY = pH - top;
          if (obj.type === "i-text" || obj.type === "text") {
            const font = await doc.embedFont(StandardFonts.Helvetica);
            const sz = (obj.fontSize||18)*(obj.scaleY||1)*sy;
            const c = hex2rgb01(obj.fill||"#000");
            (obj.text||"").split("\n").forEach((ln, i) => {
              page.drawText(ln, { x:left, y:pdfY-sz-(i*sz*1.2), size:sz, font, color:rgb(c[0],c[1],c[2]) });
            });
          } else if (obj.type === "rect") {
            const w = (obj.width||0)*(obj.scaleX||1)*sx, h = (obj.height||0)*(obj.scaleY||1)*sy;
            const opts = { x:left, y:pdfY-h, width:w, height:h, borderWidth:(obj.strokeWidth||0)*sx };
            if (obj.stroke) { const c = hex2rgb01(obj.stroke); opts.borderColor = rgb(c[0],c[1],c[2]); }
            if (obj.fill && obj.fill !== "transparent") { const c = parseRGBA(obj.fill); opts.color = rgb(c.r,c.g,c.b); opts.opacity = c.a; }
            page.drawRectangle(opts);
          } else if (obj.type === "ellipse") {
            const rx = (obj.rx||0)*(obj.scaleX||1)*sx, ry = (obj.ry||0)*(obj.scaleY||1)*sy;
            const opts = { x:left+rx, y:pdfY-ry, xScale:rx, yScale:ry, borderWidth:(obj.strokeWidth||0)*sx };
            if (obj.stroke) { const c = hex2rgb01(obj.stroke); opts.borderColor = rgb(c[0],c[1],c[2]); }
            if (obj.fill && obj.fill !== "transparent") { const c = parseRGBA(obj.fill); opts.color = rgb(c.r,c.g,c.b); opts.opacity = c.a; }
            page.drawEllipse(opts);
          } else if (obj.type === "line") {
            const c = hex2rgb01(obj.stroke||"#000");
            page.drawLine({ start:{x:(obj.x1||0)*sx, y:pH-(obj.y1||0)*sy}, end:{x:(obj.x2||0)*sx, y:pH-(obj.y2||0)*sy}, thickness:(obj.strokeWidth||2)*sx, color:rgb(c[0],c[1],c[2]) });
          }
        }
      }
      const bytes = await doc.save();
      const blob = new Blob([bytes], { type:"application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName.replace(".pdf","") + "_edite.pdf";
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { console.error(e); alert("Erreur export."); }
    setLoading(false);
  }, [fileName, savePageObjects]);

  // ─── Merge ───
  const addMerge = useCallback(async (files) => {
    const newFiles = [];
    for (const f of files) {
      try {
        const b = await f.arrayBuffer();
        const d = await window.pdfjsLib.getDocument({ data: b.slice(0) }).promise;
        newFiles.push({ name: f.name, bytes: new Uint8Array(b), numPages: d.numPages });
      } catch (e) { console.error(e); }
    }
    setMergeFiles(prev => [...prev, ...newFiles]);
  }, []);

  const execMerge = useCallback(async () => {
    if (mergeFiles.length < 2) return;
    setLoading(true);
    try {
      const { PDFDocument } = window.PDFLib;
      const merged = await PDFDocument.create();
      for (const f of mergeFiles) {
        const src = await PDFDocument.load(f.bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type:"application/pdf" });
      const file = new File([blob], "document_fusionne.pdf", { type:"application/pdf" });
      setShowMerge(false); setMergeFiles([]);
      await loadPDF(file);
    } catch (e) { console.error(e); alert("Erreur fusion."); }
    setLoading(false);
  }, [mergeFiles, loadPDF]);

  // ─── Apply props to selected object ───
  const applyToSel = useCallback(() => {
    const fc = fabricRef.current; if (!fc) return;
    const o = fc.getActiveObject(); if (!o || o._bg) return;
    if (o.type === "i-text" || o.type === "text") {
      o.set({ fontFamily, fontSize, fill: textColor }); fc.renderAll();
    } else {
      o.set({ stroke: strokeColor, strokeWidth });
      if (o.type === "rect" || o.type === "ellipse") o.set({ fill: hex2rgba(fillColor, fillOpacity/100) });
      fc.renderAll();
    }
  }, [strokeColor, strokeWidth, fillColor, fillOpacity, fontFamily, fontSize, textColor]);

  // ─── Loading screen ───
  if (!ready) return (
    <div style={{...S.app, alignItems:"center", justifyContent:"center"}}>
      {loadErr ? <div style={{color:"var(--accent)"}}>{loadErr}</div> :
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
          <div style={{width:32,height:32,border:"3px solid var(--line)",borderTop:"3px solid var(--accent)",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
          <span style={{color:"var(--muted)",fontSize:13}}>Chargement des composants…</span>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      }
    </div>
  );

  const tools = [
    { id:"select", icon:I.cursor, label:"Sélection" },
    { id:"text", icon:I.text, label:"Texte" },
    "sep",
    { id:"rect", icon:I.rect, label:"Rectangle" },
    { id:"ellipse", icon:I.ellipse, label:"Ellipse" },
    { id:"line", icon:I.line, label:"Ligne" },
    { id:"arrow", icon:I.arrow, label:"Flèche" },
    "sep",
    { id:"pencil", icon:I.pencil, label:"Crayon" },
    { id:"eraser", icon:I.eraser, label:"Gomme" },
    "sep",
  ];

  const hasDoc = !!pdfDoc;

  return (
    <div style={S.app}>
      {/* Loading bar */}
      {loading && <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"var(--accent)",zIndex:999,animation:"loadbar 1.5s ease infinite"}}>
        <style>{`@keyframes loadbar{0%{transform:scaleX(0);transform-origin:left}50%{transform:scaleX(.7)}100%{transform:scaleX(1);opacity:0}}`}</style>
      </div>}

      {/* Top bar */}
      <div style={S.topbar}>
        <div style={S.brand}>
          {I.file}
          <span>PDF Studio</span>
        </div>
        <div style={S.topActions}>
          <button style={S.btn} onClick={() => fileInputRef.current?.click()}>{I.upload} <span>Importer</span></button>
          <button style={S.btn} onClick={() => setShowMerge(true)}>{I.merge} <span>Fusionner</span></button>
          <button style={{...S.btn,...S.btnPrimary}} onClick={exportPDF}>{I.download} <span>Exporter</span></button>
        </div>
      </div>

      <div style={S.body}>
        {/* Toolbar */}
        <div style={S.toolbar}>
          {tools.map((t, i) => t === "sep" ? <div key={i} style={S.toolSep}/> :
            <button key={t.id} style={S.toolBtn(tool===t.id)} onClick={() => setTool(t.id)} title={t.label}>{t.icon}</button>
          )}
          <div style={S.toolSep}/>
          <button style={S.toolBtn(false)} onClick={deleteSelected} title="Supprimer">{I.trash}</button>
          <button style={S.toolBtn(false)} onClick={bringFwd} title="Avancer">{I.layerUp}</button>
          <button style={S.toolBtn(false)} onClick={sendBck} title="Reculer">{I.layerDown}</button>
        </div>

        {/* Canvas area */}
        <div style={S.canvasArea}>
          {!hasDoc ? (
            <div style={S.welcome}>
              <div style={{opacity:.5}}>{I.file}</div>
              <h2 style={{fontSize:20,fontWeight:700,letterSpacing:"-.3px"}}>PDF Studio</h2>
              <p style={{fontSize:13,color:"var(--muted)",maxWidth:340}}>Importez un PDF pour commencer l'édition, ou fusionnez plusieurs documents.</p>
              <div style={S.dropzone} onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--accent)"; }}
                onDragLeave={e => { e.currentTarget.style.borderColor="var(--line)"; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--line)"; const f=e.dataTransfer.files[0]; if(f?.type==="application/pdf") loadPDF(f); }}>
                <div style={{marginBottom:8,opacity:.5}}>{I.upload}</div>
                <div style={{color:"var(--muted)",fontSize:13}}>Glissez un PDF ici ou cliquez</div>
              </div>
            </div>
          ) : (
            <>
              <div style={S.pageNav}>
                <button style={S.navBtn(currentPage<=1)} onClick={() => goPage(currentPage-1)} disabled={currentPage<=1}>{I.chevL}</button>
                <span style={{fontSize:12,color:"var(--muted)",minWidth:60,textAlign:"center"}}>{currentPage} / {totalPages}</span>
                <button style={S.navBtn(currentPage>=totalPages)} onClick={() => goPage(currentPage+1)} disabled={currentPage>=totalPages}>{I.chevR}</button>
                <div style={{width:1,height:16,background:"var(--line)",margin:"0 6px"}}/>
                <button style={{...S.toolBtn(false),width:28,height:28}} onClick={() => doZoom(zoom-.25)}>{I.zoomOut}</button>
                <span style={{fontSize:11,color:"var(--muted)",fontFamily:"monospace",minWidth:40,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
                <button style={{...S.toolBtn(false),width:28,height:28}} onClick={() => doZoom(zoom+.25)}>{I.zoomIn}</button>
                <button style={{...S.toolBtn(false),width:28,height:28}} onClick={zoomFit}>{I.fit}</button>
              </div>
              <div style={S.canvasScroll} ref={scrollRef}>
                <div style={S.canvasWrap}>
                  <canvas ref={canvasElRef}/>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={S.panel}>
          <div style={S.section}>
            <div style={S.sectionTitle}>Outil</div>
            <div style={{fontWeight:600,fontSize:13,marginBottom:2}}>
              {{ select:"Sélection", text:"Texte", rect:"Rectangle", ellipse:"Ellipse", line:"Ligne", arrow:"Flèche", pencil:"Crayon", eraser:"Gomme" }[tool] || tool}
            </div>
            <div style={{color:"var(--faint)",fontSize:11}}>
              {{ select:"Cliquer pour sélectionner", text:"Cliquer pour ajouter du texte", rect:"Glisser pour dessiner", ellipse:"Glisser pour dessiner", line:"Glisser pour tracer", arrow:"Glisser pour tracer", pencil:"Dessiner à main levée", eraser:"Cliquer pour effacer" }[tool]}
            </div>
          </div>

          {/* Stroke */}
          {(["select","rect","ellipse","line","arrow","pencil"].includes(tool)) && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Contour</div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Couleur</span>
                <input type="color" value={strokeColor} onChange={e => { setStrokeColor(e.target.value); }} style={{width:36,height:26,border:"1px solid var(--line)",borderRadius:4,cursor:"pointer",background:"transparent"}}/>
              </div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Épaisseur</span>
                <input type="range" min="1" max="20" value={strokeWidth} onChange={e => setStrokeWidth(+e.target.value)} style={{flex:1,accentColor:"var(--accent)"}}/>
                <span style={{fontSize:11,color:"var(--muted)",minWidth:18,textAlign:"right"}}>{strokeWidth}</span>
              </div>
            </div>
          )}

          {/* Fill */}
          {["rect","ellipse"].includes(tool) && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Remplissage</div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Couleur</span>
                <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} style={{width:36,height:26,border:"1px solid var(--line)",borderRadius:4,cursor:"pointer",background:"transparent"}}/>
              </div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Opacité</span>
                <input type="range" min="0" max="100" value={fillOpacity} onChange={e => setFillOpacity(+e.target.value)} style={{flex:1,accentColor:"var(--accent)"}}/>
                <span style={{fontSize:11,color:"var(--muted)",minWidth:24,textAlign:"right"}}>{fillOpacity}%</span>
              </div>
            </div>
          )}

          {/* Text */}
          {(tool === "text" || tool === "select") && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Texte</div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Police</span>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={{...S.propInput,cursor:"pointer"}}>
                  {["Helvetica","Arial","Times New Roman","Courier New","Georgia","Verdana"].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Taille</span>
                <input type="number" value={fontSize} min="6" max="200" onChange={e => setFontSize(+e.target.value)} style={{...S.propInput,width:50}}/>
              </div>
              <div style={S.propRow}>
                <span style={S.propLabel}>Couleur</span>
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{width:36,height:26,border:"1px solid var(--line)",borderRadius:4,cursor:"pointer",background:"transparent"}}/>
              </div>
            </div>
          )}

          {/* Selection props */}
          {selObj && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Sélection</div>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>x: {selObj.left}, y: {selObj.top}</div>
              <div style={S.propRow}>
                <button style={{...S.btn, flex:1, justifyContent:"center", borderColor:"var(--accent)", color:"var(--accent)"}} onClick={applyToSel}>Appliquer styles</button>
              </div>
              <div style={S.propRow}>
                <button style={{...S.btn, flex:1, justifyContent:"center", borderColor:"var(--accent)", color:"var(--accent)"}} onClick={deleteSelected}>Supprimer</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={S.statusbar}>
        <span>{fileName || "Aucun fichier"}</span>
        <span>{objCount} objet{objCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Merge Modal */}
      {showMerge && (
        <div style={S.modal} onClick={() => setShowMerge(false)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h3 style={{fontSize:15,fontWeight:600}}>Fusionner des PDF</h3>
              <button style={{background:"transparent",border:"none",color:"var(--muted)",cursor:"pointer"}} onClick={() => setShowMerge(false)}>{I.close}</button>
            </div>
            <div style={S.modalBody}>
              <p style={{fontSize:12,color:"var(--muted)",marginBottom:12}}>Ajoutez des fichiers et réorganisez l'ordre.</p>
              <button style={{...S.btn,width:"100%",justifyContent:"center",marginBottom:12}} onClick={() => mergeInputRef.current?.click()}>+ Ajouter des fichiers</button>
              {mergeFiles.length === 0 && <div style={{textAlign:"center",padding:24,color:"var(--faint)",fontSize:12}}>Aucun fichier</div>}
              {mergeFiles.map((f, i) => (
                <div key={i} style={S.mergeItem}>
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    <button style={{background:"transparent",border:"none",color:i===0?"var(--faint)":"var(--muted)",cursor:"pointer",fontSize:11}} onClick={() => { if(i>0){ const a=[...mergeFiles];[a[i-1],a[i]]=[a[i],a[i-1]];setMergeFiles(a);} }}>▲</button>
                    <button style={{background:"transparent",border:"none",color:i===mergeFiles.length-1?"var(--faint)":"var(--muted)",cursor:"pointer",fontSize:11}} onClick={() => { if(i<mergeFiles.length-1){ const a=[...mergeFiles];[a[i],a[i+1]]=[a[i+1],a[i]];setMergeFiles(a);} }}>▼</button>
                  </div>
                  {I.file}
                  <span style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                  <span style={{fontSize:10,color:"var(--faint)"}}>{f.numPages} p.</span>
                  <button style={{background:"transparent",border:"none",color:"var(--accent)",cursor:"pointer",fontSize:14}} onClick={() => setMergeFiles(mergeFiles.filter((_,j) => j!==i))}>✕</button>
                </div>
              ))}
            </div>
            <div style={S.modalFoot}>
              <button style={S.btn} onClick={() => setShowMerge(false)}>Annuler</button>
              <button style={{...S.btn,...S.btnPrimary,opacity:mergeFiles.length<2?.5:1}} onClick={execMerge} disabled={mergeFiles.length<2}>Fusionner</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf" style={{display:"none"}} onChange={e => { const f=e.target.files[0]; if(f) loadPDF(f); e.target.value=""; }}/>
      <input ref={mergeInputRef} type="file" accept=".pdf" multiple style={{display:"none"}} onChange={e => { addMerge(Array.from(e.target.files)); e.target.value=""; }}/>
    </div>
  );
}
