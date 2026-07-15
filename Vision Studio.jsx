const { useState, useRef, useCallback, useEffect } = React;

// ─── Constants ───
const FONTS = ["Arial", "Georgia", "Courier New", "Verdana", "Times New Roman", "Trebuchet MS", "Impact", "Comic Sans MS"];
const TEMPLATES = [
  { name: "Libre", w: 1920, h: 1080 },
  { name: "Carré", w: 1080, h: 1080 },
  { name: "Story", w: 1080, h: 1920 },
  { name: "Présentation", w: 1920, h: 1080 },
  { name: "Miniature YT", w: 1280, h: 720 },
  { name: "A4", w: 2480, h: 3508 },
];

let _id = 0;
const uid = () => `l_${++_id}_${Date.now()}`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Default layer factories ───
const makeImageLayer = (img, name = "Image") => ({
  id: uid(), type: "image", name, visible: true, locked: false,
  x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight, rotation: 0,
  flipH: false, flipV: false, opacity: 1,
  filters: { brightness: 100, contrast: 100, saturate: 100 },
  _img: img, _origW: img.naturalWidth, _origH: img.naturalHeight,
});

const makeTextLayer = (text = "Texte") => ({
  id: uid(), type: "text", name: text, visible: true, locked: false,
  x: 100, y: 100, w: 200, h: 60, rotation: 0, opacity: 1,
  text, fontSize: 32, fontFamily: "Arial", fontWeight: "normal",
  align: "left", color: "#ffffff", bgColor: "transparent",
  borderRadius: 0, shadow: false,
});

const makeShapeLayer = (shape = "rect") => ({
  id: uid(), type: "shape", name: shape === "rect" ? "Rectangle" : shape === "circle" ? "Cercle" : "Ligne",
  visible: true, locked: false,
  x: 100, y: 100, w: 150, h: shape === "line" ? 4 : 150, rotation: 0, opacity: 1,
  shape, fill: "#3b82f6", stroke: "#1d4ed8", strokeWidth: 0,
  borderRadius: shape === "circle" ? 9999 : 0,
});

// ─── History helper ───
const HISTORY_MAX = 60; // états conservés (indices valides : 0 .. HISTORY_MAX-1)

function useHistory(initial) {
  const [states, setStates] = useState([initial]);
  const [idx, setIdx] = useState(0);
  const current = states[idx];

  const push = useCallback((next) => {
    setStates(prev => {
      const trimmed = prev.slice(0, idx + 1);
      const newStates = [...trimmed, typeof next === "function" ? next(trimmed[trimmed.length - 1]) : next];
      if (newStates.length > HISTORY_MAX) newStates.shift();
      return newStates;
    });
    // Quand le tableau est plafonné puis décalé, le nouvel état occupe le
    // dernier index valide (HISTORY_MAX-1), pas idx+1. Sans ce clamp, idx
    // pointait sur HISTORY_MAX (hors limites) -> state undefined -> crash.
    setIdx(prev => Math.min(prev + 1, HISTORY_MAX - 1));
  }, [idx]);

  const undo = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const redo = useCallback(() => setIdx(i => Math.min(states.length - 1, i + 1)), [states.length]);

  return { current, push, undo, redo, canUndo: idx > 0, canRedo: idx < states.length - 1 };
}

// ─── SVG Icons (inline, minimal) ───
const Icons = {
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  undo: "M3 7v6h6M3 13a9 9 0 0 1 15.36-6.36",
  redo: "M21 7v6h-6M21 13a9 9 0 0 0-15.36-6.36",
  zoomIn: "M11 8v6M8 11h6M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  zoomOut: "M8 11h6M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  square: "M3 3h18v18H3z",
  circle: "M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0",
  minus: "M5 12h14",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  eyeOff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  move: "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20",
  rotateCw: "M21 2v6h-6M21 13a9 9 0 1 1-3-7.7L21 8",
  flipH: "M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 0 2 2v14a2 2 0 0 0-2 2h-3M12 20V4",
  flipV: "M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 1 2 2h14a2 2 0 0 1 2-2v-3M20 12H4",
  reset: "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  chevDown: "M6 9l6 6 6-6",
  chevRight: "M9 18l6-6-6-6",
  x: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  sun: "M12 12m-5 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  image: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M19 12l-7 7-7-7",
  bold: "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z",
  alignLeft: "M17 10H3M21 6H3M21 14H3M17 18H3",
  alignCenter: "M18 10H6M21 6H3M21 14H3M18 18H6",
  alignRight: "M21 10H7M21 6H3M21 14H3M21 18H7",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  unlock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 9.9-1",
};

const Ic = ({ name, size = 18, className = "" }) => {
  const paths = Icons[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={paths} />
    </svg>
  );
};

// ─── Btn component ───
const Btn = ({ children, onClick, active, disabled, title, className = "", small }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    className={`flex items-center justify-center gap-1.5 transition-all duration-150 rounded-lg
      ${small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}
      ${active ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-zinc-300 hover:bg-zinc-700/60 hover:text-white"}
      ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
      ${className}`}>
    {children}
  </button>
);

// ─── Slider component ───
const Slider = ({ label, value, onChange, min = 0, max = 200, unit = "%" }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs text-zinc-400">
      <span>{label}</span><span>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
      className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
        [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md
        [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2
        [&::-webkit-slider-thumb]:border-zinc-900" />
  </div>
);

// ────────────────────────────────────────────────────────────────
// MAIN APP
// ────────────────────────────────────────────────────────────────
function ImageEditor() {
  // ─── Core state ───
  const initState = { layers: [], selectedId: null, canvasW: 1920, canvasH: 1080 };
  const { current: state, push: pushState, undo, redo, canUndo, canRedo } = useHistory(initState);

  const { layers, selectedId, canvasW, canvasH } = state;
  const selected = layers.find(l => l.id === selectedId) || null;

  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState("select"); // select | text | shape
  const [leftTab, setLeftTab] = useState("elements"); // elements | text | layers | adjust
  const [showGrid, setShowGrid] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [shapeType, setShapeType] = useState("rect");
  const [isPanning, setIsPanning] = useState(false);
  const [dragState, setDragState] = useState(null); // { layerId, startX, startY, origX, origY, handle? }
  const [editingTextId, setEditingTextId] = useState(null);

  const canvasContainerRef = useRef(null);
  const renderCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helpers to update state
  const updateLayer = useCallback((id, patch) => {
    pushState(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...(typeof patch === "function" ? patch(l) : patch) } : l)
    }));
  }, [pushState]);

  const setSelected = useCallback((id) => {
    pushState(prev => ({ ...prev, selectedId: id }));
  }, [pushState]);

  const addLayer = useCallback((layer) => {
    pushState(prev => ({ ...prev, layers: [...prev.layers, layer], selectedId: layer.id }));
  }, [pushState]);

  const removeLayer = useCallback((id) => {
    pushState(prev => ({
      ...prev,
      layers: prev.layers.filter(l => l.id !== id),
      selectedId: prev.selectedId === id ? null : prev.selectedId
    }));
  }, [pushState]);

  const duplicateLayer = useCallback((id) => {
    pushState(prev => {
      const src = prev.layers.find(l => l.id === id);
      if (!src) return prev;
      const dup = { ...src, id: uid(), name: src.name + " (copie)", x: src.x + 20, y: src.y + 20 };
      return { ...prev, layers: [...prev.layers, dup], selectedId: dup.id };
    });
  }, [pushState]);

  const moveLayerOrder = useCallback((id, dir) => {
    pushState(prev => {
      const idx = prev.layers.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.layers.length) return prev;
      const arr = [...prev.layers];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...prev, layers: arr };
    });
  }, [pushState]);

  // ─── File import ───
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const layer = makeImageLayer(img, file.name.replace(/\.[^.]+$/, ""));
        // If first image and canvas is default, fit canvas to image
        pushState(prev => {
          const isFirst = prev.layers.filter(l => l.type === "image").length === 0;
          const newCanvasW = isFirst ? img.naturalWidth : prev.canvasW;
          const newCanvasH = isFirst ? img.naturalHeight : prev.canvasH;
          return {
            ...prev,
            canvasW: newCanvasW, canvasH: newCanvasH,
            layers: [...prev.layers, layer],
            selectedId: layer.id,
          };
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [pushState]);

  // ─── Drop handler ───
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ─── Canvas rendering ───
  const renderCanvas = useCallback((exportMode = false, exportW, exportH) => {
    const cw = exportMode ? (exportW || canvasW) : canvasW;
    const ch = exportMode ? (exportH || canvasH) : canvasH;
    const canvas = exportMode ? document.createElement("canvas") : renderCanvasRef.current;
    if (!canvas) return null;

    const scale = exportMode ? 1 : zoom;
    canvas.width = exportMode ? cw : Math.round(cw * zoom);
    canvas.height = exportMode ? ch : Math.round(ch * zoom);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (!exportMode) {
      // Checkerboard
      const sz = 10 * zoom;
      for (let yy = 0; yy < canvas.height; yy += sz) {
        for (let xx = 0; xx < canvas.width; xx += sz) {
          ctx.fillStyle = ((Math.floor(xx / sz) + Math.floor(yy / sz)) % 2 === 0) ? "#2a2a2e" : "#232327";
          ctx.fillRect(xx, yy, sz, sz);
        }
      }
    }

    // White canvas bg
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw * scale, ch * scale);

    // Render layers in order
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity;

      const cx = (layer.x + layer.w / 2) * scale;
      const cy = (layer.y + layer.h / 2) * scale;
      ctx.translate(cx, cy);
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
      if (layer.flipH) ctx.scale(-1, 1);
      if (layer.flipV) ctx.scale(1, -1);

      const dx = -(layer.w / 2) * scale;
      const dy = -(layer.h / 2) * scale;
      const dw = layer.w * scale;
      const dh = layer.h * scale;

      if (layer.type === "image" && layer._img) {
        const f = layer.filters || {};
        ctx.filter = `brightness(${f.brightness || 100}%) contrast(${f.contrast || 100}%) saturate(${f.saturate || 100}%)`;
        ctx.drawImage(layer._img, dx, dy, dw, dh);
        ctx.filter = "none";
      } else if (layer.type === "text") {
        if (layer.bgColor && layer.bgColor !== "transparent") {
          ctx.fillStyle = layer.bgColor;
          const r = (layer.borderRadius || 0) * scale;
          roundRect(ctx, dx, dy, dw, dh, r);
          ctx.fill();
        }
        ctx.fillStyle = layer.color || "#ffffff";
        ctx.font = `${layer.fontWeight || "normal"} ${(layer.fontSize || 32) * scale}px ${layer.fontFamily || "Arial"}`;
        ctx.textAlign = layer.align || "left";
        ctx.textBaseline = "top";
        if (layer.shadow) {
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 8 * scale;
          ctx.shadowOffsetX = 2 * scale;
          ctx.shadowOffsetY = 2 * scale;
        }
        const tx = layer.align === "center" ? dx + dw / 2 : layer.align === "right" ? dx + dw : dx + 4 * scale;
        wrapText(ctx, layer.text, tx, dy + 4 * scale, dw - 8 * scale, (layer.fontSize || 32) * scale * 1.3);
        ctx.shadowColor = "transparent";
      } else if (layer.type === "shape") {
        ctx.fillStyle = layer.fill || "#3b82f6";
        if (layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.stroke || "#1d4ed8";
          ctx.lineWidth = layer.strokeWidth * scale;
        }
        if (layer.shape === "rect") {
          const r = (layer.borderRadius || 0) * scale;
          roundRect(ctx, dx, dy, dw, dh, r);
          ctx.fill();
          if (layer.strokeWidth > 0) ctx.stroke();
        } else if (layer.shape === "circle") {
          ctx.beginPath();
          ctx.ellipse(0, 0, dw / 2, dh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          if (layer.strokeWidth > 0) ctx.stroke();
        } else if (layer.shape === "line") {
          ctx.strokeStyle = layer.fill || "#3b82f6";
          ctx.lineWidth = Math.max(2, dh);
          ctx.beginPath();
          ctx.moveTo(dx, 0);
          ctx.lineTo(dx + dw, 0);
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // Grid overlay (preview only)
    if (!exportMode && showGrid) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      const step = 50 * zoom;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      ctx.restore();
    }

    // Selection highlight (preview only)
    if (!exportMode && selected && selected.visible) {
      ctx.save();
      const cx2 = (selected.x + selected.w / 2) * zoom;
      const cy2 = (selected.y + selected.h / 2) * zoom;
      ctx.translate(cx2, cy2);
      if (selected.rotation) ctx.rotate((selected.rotation * Math.PI) / 180);
      const sx = -(selected.w / 2) * zoom;
      const sy = -(selected.h / 2) * zoom;
      const sw = selected.w * zoom;
      const sh = selected.h * zoom;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sx - 1, sy - 1, sw + 2, sh + 2);
      ctx.setLineDash([]);
      // Handles
      const hs = 8;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      const handles = [
        [sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh],
        [sx + sw / 2, sy], [sx + sw / 2, sy + sh], [sx, sy + sh / 2], [sx + sw, sy + sh / 2],
      ];
      handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });
      ctx.restore();
    }

    return canvas;
  }, [layers, canvasW, canvasH, zoom, showGrid, selected]);

  // Helper: round rect
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Helper: wrap text
  function wrapText(ctx, text, x, y, maxW, lineH) {
    const lines = text.split("\n");
    let cy = y;
    lines.forEach(line => {
      const words = line.split(" ");
      let current = "";
      words.forEach(word => {
        const test = current ? current + " " + word : word;
        if (ctx.measureText(test).width > maxW && current) {
          ctx.fillText(current, x, cy);
          current = word;
          cy += lineH;
        } else {
          current = test;
        }
      });
      if (current) ctx.fillText(current, x, cy);
      cy += lineH;
    });
  }

  // ─── Render loop ───
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ─── Mouse interaction on canvas ───
  const canvasToLocal = useCallback((e) => {
    const rect = renderCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  }, [zoom]);

  const hitTest = useCallback((mx, my) => {
    // Test layers in reverse order (top first)
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l.visible || l.locked) continue;
      // Simple AABB (ignoring rotation for simplicity)
      if (mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h) {
        return l;
      }
    }
    return null;
  }, [layers]);

  const getResizeHandle = useCallback((mx, my, layer) => {
    if (!layer) return null;
    const hs = 10 / zoom; // handle size in canvas coords
    const handles = {
      tl: [layer.x, layer.y],
      tr: [layer.x + layer.w, layer.y],
      bl: [layer.x, layer.y + layer.h],
      br: [layer.x + layer.w, layer.y + layer.h],
    };
    for (const [name, [hx, hy]] of Object.entries(handles)) {
      if (Math.abs(mx - hx) < hs && Math.abs(my - hy) < hs) return name;
    }
    return null;
  }, [zoom]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      return;
    }
    const { x, y } = canvasToLocal(e);

    if (tool === "text") {
      const tl = makeTextLayer("Texte");
      tl.x = x - 100;
      tl.y = y - 30;
      addLayer(tl);
      setTool("select");
      return;
    }
    if (tool === "shape") {
      const sl = makeShapeLayer(shapeType);
      sl.x = x - 75;
      sl.y = y - 75;
      addLayer(sl);
      setTool("select");
      return;
    }

    // Check resize handle on selected
    if (selected) {
      const handle = getResizeHandle(x, y, selected);
      if (handle) {
        setDragState({ layerId: selected.id, startX: x, startY: y, origX: selected.x, origY: selected.y, origW: selected.w, origH: selected.h, handle });
        return;
      }
    }

    const hit = hitTest(x, y);
    if (hit) {
      setSelected(hit.id);
      setDragState({ layerId: hit.id, startX: x, startY: y, origX: hit.x, origY: hit.y, origW: hit.w, origH: hit.h, handle: null });
    } else {
      setSelected(null);
    }
  }, [tool, canvasToLocal, hitTest, selected, getResizeHandle, addLayer, setSelected, shapeType]);

  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning) {
      const container = canvasContainerRef.current;
      if (container) {
        container.scrollLeft -= e.movementX;
        container.scrollTop -= e.movementY;
      }
      return;
    }
    if (!dragState) return;
    const { x, y } = canvasToLocal(e);
    const dx = x - dragState.startX;
    const dy = y - dragState.startY;

    if (dragState.handle) {
      // Resize
      const h = dragState.handle;
      let newX = dragState.origX, newY = dragState.origY;
      let newW = dragState.origW, newH = dragState.origH;
      if (h.includes("r")) newW = Math.max(20, dragState.origW + dx);
      if (h.includes("l")) { newX = dragState.origX + dx; newW = Math.max(20, dragState.origW - dx); }
      if (h.includes("b")) newH = Math.max(20, dragState.origH + dy);
      if (h.includes("t")) { newY = dragState.origY + dy; newH = Math.max(20, dragState.origH - dy); }

      // Keep aspect ratio for images with shift
      if (e.shiftKey) {
        const aspect = dragState.origW / dragState.origH;
        if (h === "br" || h === "tl") {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }

      updateLayer(dragState.layerId, { x: newX, y: newY, w: newW, h: newH });
    } else {
      // Move
      updateLayer(dragState.layerId, { x: dragState.origX + dx, y: dragState.origY + dy });
    }
  }, [isPanning, dragState, canvasToLocal, updateLayer]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragState(null);
  }, []);

  const handleCanvasDblClick = useCallback((e) => {
    const { x, y } = canvasToLocal(e);
    const hit = hitTest(x, y);
    if (hit && hit.type === "text") {
      setEditingTextId(hit.id);
    }
  }, [canvasToLocal, hitTest]);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (meta && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if (meta && e.key === "Z") { e.preventDefault(); redo(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingTextId) return;
        if (selectedId) { e.preventDefault(); removeLayer(selectedId); }
      }
      if (meta && e.key === "d" && selectedId) { e.preventDefault(); duplicateLayer(selectedId); }
      if (e.key === "Escape") { setSelected(null); setEditingTextId(null); }
      if (e.key === "+" || e.key === "=") { if (meta) { e.preventDefault(); setZoom(z => Math.min(3, z + 0.1)); } }
      if (e.key === "-") { if (meta) { e.preventDefault(); setZoom(z => Math.max(0.1, z - 0.1)); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedId, removeLayer, duplicateLayer, setSelected, editingTextId]);

  // ─── Export ───
  const doExport = useCallback((format = "png", quality = 0.92, expW, expH) => {
    const exportCanvas = renderCanvas(true, expW || canvasW, expH || canvasH);
    if (!exportCanvas) return;
    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const ext = format === "jpeg" ? "jpg" : format;
    exportCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mime, quality);
  }, [renderCanvas, canvasW, canvasH]);

  // ─── Zoom fit ───
  const zoomToFit = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const padded = 60;
    const zx = (container.clientWidth - padded) / canvasW;
    const zy = (container.clientHeight - padded) / canvasH;
    setZoom(Math.min(zx, zy, 1));
  }, [canvasW, canvasH]);

  useEffect(() => { zoomToFit(); }, [canvasW, canvasH]);

  // ─── Render ───
  return (
    <div className="h-screen w-full flex flex-col bg-zinc-900 text-zinc-200 overflow-hidden select-none"
      style={{ fontFamily: "'Instrument Sans', 'SF Pro Display', -apple-system, sans-serif" }}>

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/80 border-b border-zinc-800/60 backdrop-blur-sm z-20 shrink-0">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Ic name="image" size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">Studio</span>
          </div>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <Btn onClick={() => fileInputRef.current?.click()} title="Importer (Ctrl+O)"><Ic name="upload" size={16} /> <span className="hidden sm:inline">Importer</span></Btn>
          <Btn onClick={() => setShowExport(true)} title="Exporter"><Ic name="download" size={16} /> <span className="hidden sm:inline">Exporter</span></Btn>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <Btn onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Ic name="undo" size={16} /></Btn>
          <Btn onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Shift+Z)"><Ic name="redo" size={16} /></Btn>
        </div>

        <div className="flex items-center gap-1">
          <Btn onClick={() => setZoom(z => Math.max(0.1, z - 0.15))} title="Zoom -"><Ic name="zoomOut" size={16} /></Btn>
          <span className="text-xs text-zinc-400 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Btn onClick={() => setZoom(z => Math.min(3, z + 0.15))} title="Zoom +"><Ic name="zoomIn" size={16} /></Btn>
          <Btn onClick={zoomToFit} title="Ajuster"><Ic name="reset" size={16} /></Btn>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <Btn onClick={() => setShowGrid(g => !g)} active={showGrid} title="Grille"><Ic name="grid" size={16} /></Btn>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <span className="text-xs text-zinc-500 tabular-nums">{canvasW}×{canvasH}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ═══ LEFT SIDEBAR ═══ */}
        <div className="w-64 shrink-0 bg-zinc-950/50 border-r border-zinc-800/60 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800/60">
            {[
              { key: "elements", label: "Éléments", icon: "square" },
              { key: "layers", label: "Calques", icon: "layers" },
              { key: "adjust", label: "Réglages", icon: "sliders" },
            ].map(t => (
              <button key={t.key} onClick={() => setLeftTab(t.key)}
                className={`flex-1 py-2.5 text-xs font-medium transition-all border-b-2
                  ${leftTab === t.key ? "border-blue-500 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
                <Ic name={t.icon} size={14} className="mx-auto mb-0.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* ELEMENTS TAB */}
            {leftTab === "elements" && (
              <>
                <Section title="Ajouter">
                  <div className="grid grid-cols-2 gap-2">
                    <ToolCard icon="type" label="Texte" onClick={() => { setTool("text"); }} active={tool === "text"} />
                    <ToolCard icon="square" label="Rectangle" onClick={() => { setShapeType("rect"); setTool("shape"); }} active={tool === "shape" && shapeType === "rect"} />
                    <ToolCard icon="circle" label="Cercle" onClick={() => { setShapeType("circle"); setTool("shape"); }} active={tool === "shape" && shapeType === "circle"} />
                    <ToolCard icon="minus" label="Ligne" onClick={() => { setShapeType("line"); setTool("shape"); }} active={tool === "shape" && shapeType === "line"} />
                  </div>
                </Section>
                <Section title="Templates">
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map(t => (
                      <button key={t.name} onClick={() => pushState(prev => ({ ...prev, canvasW: t.w, canvasH: t.h }))}
                        className="px-2 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/60 text-xs text-zinc-400 hover:text-zinc-200 transition-all border border-zinc-800/40 hover:border-zinc-600/40">
                        <div className="font-medium text-zinc-300">{t.name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{t.w}×{t.h}</div>
                      </button>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* LAYERS TAB */}
            {leftTab === "layers" && (
              <Section title={`Calques (${layers.length})`}>
                {layers.length === 0 && <p className="text-xs text-zinc-600 italic">Aucun calque</p>}
                <div className="space-y-1">
                  {[...layers].reverse().map((l, ri) => {
                    const idx = layers.length - 1 - ri;
                    return (
                      <div key={l.id} onClick={() => setSelected(l.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-all border
                          ${l.id === selectedId ? "bg-blue-600/15 border-blue-500/30 text-blue-300" : "bg-zinc-800/30 border-zinc-800/40 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"}`}>
                        <Ic name={l.type === "image" ? "image" : l.type === "text" ? "type" : "square"} size={14} />
                        <span className="flex-1 truncate">{l.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }); }}
                          className="p-0.5 hover:text-white"><Ic name={l.visible ? "eye" : "eyeOff"} size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayerOrder(l.id, 1); }}
                          className="p-0.5 hover:text-white"><Ic name="arrowUp" size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayerOrder(l.id, -1); }}
                          className="p-0.5 hover:text-white"><Ic name="arrowDown" size={12} /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                          className="p-0.5 hover:text-red-400"><Ic name="trash" size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ADJUSTMENTS TAB */}
            {leftTab === "adjust" && (
              <>
                {selected?.type === "image" ? (
                  <Section title="Réglages image">
                    <div className="space-y-3">
                      <Slider label="Luminosité" value={selected.filters?.brightness ?? 100}
                        onChange={v => updateLayer(selected.id, { filters: { ...selected.filters, brightness: v } })} />
                      <Slider label="Contraste" value={selected.filters?.contrast ?? 100}
                        onChange={v => updateLayer(selected.id, { filters: { ...selected.filters, contrast: v } })} />
                      <Slider label="Saturation" value={selected.filters?.saturate ?? 100}
                        onChange={v => updateLayer(selected.id, { filters: { ...selected.filters, saturate: v } })} />
                      <Slider label="Opacité" value={Math.round(selected.opacity * 100)}
                        onChange={v => updateLayer(selected.id, { opacity: v / 100 })} min={0} max={100} />
                      <Btn small onClick={() => updateLayer(selected.id, { filters: { brightness: 100, contrast: 100, saturate: 100 }, opacity: 1 })}>
                        <Ic name="reset" size={14} /> Réinitialiser
                      </Btn>
                    </div>
                  </Section>
                ) : (
                  <p className="text-xs text-zinc-600 italic p-2">Sélectionnez un calque image pour ajuster</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ CANVAS AREA ═══ */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={canvasContainerRef}
            className="flex-1 overflow-auto flex items-center justify-center bg-zinc-900/80 relative"
            style={{ cursor: isPanning ? "grabbing" : tool === "text" ? "text" : tool === "shape" ? "crosshair" : dragState ? "move" : "default" }}
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
            onMouseMove={handleCanvasMouseMove}>

            {layers.length === 0 && !dragState ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center pointer-events-auto">
                  <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border-2 border-dashed border-zinc-700 flex items-center justify-center mx-auto mb-4">
                    <Ic name="upload" size={32} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-sm mb-2">Glissez-déposez une image ici</p>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-all font-medium shadow-lg shadow-blue-600/20">
                    Choisir un fichier
                  </button>
                  <p className="text-zinc-600 text-xs mt-3">ou choisissez un template à gauche</p>
                </div>
              </div>
            ) : null}

            <div className="relative" style={{ padding: 40 }}>
              <canvas ref={renderCanvasRef}
                style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)", borderRadius: 2 }}
                onMouseDown={handleCanvasMouseDown}
                onDoubleClick={handleCanvasDblClick}
              />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT SIDEBAR (contextual) ═══ */}
        {selected && (
          <div className="w-72 shrink-0 bg-zinc-950/50 border-l border-zinc-800/60 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">{selected.type === "image" ? "Image" : selected.type === "text" ? "Texte" : "Forme"}</h3>
                <div className="flex gap-1">
                  <Btn small onClick={() => duplicateLayer(selected.id)} title="Dupliquer"><Ic name="copy" size={14} /></Btn>
                  <Btn small onClick={() => removeLayer(selected.id)} title="Supprimer"><Ic name="trash" size={14} /></Btn>
                </div>
              </div>

              {/* Position & Size */}
              <Section title="Position & Taille">
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="X" value={Math.round(selected.x)} onChange={v => updateLayer(selected.id, { x: v })} />
                  <NumInput label="Y" value={Math.round(selected.y)} onChange={v => updateLayer(selected.id, { y: v })} />
                  <NumInput label="L" value={Math.round(selected.w)} onChange={v => updateLayer(selected.id, { w: Math.max(10, v) })} />
                  <NumInput label="H" value={Math.round(selected.h)} onChange={v => updateLayer(selected.id, { h: Math.max(10, v) })} />
                </div>
                <div className="flex gap-2 mt-2">
                  <NumInput label="Rotation" value={selected.rotation || 0} onChange={v => updateLayer(selected.id, { rotation: v })} />
                  <NumInput label="Opacité" value={Math.round(selected.opacity * 100)} onChange={v => updateLayer(selected.id, { opacity: clamp(v, 0, 100) / 100 })} />
                </div>
              </Section>

              {/* Transforms */}
              <Section title="Transformations">
                <div className="flex flex-wrap gap-1">
                  <Btn small onClick={() => updateLayer(selected.id, { flipH: !selected.flipH })} active={selected.flipH}><Ic name="flipH" size={14} /> Flip H</Btn>
                  <Btn small onClick={() => updateLayer(selected.id, { flipV: !selected.flipV })} active={selected.flipV}><Ic name="flipV" size={14} /> Flip V</Btn>
                  <Btn small onClick={() => updateLayer(selected.id, { rotation: ((selected.rotation || 0) + 90) % 360 })}><Ic name="rotateCw" size={14} /> +90°</Btn>
                  <Btn small onClick={() => updateLayer(selected.id, { x: 0, y: 0, w: selected._origW || selected.w, h: selected._origH || selected.h, rotation: 0, flipH: false, flipV: false })}>
                    <Ic name="reset" size={14} /> Reset
                  </Btn>
                </div>
              </Section>

              {/* Text properties */}
              {selected.type === "text" && (
                <Section title="Propriétés texte">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Contenu</label>
                      <textarea value={selected.text} onChange={e => updateLayer(selected.id, { text: e.target.value, name: e.target.value.slice(0, 20) })}
                        className="w-full mt-1 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 resize-none focus:outline-none focus:border-blue-500"
                        rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Police</label>
                        <select value={selected.fontFamily} onChange={e => updateLayer(selected.id, { fontFamily: e.target.value })}
                          className="w-full mt-1 p-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-blue-500">
                          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <NumInput label="Taille" value={selected.fontSize} onChange={v => updateLayer(selected.id, { fontSize: Math.max(8, v) })} />
                    </div>
                    <div className="flex gap-1">
                      <Btn small onClick={() => updateLayer(selected.id, { fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}
                        active={selected.fontWeight === "bold"}><Ic name="bold" size={14} /></Btn>
                      <Btn small onClick={() => updateLayer(selected.id, { align: "left" })} active={selected.align === "left"}><Ic name="alignLeft" size={14} /></Btn>
                      <Btn small onClick={() => updateLayer(selected.id, { align: "center" })} active={selected.align === "center"}><Ic name="alignCenter" size={14} /></Btn>
                      <Btn small onClick={() => updateLayer(selected.id, { align: "right" })} active={selected.align === "right"}><Ic name="alignRight" size={14} /></Btn>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ColorInput label="Couleur" value={selected.color} onChange={v => updateLayer(selected.id, { color: v })} />
                      <ColorInput label="Fond" value={selected.bgColor || "transparent"} onChange={v => updateLayer(selected.id, { bgColor: v })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-400 flex-1">Ombre</label>
                      <input type="checkbox" checked={!!selected.shadow} onChange={e => updateLayer(selected.id, { shadow: e.target.checked })}
                        className="accent-blue-500" />
                    </div>
                  </div>
                </Section>
              )}

              {/* Shape properties */}
              {selected.type === "shape" && (
                <Section title="Propriétés forme">
                  <div className="space-y-3">
                    <ColorInput label="Remplissage" value={selected.fill} onChange={v => updateLayer(selected.id, { fill: v })} />
                    <ColorInput label="Contour" value={selected.stroke} onChange={v => updateLayer(selected.id, { stroke: v })} />
                    <NumInput label="Épaisseur contour" value={selected.strokeWidth || 0} onChange={v => updateLayer(selected.id, { strokeWidth: Math.max(0, v) })} />
                    {selected.shape === "rect" && (
                      <NumInput label="Rayon bordure" value={selected.borderRadius || 0} onChange={v => updateLayer(selected.id, { borderRadius: Math.max(0, v) })} />
                    )}
                  </div>
                </Section>
              )}

              {/* Image origin info */}
              {selected.type === "image" && selected._origW && (
                <Section title="Info image">
                  <p className="text-xs text-zinc-500">Original : {selected._origW}×{selected._origH}px</p>
                  <p className="text-xs text-zinc-500">Affiché : {Math.round(selected.w)}×{Math.round(selected.h)}px</p>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ EXPORT MODAL ═══ */}
      {showExport && (
        <ExportModal canvasW={canvasW} canvasH={canvasH} onClose={() => setShowExport(false)} onExport={doExport} />
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

// ─── Sub-components ───

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{title}</h4>
      {children}
    </div>
  );
}

function ToolCard({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
        ${active ? "bg-blue-600/15 border-blue-500/30 text-blue-400" : "bg-zinc-800/30 border-zinc-800/40 text-zinc-400 hover:bg-zinc-700/40 hover:text-zinc-200 hover:border-zinc-600/40"}`}>
      <Ic name={icon} size={20} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function NumInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</label>
      <input type="number" value={value} onChange={e => onChange(+e.target.value)}
        className="w-full mt-1 p-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 text-center tabular-nums focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-1.5 mt-1">
        <input type="color" value={value === "transparent" ? "#000000" : value} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-zinc-700 bg-zinc-800 cursor-pointer p-0.5" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 p-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
      </div>
    </div>
  );
}

function ExportModal({ canvasW, canvasH, onClose, onExport }) {
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(92);
  const [expW, setExpW] = useState(canvasW);
  const [expH, setExpH] = useState(canvasH);
  const [keepRatio, setKeepRatio] = useState(true);
  const aspect = canvasW / canvasH;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Exporter</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><Ic name="x" size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Format</label>
            <div className="flex gap-2">
              {["png", "jpeg", "webp"].map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium uppercase transition-all border
                    ${format === f ? "bg-blue-600/15 border-blue-500/30 text-blue-400" : "bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:bg-zinc-700/50"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {format !== "png" && (
            <Slider label="Qualité" value={quality} onChange={setQuality} min={10} max={100} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Largeur (px)</label>
              <input type="number" value={expW}
                onChange={e => { const v = +e.target.value; setExpW(v); if (keepRatio) setExpH(Math.round(v / aspect)); }}
                className="w-full mt-1 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Hauteur (px)</label>
              <input type="number" value={expH}
                onChange={e => { const v = +e.target.value; setExpH(v); if (keepRatio) setExpW(Math.round(v * aspect)); }}
                className="w-full mt-1 p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={keepRatio} onChange={e => setKeepRatio(e.target.checked)} className="accent-blue-500" />
            Conserver les proportions
          </label>

          <div className="bg-zinc-800/50 rounded-lg p-3 text-[11px] text-zinc-500 space-y-1">
            <p>PNG : export sans perte (lossless).</p>
            <p>JPEG/WebP : compression avec perte — qualité réglable.</p>
            <p className="text-zinc-600 italic">Note : le rendu texte via Canvas est rasterisé. L'image source est préservée sans recompression pendant l'édition.</p>
          </div>

          <button onClick={() => { onExport(format, quality / 100, expW, expH); onClose(); }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20">
            <span className="flex items-center justify-center gap-2"><Ic name="download" size={18} /> Télécharger</span>
          </button>
        </div>
      </div>
    </div>
  );
}

window.ImageEditor = ImageEditor;
