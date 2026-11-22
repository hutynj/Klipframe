import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Maximize2,
  Menu,
  Pause,
  Play,
  SkipBack,
} from 'lucide-react';
import type {
  AspectRatioPreset,
  ProjectConfig,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';
import {
  type BoundingBox,
  type MediaCache,
  renderComposition,
} from '../utils/canvasRenderer';
import type { Translations } from '../utils/i18n';
import { formatTimecode, getCanvasDimensions } from '../utils/timecode';

interface PlayerPanelProps {
  project: ProjectConfig;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  selectedClipId: string | null;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  cache: MediaCache;
  t: Translations;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onChangeAspectRatio: (ratio: AspectRatioPreset) => void;
  onChangePreviewQuality: (q: '540p' | '720p' | '1080p') => void;
  onUpdateClipTransform: (
    clipId: string,
    patch: Partial<TimelineClip['transform']>,
  ) => void;
  onCommitHistory: () => void;
  onSelectClip: (clipId: string | null) => void;
}

const ASPECT_OPTIONS: AspectRatioPreset[] = ['16:9', '9:16', '1:1', '4:3', '21:9'];

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  project,
  tracks,
  clips,
  selectedClipId,
  currentTime,
  totalDuration,
  isPlaying,
  cache,
  t,
  onTogglePlay,
  onSeek,
  onChangeAspectRatio,
  onChangePreviewQuality,
  onUpdateClipTransform,
  onCommitHistory,
  onSelectClip,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastBoxRef = useRef<BoundingBox | null>(null);
  const dragStateRef = useRef<{
    mode: 'move' | 'scale' | 'rotate';
    clipId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origScale: number;
    origRotation: number;
    boxCenterX: number;
    boxCenterY: number;
    startAngleDeg: number;
    moved: boolean;
  } | null>(null);

  const [showSafeZones, setShowSafeZones] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | '50%' | '75%' | '100%'>('fit');
  const [menuOpen, setMenuOpen] = useState(false);
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [assetTick, setAssetTick] = useState(0);

  const previewQuality = project.previewQuality ?? '720p';
  const baseDims = getCanvasDimensions(project.aspectRatio, previewQuality === '1080p' ? '1080p' : '720p');
  const dims =
    previewQuality === '540p'
      ? { width: Math.round(baseDims.width * 0.75), height: Math.round(baseDims.height * 0.75) }
      : baseDims;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lastBoxRef.current = renderComposition(ctx, {
      width: dims.width,
      height: dims.height,
      time: currentTime,
      tracks,
      clips,
      selectedClipId,
      showSafeZones,
      showSelectionBox: !isPlaying,
      cache,
      canvasBg: project.canvasBg,
      isPlaying,
      onAssetLoaded: () => setAssetTick((n) => n + 1),
    });
  }, [
    dims.width,
    dims.height,
    currentTime,
    tracks,
    clips,
    selectedClipId,
    showSafeZones,
    isPlaying,
    cache,
    project.canvasBg,
    assetTick,
  ]);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * dims.width,
      y: ((clientY - rect.top) / rect.height) * dims.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedClipId) return;
    const selectedClip = clips.find((c) => c.id === selectedClipId);
    if (
      !selectedClip ||
      selectedClip.kind === 'audio' ||
      selectedClip.kind === 'effect' ||
      selectedClip.kind === 'filter'
    ) {
      return;
    }

    const pt = getCanvasCoords(e.clientX, e.clientY);
    const box = lastBoxRef.current;

    let mode: 'move' | 'scale' | 'rotate' = 'move';
    const boxCenterX = box?.x ?? dims.width / 2;
    const boxCenterY = box?.y ?? dims.height / 2;

    if (box) {
      const rotRad = (box.rotation * Math.PI) / 180;
      const cos = Math.cos(rotRad);
      const sin = Math.sin(rotRad);
      const toWorld = (lx: number, ly: number) => ({
        x: box.x + lx * cos - ly * sin,
        y: box.y + lx * sin + ly * cos,
      });

      const hw = box.width / 2;
      const hh = box.height / 2;
      const rotHandle = toWorld(0, hh + 38);
      if (Math.hypot(pt.x - rotHandle.x, pt.y - rotHandle.y) < 30) {
        mode = 'rotate';
      } else {
        const corners = [
          toWorld(-hw, -hh),
          toWorld(hw, -hh),
          toWorld(-hw, hh),
          toWorld(hw, hh),
        ];
        for (const c of corners) {
          if (Math.hypot(pt.x - c.x, pt.y - c.y) < 28) {
            mode = 'scale';
            break;
          }
        }
      }
    }

    const startAngleDeg =
      (Math.atan2(pt.y - boxCenterY, pt.x - boxCenterX) * 180) / Math.PI;

    dragStateRef.current = {
      mode,
      clipId: selectedClip.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: selectedClip.transform.x,
      origY: selectedClip.transform.y,
      origScale: selectedClip.transform.scale,
      origRotation: selectedClip.transform.rotation,
      boxCenterX,
      boxCenterY,
      startAngleDeg,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = dragStateRef.current;
    const canvas = canvasRef.current;
    if (!st || !canvas) return;

    if (Math.hypot(e.clientX - st.startClientX, e.clientY - st.startClientY) > 2) {
      st.moved = true;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleFactorX = dims.width / Math.max(1, rect.width);
    const scaleFactorY = dims.height / Math.max(1, rect.height);
    const dx = (e.clientX - st.startClientX) * scaleFactorX;
    const dy = (e.clientY - st.startClientY) * scaleFactorY;

    if (st.mode === 'move') {
      onUpdateClipTransform(st.clipId, {
        x: Math.round(st.origX + dx),
        y: Math.round(st.origY + dy),
      });
    } else if (st.mode === 'rotate') {
      const pt = getCanvasCoords(e.clientX, e.clientY);
      const curAngle =
        (Math.atan2(pt.y - st.boxCenterY, pt.x - st.boxCenterX) * 180) / Math.PI;
      const delta = curAngle - st.startAngleDeg;
      let nextRot = Math.round(st.origRotation + delta);
      if (Math.abs(nextRot) < 3) nextRot = 0;
      onUpdateClipTransform(st.clipId, { rotation: nextRot });
    } else {
      const deltaScale = (dx + dy) / 360;
      const nextScale = Number(
        Math.max(0.2, Math.min(4, st.origScale + deltaScale)).toFixed(2),
      );
      onUpdateClipTransform(st.clipId, {
        scale: nextScale,
        scaleX: nextScale,
        scaleY: nextScale,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current) {
      const didMove = dragStateRef.current.moved;
      dragStateRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (didMove) {
        onCommitHistory();
      }
    }
  };

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_frame.png`;
    a.click();
  };

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const frameStep = 1 / project.fps;

  return (
    <section
      ref={containerRef}
      aria-label={t.player}
      className="flex flex-col bg-[#121215] min-w-0 min-h-0 h-full overflow-hidden select-none"
    >
      {/* Player Header */}
      <div className="h-8 shrink-0 px-3 border-b border-[#222228] flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">{t.player}</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Player options"
            className="p-1 rounded hover:bg-[#23232a] text-zinc-400 hover:text-zinc-200 cursor-pointer"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md bg-[#1e1e24] border border-[#2f2f38] shadow-xl py-1 z-40">
              <button
                type="button"
                onClick={() => {
                  setShowSafeZones((v) => !v);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#2a2a33] flex items-center justify-between cursor-pointer"
              >
                <span>Safe zone grid</span>
                <span className="text-[#00d5dc]">{showSafeZones ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSnapshot();
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#2a2a33] flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-zinc-400" />
                <span>Save frame PNG</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectClip(null);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
              >
                Hide bounding box
              </button>
              <div className="my-1 border-t border-[#2c2c35]" />
              <div className="px-3 py-1 text-[10px] text-zinc-500">Preview Proxy</div>
              <div className="px-2 pb-1 grid grid-cols-3 gap-1">
                {(['540p', '720p', '1080p'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      onChangePreviewQuality(q);
                      setMenuOpen(false);
                    }}
                    className={`py-1 rounded text-[10px] font-timecode cursor-pointer ${
                      previewQuality === q
                        ? 'bg-[#00d5dc] text-[#091214] font-semibold'
                        : 'bg-[#25252e] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden bg-[#0c0c0e]">
        <div
          className="relative flex items-center justify-center max-w-full max-h-full"
          style={{
            aspectRatio: `${dims.width} / ${dims.height}`,
            width:
              zoomMode === '50%'
                ? '50%'
                : zoomMode === '75%'
                  ? '75%'
                  : zoomMode === '100%'
                    ? '100%'
                    : 'auto',
            height: zoomMode === 'fit' ? '100%' : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            data-testid="player-canvas"
            width={dims.width}
            height={dims.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full object-contain rounded-[2px] shadow-2xl border border-[#24242b] bg-black cursor-move"
          />
        </div>
      </div>

      {/* Transport & Aspect Ratio Bar */}
      <div className="h-9 shrink-0 px-3 border-t border-[#222228] bg-[#141418] flex items-center justify-between gap-2">
        {/* Left: Cyan timecode + Safe Grid */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-timecode text-[11px] whitespace-nowrap">
            <span className="text-[#00d5dc] font-medium">
              {formatTimecode(currentTime, project.fps)}
            </span>
            <span className="text-zinc-600 mx-1">/</span>
            <span className="text-zinc-400">
              {formatTimecode(totalDuration, project.fps)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSafeZones((v) => !v)}
            aria-label="Toggle safe zone grid"
            title="Toggle safe zone grid"
            className={`p-1 rounded transition-colors cursor-pointer ${
              showSafeZones
                ? 'text-[#00d5dc] bg-[#222229]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Transport Play/Pause & Step */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSeek(0)}
            aria-label="Jump to start"
            className="p-1.5 rounded hover:bg-[#222228] text-zinc-400 hover:text-white cursor-pointer"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - frameStep))}
            aria-label="Previous frame"
            className="p-1 rounded hover:bg-[#222228] text-zinc-400 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            data-testid="play-toggle-btn"
            className="w-7 h-7 rounded-full bg-[#24242b] hover:bg-[#303039] text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(Math.max(totalDuration, 1), currentTime + frameStep))}
            aria-label="Next frame"
            className="p-1 rounded hover:bg-[#222228] text-zinc-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Zoom + Ratio + Fullscreen */}
        <div className="flex items-center gap-1.5 relative">
          <select
            aria-label="Preview zoom"
            value={zoomMode}
            onChange={(e) => setZoomMode(e.target.value as typeof zoomMode)}
            className="bg-[#202026] hover:bg-[#292930] text-[11px] text-zinc-300 rounded px-1.5 py-0.5 border border-[#2c2c34] outline-none cursor-pointer"
          >
            <option value="fit">Fit</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
            <option value="100%">100%</option>
          </select>

          <div className="relative">
            <button
              type="button"
              onClick={() => setRatioMenuOpen((v) => !v)}
              aria-label="Change aspect ratio"
              className="px-2 py-0.5 rounded bg-[#202026] hover:bg-[#292930] border border-[#2c2c34] text-[11px] text-zinc-200 font-medium cursor-pointer whitespace-nowrap"
            >
              Ratio: {project.aspectRatio}
            </button>
            {ratioMenuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-28 rounded-md bg-[#1e1e24] border border-[#2f2f38] shadow-xl py-1 z-40">
                {ASPECT_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onChangeAspectRatio(r);
                      setRatioMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2a2a33] cursor-pointer flex items-center justify-between ${
                      project.aspectRatio === r ? 'text-[#00d5dc]' : 'text-zinc-200'
                    }`}
                  >
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Toggle fullscreen"
            className="p-1 rounded hover:bg-[#222228] text-zinc-400 hover:text-white cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
