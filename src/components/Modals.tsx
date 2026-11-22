import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, FileJson, Image as ImageIcon, Upload, X } from 'lucide-react';
import type {
  AspectRatioPreset,
  CanvasBackgroundConfig,
  ProjectConfig,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';
import {
  type MediaCache,
  prepareExportFrameMedia,
  renderComposition,
} from '../utils/canvasRenderer';
import { formatTimecode, getCanvasDimensions } from '../utils/timecode';

interface ExportModalProps {
  open: boolean;
  project: ProjectConfig;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  totalDuration: number;
  cache: MediaCache;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  project,
  tracks,
  clips,
  totalDuration,
  cache,
  onClose,
}) => {
  const [exportName, setExportName] = useState(project.name);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>(project.resolution);
  const [fps, setFps] = useState<24 | 30 | 60>(project.fps);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportedBytes, setExportedBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef(false);

  useEffect(() => {
    if (open) {
      abortRef.current = false;
      setExportName(project.name);
      setResolution(project.resolution);
      setFps(project.fps);
      setStatus('idle');
      setProgress(0);
      setExportedBytes(0);
      setErrorMessage('');
    } else {
      abortRef.current = true;
    }
  }, [open, project.name, project.resolution, project.fps]);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  if (!open) return null;

  const durationToExport = Math.max(1, totalDuration);
  const targetDims = getCanvasDimensions(project.aspectRatio, resolution);

  const handleStartExport = async () => {
    abortRef.current = false;
    setStatus('rendering');
    setProgress(0);
    setExportedBytes(0);
    setErrorMessage('');
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    const offscreen = document.createElement('canvas');
    try {
      const dims = getCanvasDimensions(project.aspectRatio, resolution);
      offscreen.width = dims.width;
      offscreen.height = dims.height;
      // Chromium MediaRecorder reliably captures 4K CanvasCaptureMediaStream frames when mounted in the document
      offscreen.style.cssText =
        'position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(offscreen);
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Chromium's MediaRecorder VP9 encoder drops 4K (3840x2160) CanvasCaptureMediaStream frames in software mode,
      // while VP8 reliably encodes full 4K WebM frames with valid headers and keyframes.
      const preferredMimes =
        resolution === '4k'
          ? ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
          : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mimeType =
        preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

      const videoBitsPerSecond =
        resolution === '4k'
          ? 18_000_000
          : resolution === '1080p'
            ? 8_000_000
            : 3_500_000;

      const stream = offscreen.captureStream(0);
      const videoTrack = stream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      recorder.start(100);

      // Cap frame count cleanly so even 4K exports stay fast and responsive in browser
      const exportFps = resolution === '4k' ? Math.min(fps, 10) : Math.min(fps, 24);
      const totalFrames = Math.max(
        12,
        Math.min(resolution === '4k' ? 24 : 110, Math.round(durationToExport * exportFps)),
      );
      const frameIntervalMs = resolution === '4k' ? 12 : Math.min(24, 1000 / exportFps);

      for (let i = 0; i <= totalFrames; i++) {
        if (abortRef.current) {
          if (recorder.state !== 'inactive') recorder.stop();
          return;
        }
        const t = (i / totalFrames) * durationToExport;
        await prepareExportFrameMedia(tracks, clips, t, cache);
        renderComposition(ctx, {
          width: dims.width,
          height: dims.height,
          time: t,
          tracks,
          clips,
          selectedClipId: null,
          showSafeZones: false,
          showSelectionBox: false,
          cache,
          canvasBg: project.canvasBg,
          isPlaying: false,
          isExporting: true,
        });
        videoTrack?.requestFrame?.();
        setProgress(Math.round((i / totalFrames) * 100));
        await new Promise<void>((r) => window.requestAnimationFrame(() => r()));
        await new Promise<void>((r) => window.setTimeout(r, frameIntervalMs));
      }

      await new Promise<void>((r) => window.setTimeout(r, 150));
      if (recorder.state === 'recording') {
        recorder.requestData();
        recorder.stop();
      }
      const blob = await stopped;
      if (abortRef.current) return;
      const url = URL.createObjectURL(blob);
      setExportedBytes(blob.size);
      setDownloadUrl(url);
      setStatus('done');
      setProgress(100);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      offscreen.remove();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export Video"
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50"
    >
      <div className="w-full max-w-md rounded-xl bg-[#1a1a1f] border border-[#2d2d36] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#282830] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Exportar video</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Nombre del archivo</label>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              className="w-full bg-[#121216] border border-[#2c2c35] rounded px-3 py-2 text-white outline-none focus:border-[#00d5dc]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="export-res-select" className="text-zinc-400 block mb-1">
                Resolución
              </label>
              <select
                id="export-res-select"
                data-testid="export-resolution-select"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as typeof resolution)}
                className="w-full bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-2 text-white outline-none"
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
                <option value="4k">4K UHD</option>
              </select>
            </div>
            <div>
              <label htmlFor="export-fps-select" className="text-zinc-400 block mb-1">
                Fotogramas (FPS)
              </label>
              <select
                id="export-fps-select"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)}
                className="w-full bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-2 text-white outline-none"
              >
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-[#131317] border border-[#25252d] p-3 flex items-center justify-between text-zinc-300">
            <div>
              <div>Formato: WebM ({resolution === '4k' ? 'VP8' : 'VP9'})</div>
              <div data-testid="export-dims-label" className="text-[11px] font-timecode text-[#00d5dc] mt-0.5">
                {targetDims.width} × {targetDims.height} px
              </div>
            </div>
            <span className="font-timecode text-zinc-400">
              {formatTimecode(durationToExport, fps)}
            </span>
          </div>

          {status === 'rendering' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-zinc-300">
                <span>Renderizando fotogramas...</span>
                <span data-testid="export-progress-value" className="font-timecode text-[#00d5dc]">
                  {progress}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#24242c] overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-[#00d5dc] transition-all"
                />
              </div>
            </div>
          )}

          {status === 'done' && downloadUrl && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-300">
                <Check className="w-4 h-4 shrink-0" />
                <div>
                  <div>Video listo para descargar</div>
                  <div className="text-[10px] font-timecode text-emerald-200/80">
                    {targetDims.width}×{targetDims.height} · {(exportedBytes / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <a
                data-testid="export-download-link"
                href={downloadUrl}
                download={`${exportName.replace(/\s+/g, '_') || 'klipframe_export'}.webm`}
                className="px-3 py-1.5 rounded bg-emerald-500 text-zinc-950 font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/30 rounded p-2.5">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#282830] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              abortRef.current = true;
              onClose();
            }}
            className="px-4 py-1.5 rounded bg-[#25252d] hover:bg-[#30303a] text-xs font-medium text-zinc-200 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            data-testid="export-start-btn"
            disabled={status === 'rendering'}
            onClick={handleStartExport}
            className="px-4 py-1.5 rounded bg-[#00d5dc] hover:bg-[#00bcc3] disabled:opacity-50 text-xs font-semibold text-[#091214] cursor-pointer"
          >
            {status === 'rendering' ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProjectSettingsModalProps {
  open: boolean;
  project: ProjectConfig;
  onSave: (next: ProjectConfig) => void;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  open,
  project,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState(project);

  useEffect(() => {
    if (open) {
      setDraft(project);
    }
  }, [open, project]);

  if (!open) return null;

  const canvasBg: CanvasBackgroundConfig = draft.canvasBg ?? {
    mode: 'black',
    color: '#070709',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project Settings"
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#1a1a1f] border border-[#2d2d36] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#282830] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Configuración del proyecto</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project settings"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Nombre</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full bg-[#121216] border border-[#2c2c35] rounded px-3 py-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="text-zinc-400 block mb-1">Relación de aspecto</label>
            <select
              value={draft.aspectRatio}
              onChange={(e) =>
                setDraft({ ...draft, aspectRatio: e.target.value as AspectRatioPreset })
              }
              className="w-full bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-2 text-white outline-none"
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 TikTok / Reels</option>
              <option value="1:1">1:1 Square</option>
              <option value="4:3">4:3 Classic</option>
              <option value="21:9">21:9 Cinema</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 block mb-1">Resolución</label>
              <select
                value={draft.resolution}
                onChange={(e) =>
                  setDraft({ ...draft, resolution: e.target.value as ProjectConfig['resolution'] })
                }
                className="w-full bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-2 text-white outline-none"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K UHD</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">FPS</label>
              <select
                value={draft.fps}
                onChange={(e) =>
                  setDraft({ ...draft, fps: Number(e.target.value) as 24 | 30 | 60 })
                }
                className="w-full bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-2 text-white outline-none"
              >
                <option value={24}>24 fps</option>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[#26262f] space-y-2">
            <label className="text-zinc-400 block">Fondo del lienzo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['black', 'Negro'],
                  ['blur', 'Desenfoque'],
                  ['color', 'Color'],
                ] as const
              ).map(([m, lbl]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      canvasBg: { mode: m, color: canvasBg.color },
                    })
                  }
                  className={`py-1.5 rounded border text-[11px] font-medium cursor-pointer ${
                    canvasBg.mode === m
                      ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                      : 'bg-[#121216] border-[#2c2c35] text-zinc-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {canvasBg.mode === 'color' && (
              <div className="flex items-center justify-between bg-[#121216] border border-[#2c2c35] rounded px-2.5 py-1.5">
                <span className="text-zinc-400">Color de fondo</span>
                <input
                  type="color"
                  aria-label="Canvas background color"
                  value={canvasBg.color}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      canvasBg: { mode: 'color', color: e.target.value },
                    })
                  }
                  className="w-6 h-5 bg-transparent border-0 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#282830] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#25252d] text-xs text-zinc-200 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-1.5 rounded bg-[#00d5dc] text-xs font-semibold text-[#091214] cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export const ShortcutsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  if (!open) return null;
  const rows = [
    ['Space', 'Play / Pause'],
    ['V', 'Select cursor tool'],
    ['B', 'Blade split tool'],
    ['Ctrl + B', 'Split clip at playhead'],
    ['Q / W', 'Trim left / right to playhead'],
    ['M', 'Merge selected clip with next'],
    ['K', 'Add timeline marker'],
    ['Del / Backspace', 'Delete selected clip'],
    ['Ctrl + Z', 'Undo'],
    ['Ctrl + Y / Shift+Z', 'Redo'],
    ['Ctrl + C / Ctrl + V', 'Copy / Paste clip'],
    ['Ctrl + D', 'Duplicate selected clip'],
    ['← / →', 'Step 1 frame'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
    >
      <div className="w-full max-w-md rounded-xl bg-[#1a1a1f] border border-[#2d2d36] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#282830] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Atajos de teclado</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-[65vh] overflow-y-auto">
          {rows.map(([keyCombo, desc]) => (
            <div
              key={keyCombo}
              className="flex items-center justify-between py-1.5 border-b border-[#23232a] text-xs"
            >
              <span className="text-zinc-300">{desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#25252d] border border-[#34343f] font-timecode text-[11px] text-[#00d5dc]">
                {keyCombo}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ShareProjectModal: React.FC<{
  open: boolean;
  projectJson: string;
  projectName: string;
  onImportJson: (jsonText: string) => void;
  onClose: () => void;
}> = ({ open, projectJson, projectName, onImportJson, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const handleDownloadJson = () => {
    const blob = new Blob([projectJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.klipframe.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Project File"
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
    >
      <div className="w-full max-w-md rounded-xl bg-[#1a1a1f] border border-[#2d2d36] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#282830] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Archivo del proyecto</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <p className="text-zinc-400">
            Guarda o carga el estado completo de tu edición en formato JSON.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="py-2.5 px-3 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#091214] font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>Descargar JSON</span>
            </button>
            <label className="py-2.5 px-3 rounded bg-[#25252d] hover:bg-[#30303a] text-zinc-100 font-medium flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Cargar JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  file.text().then((txt) => {
                    onImportJson(txt);
                    onClose();
                  });
                }}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(projectJson).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="w-full py-2 rounded bg-[#141418] border border-[#2a2a33] text-zinc-300 hover:text-white cursor-pointer"
          >
            {copied ? 'Copiado al portapapeles' : 'Copiar JSON al portapapeles'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CoverModal: React.FC<{
  open: boolean;
  currentTime: number;
  coverTime: number;
  onSetCoverTime: (t: number) => void;
  onClose: () => void;
}> = ({ open, currentTime, coverTime, onSetCoverTime, onClose }) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Video Cover"
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#1a1a1f] border border-[#2d2d36] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#282830] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Portada del video</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cover dialog"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <ImageIcon className="w-4 h-4 text-[#00d5dc]" />
            <span>
              Fotograma actual de portada:{' '}
              <strong className="font-timecode text-white">{coverTime.toFixed(2)}s</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onSetCoverTime(Number(currentTime.toFixed(2)));
              onClose();
            }}
            className="w-full py-2 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#091214] font-semibold cursor-pointer"
          >
            Usar posición actual del cabezal ({currentTime.toFixed(2)}s)
          </button>
        </div>
      </div>
    </div>
  );
};
