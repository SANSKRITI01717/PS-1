import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  ScanLine,
  Play,
  Search,
  RefreshCw
} from 'lucide-react';

const MAX_IMAGE_SIDE = 2000;   // larger photos/frames are shrunk before upload (faster on free hosting)
// How many frames of a video are analysed (more = fewer missed plates, but slower)
const DETAIL = {
  quick:    { label: 'Quick',    fps: 1, cap: 10, hint: 'about 1 frame per second, up to 10 frames' },
  balanced: { label: 'Balanced', fps: 2, cap: 20, hint: 'about 2 frames per second, up to 20 frames' },
  thorough: { label: 'Thorough', fps: 3, cap: 40, hint: 'about 3 frames per second, up to 40 frames' }
};
const framesFor = (duration, d) => Math.max(1, Math.min(d.cap, Math.round((duration || 1) * d.fps)));
const MAX_VIDEO_MB = 150;

const card = {
  backgroundColor: '#ffffff',
  border: '1px solid var(--border-subtle)',
  borderRadius: '10px',
  boxShadow: 'var(--shadow-card)'
};
const smallLabel = {
  fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em'
};

// ---------- helpers ----------
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read this image file.'));
    img.src = url;
  });
}

function canvasToBlob(canvas, quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode frame.'))), 'image/jpeg', quality)
  );
}

// Returns { blob, width, height, previewUrl } ready to upload
async function prepareImage(file) {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(srcUrl);
    const w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
    if (scale === 1 && file.size <= 8 * 1024 * 1024) {
      return { blob: file, width: w, height: h, previewUrl: srcUrl };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    URL.revokeObjectURL(srcUrl);
    return { blob, width: canvas.width, height: canvas.height, previewUrl: URL.createObjectURL(blob) };
  } catch (e) {
    URL.revokeObjectURL(srcUrl);
    throw e;
  }
}

// Pull evenly spaced frames out of a video, in the browser (how many depends on the detail level).
async function extractVideoFrames(file, onProgress, detail) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise((res, rej) => {
      video.onloadeddata = res;
      video.onerror = () => rej(new Error('This video format cannot be read by the browser. Please use an MP4 (H.264).'));
    });
    const duration = isFinite(video.duration) ? video.duration : 0;
    const count = framesFor(duration, detail);
    const step = duration > 0 ? duration / count : 0;
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    const frames = [];
    for (let i = 0; i < count; i++) {
      const t = Math.max(0, Math.min(duration - 0.05, step * i + step / 2));
      await new Promise((res) => {
        video.onseeked = res;
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, 0.9);
      frames.push({ blob, width: canvas.width, height: canvas.height, previewUrl: URL.createObjectURL(blob), time: t });
      if (onProgress) onProgress(i + 1, count);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// group every plate read across all frames -> one row per plate
function aggregate(frames, isVideo, clock) {
  const map = new Map();
  frames.forEach((f, idx) => {
    const records = (f.result && f.result.records) || [];
    records.forEach((r) => {
      if (!r.plateNumber) return;
      const row = map.get(r.plateNumber) || { plate: r.plateNumber, confs: [], frameIdx: new Set(), times: [], alert: false };
      row.confs.push(r.confidence);
      row.frameIdx.add(idx);
      if (f.time != null) row.times.push(f.time);
      if (r.alertTriggered) row.alert = true;
      map.set(r.plateNumber, row);
    });
  });
  return [...map.values()]
    .map((r) => ({
      plate: r.plate,
      confidence: r.confs.reduce((a, b) => a + b, 0) / r.confs.length,
      occurrences: r.frameIdx.size,
      alert: r.alert,
      timing: isVideo && r.times.length
        ? (Math.min(...r.times) === Math.max(...r.times) ? fmtTime(r.times[0]) : `${fmtTime(Math.min(...r.times))} – ${fmtTime(Math.max(...r.times))}`)
        : clock
    }))
    .sort((a, b) => b.occurrences - a.occurrences || b.confidence - a.confidence);
}

// ---------- boxes drawn over a picture ----------
function Boxes({ records, width, height }) {
  return (records || []).filter((r) => r.bbox && r.bbox.x2 > r.bbox.x1).map((r, i) => (
    <div key={i} style={{
      position: 'absolute',
      left: `${(r.bbox.x1 / width) * 100}%`,
      top: `${(r.bbox.y1 / height) * 100}%`,
      width: `${((r.bbox.x2 - r.bbox.x1) / width) * 100}%`,
      height: `${((r.bbox.y2 - r.bbox.y1) / height) * 100}%`,
      border: '2px solid #22c55e',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
      pointerEvents: 'none'
    }}>
      <span style={{
        position: 'absolute', bottom: '100%', left: '-2px', lineHeight: 1.3, backgroundColor: '#16a34a', color: '#fff',
        fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '1px 6px', whiteSpace: 'nowrap'
      }}>{r.plateNumber}</span>
    </div>
  ));
}

// small card in the frame-by-frame strip
function FrameThumb({ frame, index, onSeek }) {
  const records = (frame.result && frame.result.records) || [];
  return (
    <div style={{ ...card, overflow: 'hidden', cursor: frame.time != null ? 'pointer' : 'default' }}
      onClick={() => frame.time != null && onSeek(frame.time)}>
      <div style={{ position: 'relative', backgroundColor: '#0f172a', lineHeight: 0 }}>
        <img src={frame.previewUrl} alt={`Frame ${index + 1}`} style={{ width: '100%', display: 'block' }} />
        <Boxes records={records} width={frame.width} height={frame.height} />
      </div>
      <div style={{ padding: '8px 10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span>Frame {index + 1}{frame.time != null ? ` · ${fmtTime(frame.time)}` : ''}</span>
          {frame.result && frame.result.inferenceTimeMs != null && <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(frame.result.inferenceTimeMs)} ms</span>}
        </div>
        <div style={{ marginTop: '3px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: records.length ? 'var(--text-main)' : 'var(--text-faint)' }}>
          {frame.status === 'error' ? <span style={{ color: '#b91c1c', fontFamily: 'var(--font-sans)' }}>Failed</span>
            : records.length ? records.map((r) => r.plateNumber).join(', ') : 'No plate'}
        </div>
      </div>
    </div>
  );
}

// ---------- main view ----------
export default function UploadDetect({ onNavigateToTrajectory }) {
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');
  const [minConf, setMinConf] = useState(0.25);
  const [ocrFloor, setOcrFloor] = useState(0.45);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState('video');          // video first; photo is the second option
  const [detail, setDetail] = useState('balanced');
  const [videoDuration, setVideoDuration] = useState(0);

  const [file, setFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaDims, setMediaDims] = useState(null);
  const [phase, setPhase] = useState('idle');        // idle | ready | running | done
  const [progress, setProgress] = useState({ pct: 0, label: '' });
  const [frames, setFrames] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);   // live timer while running, final time when done
  const [clock, setClock] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const [curTime, setCurTime] = useState(0);
  const [mlStatus, setMlStatus] = useState(null);
  const [checkTick, setCheckTick] = useState(0);

  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const runId = useRef(0);
  const t0 = useRef(0);

  const isVideo = !!file && file.type.startsWith('video/');
  const busy = phase === 'running';

  // cameras
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/cameras');
        const data = await res.json();
        if (data.success && data.data.length) {
          setCameras(data.data);
          setCameraId(data.data[0].cameraId);
        }
      } catch (e) { /* backend may be waking up */ }
    })();
  }, []);

  // AI engine connection status. Opening this tab also wakes a sleeping ML service.
  useEffect(() => {
    let stop = false, timer;
    const check = async () => {
      let next = null;
      try {
        const res = await fetch('/api/ml/status');
        const data = await res.json();
        if (data && data.success) next = data;
      } catch (e) { next = { mode: 'unknown', online: false, waking: true }; }
      if (stop) return;
      setMlStatus(next);
      timer = setTimeout(check, next && next.online ? 60000 : 6000);
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, [checkTick]);

  // live timer
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setElapsedSec((performance.now() - t0.current) / 1000), 200);
    return () => clearInterval(t);
  }, [busy]);

  const patchFrame = (idx, patch) => setFrames((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const reset = () => {
    runId.current++;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setFile(null); setMediaUrl(''); setMediaDims(null); setFrames([]);
    setPhase('idle'); setNotice(''); setFilter(''); setProgress({ pct: 0, label: '' }); setElapsedSec(0);
  };

  const switchMode = (m) => {
    if (m === mode || busy) return;
    if (file) reset();
    setMode(m);
  };

  const selectFile = (f) => {
    if (!f || busy) return;
    const video = f.type.startsWith('video/');
    const image = f.type.startsWith('image/');
    if (!video && !image) { setNotice('Please choose an image (JPG, PNG, WEBP) or a short video (MP4).'); return; }
    if (video && f.size > MAX_VIDEO_MB * 1024 * 1024) { setNotice(`Video is too large (max ${MAX_VIDEO_MB} MB).`); return; }
    if (f.size > 200 * 1024 * 1024) { setNotice('File is too large.'); return; }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    runId.current++;
    setMode(video ? 'video' : 'photo');
    setNotice(''); setFrames([]); setFilter(''); setElapsedSec(0); setCurTime(0); setMediaDims(null); setVideoDuration(0);
    setFile(f);
    setMediaUrl(URL.createObjectURL(f));
    setPhase('ready');
  };

  const sendFrame = async (blob) => {
    const body = new FormData();
    body.append('image', blob, `upload_${Date.now()}.jpg`);
    body.append('cameraId', cameraId || 'CAM-IND-01');
    body.append('minConf', String(minConf));
    body.append('ocrFloor', String(ocrFloor));
    let res;
    try {
      res = await fetch('/api/detections/process-image', { method: 'POST', body });
    } catch (e) {
      throw new Error('Cannot reach the server. It may be waking up – wait 30 seconds and try again.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!data) throw new Error(`Server error (${res.status}). Please try again.`);
    if (!data.success) throw new Error(data.error || data.message || 'AI service could not process this image.');
    return data;
  };

  const startAnalysis = async () => {
    if (!file || busy) return;
    const myRun = ++runId.current;
    const alive = () => runId.current === myRun;
    setNotice(''); setFrames([]); setFilter('');
    t0.current = performance.now();
    setElapsedSec(0);
    setPhase('running');
    setProgress({ pct: 2, label: isVideo ? 'Extracting frames from video…' : 'Preparing image…' });
    try {
      let prepared;
      if (isVideo) {
        prepared = await extractVideoFrames(file, (i, n) => alive() && setProgress({ pct: 2 + (13 * i) / n, label: `Extracting frames… ${i}/${n}` }), DETAIL[detail]);
      } else {
        const p = await prepareImage(file);
        prepared = [{ ...p, time: null }];
      }
      if (!alive()) return;
      const list = prepared.map((p) => ({ previewUrl: p.previewUrl, width: p.width, height: p.height, time: p.time, status: 'queued' }));
      setFrames(list);
      const n = prepared.length;
      for (let i = 0; i < n; i++) {
        if (!alive()) return;
        setProgress({ pct: 15 + (80 * i) / n, label: `Detecting & reading plates… frame ${i + 1}/${n}` });
        patchFrame(i, { status: 'processing' });
        try {
          const data = await sendFrame(prepared[i].blob);
          if (!alive()) return;
          patchFrame(i, { status: 'done', result: data });
        } catch (e) {
          if (!alive()) return;
          patchFrame(i, { status: 'error', error: e.message });
        }
      }
      if (!alive()) return;
      setProgress({ pct: 98, label: 'Deduplicating and generating final results…' });
      await new Promise((r) => setTimeout(r, 350));
      if (!alive()) return;
      setElapsedSec((performance.now() - t0.current) / 1000);
      setClock(new Date().toLocaleTimeString());
      setProgress({ pct: 100, label: 'Deduplicating and generating final results…' });
      setPhase('done');
    } catch (e) {
      if (!alive()) return;
      setNotice(e.message || 'Something went wrong while reading the file.');
      setPhase('ready');
    }
  };

  // ---- derived ----
  const rows = useMemo(() => aggregate(frames, isVideo, clock), [frames, isVideo, clock]);
  const shownRows = rows.filter((r) => r.plate.includes(filter.trim().toUpperCase()));
  const avgConf = rows.length ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length : 0;
  const errors = frames.filter((f) => f.status === 'error');
  const allFailed = frames.length > 0 && errors.length === frames.length;

  // boxes over the player: nearest analysed frame to the current playback time
  const activeFrame = useMemo(() => {
    if (!frames.length || !frames.some((f) => f.result)) return null;
    if (!isVideo) return frames[0];
    return frames.reduce((best, f) => (Math.abs(f.time - curTime) < Math.abs(best.time - curTime) ? f : best), frames[0]);
  }, [frames, isVideo, curTime]);

  const dims = mediaDims || (frames[0] ? { w: frames[0].width, h: frames[0].height } : null);
  const ratio = dims ? dims.w / dims.h : 16 / 9;
  const mlNone = mlStatus && mlStatus.mode === 'none';

  const engine = busy
    ? { color: '#2563eb', text: 'AI engine is analysing your file…' }
    : !mlStatus
    ? { color: '#94a3b8', text: 'Checking AI engine…' }
    : mlStatus.online
      ? { color: '#16a34a', text: mlStatus.mode === 'local' ? 'AI engine ready (local)' : `AI engine connected${mlStatus.latencyMs ? ` · ${mlStatus.latencyMs} ms` : ''}` }
      : mlStatus.mode === 'none'
        ? { color: '#dc2626', text: 'AI engine not connected yet' }
        : { color: '#d97706', text: 'AI engine is waking up… (up to 1 minute)' };

  const seek = (t) => { if (videoRef.current) { videoRef.current.currentTime = t; setCurTime(t); } };

  const bigNumber = (value, color) => (
    <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-mono)', color, marginTop: '4px', lineHeight: 1.1 }}>{value}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <style>{`
        .ud-spin{animation:ud-rot 1s linear infinite}@keyframes ud-rot{to{transform:rotate(360deg)}}
        .ud-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
        @media(max-width:1000px){.ud-grid{grid-template-columns:minmax(0,1fr)}}
      `}</style>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ScanLine size={20} color="var(--accent-blue)" /> Upload & Detect
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          Upload a vehicle video (or a single photo). The AI finds the number plates, reads them and logs them to the chosen camera,
          so they appear on the Command Center, trajectory map and alerts.
        </p>
      </div>

      <div className="ud-grid">
        {/* ---------------- left: media + progress + results ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '3px', gap: '2px', backgroundColor: '#e2e8f0', borderRadius: '8px' }}>
            {[['video', 'Video', Film], ['photo', 'Photo', ImageIcon]].map(([m, label, Icon]) => (
              <button key={m} onClick={() => switchMode(m)} disabled={busy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer', backgroundColor: mode === m ? '#ffffff' : 'transparent', color: mode === m ? '#1d4ed8' : '#475569',
                  boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {phase === 'idle' ? (
            <div
              onClick={() => inputRef.current && inputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); selectFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current.click(); }}
              style={{
                ...card, border: `2px dashed ${dragOver ? 'var(--accent-blue)' : 'var(--border-medium)'}`,
                backgroundColor: dragOver ? 'var(--accent-blue-subtle)' : '#f8fafc',
                padding: '64px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}>
              <UploadCloud size={38} color="var(--accent-blue)" />
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '10px' }}>{mode === 'video' ? 'Drag & drop a vehicle video here' : 'Drag & drop a vehicle photo here'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>or click to browse</div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '10px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {mode === 'video'
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Film size={12} /> MP4 · WEBM · MOV, up to {MAX_VIDEO_MB} MB. Frames are checked for plates ({DETAIL[detail].hint}).</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={12} /> JPG · PNG · WEBP</span>}
              </div>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {/* player / picture with boxes */}
              <div style={{ backgroundColor: '#000', display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: `min(100%, ${480 * ratio}px)`, aspectRatio: String(ratio) }}>
                  {isVideo ? (
                    <video ref={videoRef} src={mediaUrl} controls playsInline
                      onLoadedMetadata={(e) => { setMediaDims({ w: e.target.videoWidth, h: e.target.videoHeight }); setVideoDuration(e.target.duration || 0); }}
                      onTimeUpdate={(e) => setCurTime(e.target.currentTime)}
                      onSeeked={(e) => setCurTime(e.target.currentTime)}
                      style={{ width: '100%', height: '100%', display: 'block' }} />
                  ) : (
                    <img src={mediaUrl} alt={file ? file.name : ''}
                      onLoad={(e) => setMediaDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                      style={{ width: '100%', height: '100%', display: 'block' }} />
                  )}
                  {activeFrame && <Boxes records={activeFrame.result && activeFrame.result.records} width={activeFrame.width} height={activeFrame.height} />}
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: 0 }}>
                  Selected: <strong style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{file && file.name}</strong> {file && `(${fmtSize(file.size)})`}{isVideo && videoDuration > 0 && phase !== 'done' ? ` · will check ${framesFor(videoDuration, DETAIL[detail])} frames` : ''}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => inputRef.current && inputRef.current.click()} disabled={busy}
                    style={{ backgroundColor: '#fff', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1 }}>
                    Change {isVideo ? 'Video' : 'File'}
                  </button>
                  <button onClick={startAnalysis} disabled={busy || mlNone}
                    title={mlNone ? 'The AI engine is not connected yet' : ''}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: busy || mlNone ? 'not-allowed' : 'pointer', opacity: busy || mlNone ? 0.55 : 1 }}>
                    {busy ? <Loader2 size={14} className="ud-spin" /> : <Play size={14} />}
                    {busy ? 'Analysing…' : phase === 'done' ? 'Analyse Again' : 'Start ANPR Analysis'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" accept={mode === 'video' ? 'video/*' : 'image/*'} style={{ display: 'none' }}
            onChange={(e) => { selectFile(e.target.files[0]); e.target.value = ''; }} />

          {notice && (
            <div style={{ fontSize: '12px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px' }}>{notice}</div>
          )}

          {/* progress */}
          {(phase === 'running' || phase === 'done') && (
            <div style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px' }}>
                <span>{progress.label}</span><span>{Math.round(progress.pct)}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress.pct}%`, backgroundColor: 'var(--accent-blue)', transition: 'width 0.3s ease' }} />
              </div>
              {busy && elapsedSec > 8 && frames.every((f) => f.status !== 'done') && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#92400e' }}>
                  The AI server is on free hosting and sleeps when idle, so the first analysis can take up to a minute. After that it is fast.
                </div>
              )}
            </div>
          )}

          {/* errors */}
          {phase === 'done' && errors.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{allFailed ? errors[0].error : `${errors.length} of ${frames.length} frames could not be processed (${errors[0].error})`}</span>
            </div>
          )}

          {/* verified OCR results */}
          {phase === 'done' && !allFailed && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Checked <strong>{frames.length}</strong> frame{frames.length > 1 ? 's' : ''}:{' '}
              <strong>{frames.filter((f) => f.result && (f.result.records || []).length > 0).length}</strong> with a readable plate,{' '}
              <strong>{frames.filter((f) => f.status === 'done' && !(f.result && (f.result.records || []).length > 0)).length}</strong> without
              {errors.length > 0 && <>, <strong style={{ color: '#b91c1c' }}>{errors.length} failed</strong></>}.
            </div>
          )}
          {phase === 'done' && !allFailed && (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                  <CheckCircle2 size={16} color="#16a34a" /> Verified OCR Results
                </div>
                <label style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter plate…"
                    style={{ padding: '6px 10px 6px 26px', border: '1px solid var(--border-medium)', borderRadius: '6px', fontSize: '12px', width: '160px', fontFamily: 'var(--font-sans)' }} />
                </label>
              </div>
              {rows.length === 0 ? (
                <div style={{ padding: '22px 16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No readable number plate was found. Try a clearer, closer picture, or lower the sensitivity.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        {['Number plate', 'Confidence', 'Occurrences', 'Timing', ''].map((h) => (
                          <th key={h} style={{ ...smallLabel, padding: '10px 16px', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shownRows.map((r) => (
                        <tr key={r.plate} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '13px', backgroundColor: '#f1f5f9', border: '1px solid var(--border-subtle)', borderRadius: '5px', padding: '3px 8px' }}>{r.plate}</span>
                            {r.alert && <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', padding: '1px 5px' }}>BLACKLIST</span>}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: r.confidence >= 0.85 ? '#16a34a' : '#d97706' }}>{(r.confidence * 100).toFixed(1)}%</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{r.occurrences} frame{r.occurrences > 1 ? 's' : ''}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{r.timing}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <button onClick={() => onNavigateToTrajectory && onNavigateToTrajectory(r.plate)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                              <Navigation size={11} /> Track
                            </button>
                          </td>
                        </tr>
                      ))}
                      {shownRows.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-faint)' }}>No plate matches “{filter}”.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {rows.length > 0 && (
                <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-faint)', borderTop: '1px solid var(--border-subtle)' }}>
                  Logged to {cameraId || 'CAM-IND-01'}. The same plate seen again within 5 seconds is counted here but not logged twice.
                </div>
              )}
            </div>
          )}

          {/* frames */}
          {isVideo && frames.length > 0 && phase !== 'idle' && (
            <div>
              <div style={{ ...smallLabel, marginBottom: '8px' }}>Analysed frames · click one to jump to it in the video</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' }}>
                {frames.map((f, i) => <FrameThumb key={i} frame={f} index={i} onSeek={seek} />)}
              </div>
            </div>
          )}
        </div>

        {/* ---------------- right: engine, settings, stats ---------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ ...card, padding: '12px 14px' }}>
            <div style={{ ...smallLabel }}>AI engine</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: engine.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{engine.text}</span>
              <button onClick={() => { setMlStatus(null); setCheckTick((t) => t + 1); }} title="Check again"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px' }}>
                <RefreshCw size={13} />
              </button>
            </div>
            {mlNone && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#b91c1c', lineHeight: 1.5 }}>
                The ML service link has not been added yet. Add it in <code>server/ml-config.json</code> and redeploy.
              </div>
            )}
          </div>

          <div style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...smallLabel }}>
              Log to camera
              <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} disabled={busy}
                style={{ padding: '7px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '12px', fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--text-main)', backgroundColor: '#fff' }}>
                {cameras.length === 0 && <option value="">CAM-IND-01 (default)</option>}
                {cameras.map((c) => <option key={c.cameraId} value={c.cameraId}>{c.cameraId} – {c.name}</option>)}
              </select>
            </label>
            {mode === 'video' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...smallLabel }}>
                Video detail
                <select value={detail} onChange={(e) => setDetail(e.target.value)} disabled={busy}
                  style={{ padding: '7px 8px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '12px', fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: 'var(--text-main)', backgroundColor: '#fff' }}>
                  {Object.entries(DETAIL).map(([k, d]) => <option key={k} value={k}>{d.label} (up to {d.cap} frames)</option>)}
                </select>
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: '10px', color: 'var(--text-faint)' }}>More frames find more plates but take longer.</span>
              </label>
            )}
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Plate detection threshold: <strong>{minConf.toFixed(2)}</strong></span>
              <input type="range" min="0.05" max="0.9" step="0.05" value={minConf} disabled={busy} onChange={(e) => setMinConf(parseFloat(e.target.value))} />
            </label>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Minimum text confidence: <strong>{ocrFloor.toFixed(2)}</strong></span>
              <input type="range" min="0.1" max="0.95" step="0.05" value={ocrFloor} disabled={busy} onChange={(e) => setOcrFloor(parseFloat(e.target.value))} />
            </label>
          </div>

          <div style={{ ...card, padding: '12px 14px', borderLeft: '3px solid var(--accent-blue)' }}>
            <div style={smallLabel}>Unique plates detected</div>
            {bigNumber(phase === 'done' ? rows.length : '—', 'var(--text-main)')}
          </div>
          <div style={{ ...card, padding: '12px 14px', borderLeft: '3px solid var(--accent-emerald)' }}>
            <div style={smallLabel}>Average confidence</div>
            {bigNumber(phase === 'done' && rows.length ? `${(avgConf * 100).toFixed(1)}%` : '—', phase === 'done' && rows.length ? '#16a34a' : 'var(--text-faint)')}
          </div>
          <div style={{ ...card, padding: '12px 14px', borderLeft: '3px solid var(--accent-purple)' }}>
            <div style={smallLabel}>Processing time</div>
            {bigNumber(phase === 'done' || busy ? `${elapsedSec.toFixed(1)}s` : '—', 'var(--text-main)')}
          </div>
        </div>
      </div>
    </div>
  );
}
