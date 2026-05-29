import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constantes ─────────────────────────────────────────────────

const MIME_CANDIDATES_VIDEO = [
  "video/mp4;codecs=h264,aac",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp8",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=h264",
  "video/webm",
];

const MIME_CANDIDATES_AUDIO = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const VIDEO_HIGH = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
const VIDEO_FALLBACK = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } };

const STATES = { IDLE: "idle", RECORDING: "recording", PAUSED: "paused", STOPPED: "stopped" };

// ─── Helpers ────────────────────────────────────────────────────

function bestMime(candidates) {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of candidates) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

function extFromMime(mime) {
  if (!mime) return "webm";
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("video/mp4")) return "mp4";
  return "webm";
}

function labelFromMime(mime, isVideo) {
  if (!mime) return isVideo ? "WebM (fallback)" : "WebM (fallback)";
  if (mime.startsWith("audio/mp4")) return "M4A (AAC)";
  if (mime.startsWith("audio/ogg")) return "OGG Opus";
  if (mime.startsWith("audio/webm")) return "WebM Opus";
  if (mime.startsWith("video/mp4")) return "MP4 (H.264/AAC)";
  if (mime.startsWith("video/webm")) return "WebM (VP8/VP9)";
  return mime;
}

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function includesAudio(mode) { return mode === "audio" || mode === "audiovideo"; }
function includesVideo(mode) { return mode === "video" || mode === "audiovideo"; }

// ─── Audio Visualizer ───────────────────────────────────────────

function AudioVisualizer({ stream, active }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const analyserRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    if (!active || !stream) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        rafRef.current = requestAnimationFrame(draw);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        analyser.getByteFrequencyData(data);
        const barCount = data.length;
        const barW = (W / barCount) * 0.75;
        const gap = (W / barCount) * 0.25;

        for (let i = 0; i < barCount; i++) {
          const val = data[i] / 255;
          const barH = Math.max(2, val * H * 0.9);
          const x = i * (barW + gap);
          const alpha = 0.5 + val * 0.5;
          ctx.fillStyle = `rgba(196,168,124,${alpha})`;
          ctx.beginPath();
          ctx.roundRect
            ? ctx.roundRect(x, H - barH, barW, barH, 2)
            : ctx.rect(x, H - barH, barW, barH);
          ctx.fill();
        }
      }
      draw();
    } catch (e) {
      // Web Audio not available, silently skip
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ctxRef.current) ctxRef.current.close().catch(() => {});
    };
  }, [active, stream]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      style={{
        width: "100%",
        height: 80,
        borderRadius: 12,
        background: "rgba(58,49,41,.06)",
        display: "block",
      }}
    />
  );
}

// ─── Composant principal ─────────────────────────────────────────

export default function RecordStudio() {
  const [recState, setRecState] = useState(STATES.IDLE);
  const [mode, setMode] = useState("audiovideo");
  const [status, setStatus] = useState({ text: "Initialisation…", error: false });
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [currentMime, setCurrentMime] = useState("");

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const blobRef = useRef(null);
  const mimeRef = useRef("");
  const liveRef = useRef(null);
  const playbackRef = useRef(null);
  const urlRef = useRef(null);

  const info = (msg) => setStatus({ text: msg, error: false });
  const err = (msg) => setStatus({ text: msg, error: true });

  const enumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      err("Ce navigateur ne supporte pas l'accès aux périphériques média.");
      return;
    }
    try {
      const tmp = await navigator.mediaDevices
        .getUserMedia({ audio: true, video: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => navigator.mediaDevices.getUserMedia({ video: true })));

      const devs = await navigator.mediaDevices.enumerateDevices();
      if (tmp) tmp.getTracks().forEach((t) => t.stop());

      const mics = devs.filter((d) => d.kind === "audioinput");
      const cams = devs.filter((d) => d.kind === "videoinput");
      setAudioDevices(mics);
      setVideoDevices(cams);
      if (mics.length) setSelectedAudio((prev) => prev || mics[0].deviceId);
      if (cams.length) setSelectedVideo((prev) => prev || cams[0].deviceId);
      info("Périphériques détectés. Prêt.");
    } catch (e) {
      err("Impossible d'accéder aux périphériques : " + e.message);
    }
  }, []);

  useEffect(() => {
    enumerate();
    const h = () => enumerate();
    navigator.mediaDevices?.addEventListener("devicechange", h);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", h);
  }, [enumerate]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  async function acquireStream() {
    const constraints = {};
    if (includesAudio(mode)) {
      constraints.audio = selectedAudio ? { deviceId: { exact: selectedAudio } } : true;
    } else {
      constraints.audio = false;
    }
    if (includesVideo(mode)) {
      constraints.video = { ...VIDEO_HIGH, ...(selectedVideo ? { deviceId: { exact: selectedVideo } } : {}) };
    } else {
      constraints.video = false;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      if (constraints.video && typeof constraints.video === "object") {
        constraints.video = { ...VIDEO_FALLBACK, ...(selectedVideo ? { deviceId: { exact: selectedVideo } } : {}) };
        streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      } else {
        throw new Error("Flux média indisponible.");
      }
    }

    if (includesVideo(mode) && liveRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.muted = true;
      liveRef.current.play().catch(() => {});
    }
  }

  function releaseStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveRef.current) liveRef.current.srcObject = null;
  }

  async function handleStart() {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    blobRef.current = null;
    setPlaybackUrl(null);

    try {
      await acquireStream();
    } catch (e) {
      err("Erreur : " + e.message);
      releaseStream();
      return;
    }

    const candidates = includesVideo(mode) ? MIME_CANDIDATES_VIDEO : MIME_CANDIDATES_AUDIO;
    mimeRef.current = bestMime(candidates);
    setCurrentMime(mimeRef.current);

    const opts = {};
    if (mimeRef.current) opts.mimeType = mimeRef.current;

    try {
      recorderRef.current = new MediaRecorder(streamRef.current, opts);
    } catch (e) {
      err("MediaRecorder impossible : " + e.message);
      releaseStream();
      return;
    }

    chunksRef.current = [];

    recorderRef.current.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorderRef.current.onerror = (e) => {
      err("Erreur enregistrement : " + (e.error?.message || "inconnue"));
      setRecState(STATES.STOPPED);
    };

    recorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeRef.current || "video/webm" });
      blobRef.current = blob;
      chunksRef.current = [];
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPlaybackUrl(url);
      setRecState(STATES.STOPPED);
      info("Enregistrement terminé. Relisez ou téléchargez.");
    };

    recorderRef.current.start(500);
    setRecState(STATES.RECORDING);
    info("Enregistrement en cours…");
  }

  function handlePause() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setRecState(STATES.PAUSED);
      info("En pause.");
    }
  }

  function handleResume() {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setRecState(STATES.RECORDING);
      info("Reprise.");
    }
  }

  function handleStop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    releaseStream();
  }

  function handleDownload() {
    if (!blobRef.current) return;
    const ext = extFromMime(mimeRef.current || "video/webm");
    const prefix = includesVideo(mode) ? "video" : "audio";
    const a = document.createElement("a");
    a.href = urlRef.current;
    a.download = `${prefix}_${ts()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const isActive = recState === STATES.RECORDING || recState === STATES.PAUSED;
  const hasBlob = !!playbackUrl;
  const showVideo = includesVideo(mode);
  const showAudioViz = includesAudio(mode) && isActive && streamRef.current;

  const dotColor =
    recState === STATES.RECORDING ? "bg-red-500 animate-pulse" :
    recState === STATES.PAUSED ? "bg-amber-400" :
    "bg-neutral-500";

  const formatLabel = currentMime ? labelFromMime(currentMime, showVideo) : null;

  return (
    <div
      className="min-h-screen text-neutral-100 flex items-start justify-center p-4 sm:p-8"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#FAF7F2",
        color: "#3A3129",
      }}
    >
      <div className="w-full max-w-xl space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor}`} />
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", color: "#3A3129", margin: 0 }}>
            Enregistreur média
          </h1>
          {formatLabel && isActive && (
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: ".12em",
              textTransform: "uppercase", color: "#A8895E",
              background: "rgba(196,168,124,.15)", padding: "3px 9px",
              borderRadius: 999, marginLeft: "auto"
            }}>
              {formatLabel}
            </span>
          )}
        </div>

        {/* Status */}
        <div style={{
          fontSize: 13, padding: "10px 14px", borderRadius: 12,
          background: status.error ? "rgba(220,38,38,.08)" : "rgba(58,49,41,.06)",
          color: status.error ? "#b91c1c" : "#7A6E63",
          border: `1px solid ${status.error ? "rgba(220,38,38,.2)" : "rgba(107,91,78,.1)"}`,
        }}>
          {status.text}
        </div>

        {/* Config selects */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RecSelect
            id="recordMode"
            label="Mode"
            value={mode}
            onChange={(v) => setMode(v)}
            disabled={isActive}
            options={[
              { value: "audio", label: "Audio" },
              { value: "video", label: "Vidéo" },
              { value: "audiovideo", label: "Audio + Vidéo" },
            ]}
          />
          <RecSelect
            id="audioInputSelect"
            label="Micro"
            value={selectedAudio}
            onChange={setSelectedAudio}
            disabled={isActive || audioDevices.length === 0}
            options={audioDevices.length ? audioDevices.map((d, i) => ({ value: d.deviceId, label: d.label || `Micro ${i + 1}` })) : [{ value: "", label: "Aucun" }]}
          />
          <RecSelect
            id="videoInputSelect"
            label="Caméra"
            value={selectedVideo}
            onChange={setSelectedVideo}
            disabled={isActive || videoDevices.length === 0}
            options={videoDevices.length ? videoDevices.map((d, i) => ({ value: d.deviceId, label: d.label || `Caméra ${i + 1}` })) : [{ value: "", label: "Aucune" }]}
          />
        </div>

        {/* Live video preview */}
        {showVideo && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(107,91,78,.12)", background: "#1a1a1a", aspectRatio: "16/9" }}>
            <video ref={liveRef} className="w-full h-full object-contain" playsInline muted />
          </div>
        )}

        {/* Audio visualizer */}
        {includesAudio(mode) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "#A69A8E", marginBottom: 8 }}>
              Niveau audio
            </div>
            <AudioVisualizer stream={streamRef.current} active={isActive} />
          </div>
        )}

        {/* Format info */}
        {!isActive && !hasBlob && (
          <div style={{ fontSize: 12, color: "#A69A8E", padding: "8px 12px", borderRadius: 10, background: "rgba(58,49,41,.04)", border: "1px solid rgba(107,91,78,.08)" }}>
            {showVideo
              ? "Format cible : MP4 (H.264/AAC). Selon votre navigateur, le format peut être WebM — le fichier restera lisible."
              : "Format cible : M4A (AAC). Selon votre navigateur, le format peut être WebM — le fichier restera lisible."}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          <RecBtn id="startRecordBtn" onClick={handleStart} disabled={isActive} accent>
            ● Démarrer
          </RecBtn>
          <RecBtn id="pauseRecordBtn" onClick={handlePause} disabled={recState !== STATES.RECORDING}>
            ❚❚ Pause
          </RecBtn>
          <RecBtn id="resumeRecordBtn" onClick={handleResume} disabled={recState !== STATES.PAUSED}>
            ▶ Reprendre
          </RecBtn>
          <RecBtn id="stopRecordBtn" onClick={handleStop} disabled={!isActive} danger>
            ■ Arrêter
          </RecBtn>
          <RecBtn id="downloadRecordBtn" onClick={handleDownload} disabled={!hasBlob}>
            ↓ Télécharger {hasBlob && formatLabel ? `(${labelFromMime(mimeRef.current, showVideo)})` : ""}
          </RecBtn>
        </div>

        {/* Playback */}
        {playbackUrl && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "#A69A8E", marginBottom: 10 }}>
              Lecture
            </div>
            <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(107,91,78,.12)", background: "#1a1a1a" }}>
              {showVideo ? (
                <video ref={playbackRef} src={playbackUrl} controls className="w-full" />
              ) : (
                <audio ref={playbackRef} src={playbackUrl} controls className="w-full" style={{ padding: "16px 8px", display: "block" }} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function RecSelect({ id, label, value, onChange, disabled, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "#A69A8E" }}>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: "rgba(58,49,41,.06)", border: "1px solid rgba(107,91,78,.15)",
          borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#3A3129",
          fontFamily: "inherit", outline: "none", appearance: "none",
          opacity: disabled ? .45 : 1, cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function RecBtn({ id, onClick, disabled, children, accent, danger }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    transition: "background .15s ease, transform .1s ease",
    opacity: disabled ? .35 : 1,
    border: "none",
  };
  const variant = accent
    ? { background: "#C4A87C", color: "#fff" }
    : danger
    ? { background: "rgba(220,38,38,.1)", color: "#b91c1c", border: "1px solid rgba(220,38,38,.2)" }
    : { background: "rgba(58,49,41,.08)", color: "#3A3129", border: "1px solid rgba(107,91,78,.12)" };

  return (
    <button id={id} onClick={onClick} disabled={disabled} style={{ ...base, ...variant }}>
      {children}
    </button>
  );
}
