import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  BookmarkPlus,
  Copy,
  Diamond,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Layers,
  Lock,
  Magnet,
  Maximize,
  Merge,
  Mic,
  MousePointer2,
  Music,
  Plus,
  Redo2,
  RefreshCcw,
  Scissors,
  Snowflake,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlink,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { TimelineClip, TimelineMarker, TimelineTrack } from '../types/editor';
import type { Translations } from '../utils/i18n';
import {
  formatRulerTime,
  formatTimecode,
  getRulerStepSeconds,
  pxToTime,
  timeToPx,
} from '../utils/timecode';
import { snapTime, trimClipEdge } from '../utils/timelineOps';

interface TimelinePanelProps {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  selectedClipId: string | null;
  currentTime: number;
  totalDuration: number;
  fps: number;
  pxPerSecond: number;
  toolMode: 'select' | 'blade';
  snapEnabled: boolean;
  rippleEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isRecordingVoice: boolean;
  t: Translations;
  onChangeToolMode: (mode: 'select' | 'blade') => void;
  onUndo: () => void;
  onRedo: () => void;
  onSplitAtPlayhead: () => void;
  onSplitClipAt: (clipId: string, time: number) => void;
  onDeleteLeft: () => void;
  onDeleteRight: () => void;
  onDeleteSelected: () => void;
  onMergeSelected: () => void;
  canMerge: boolean;
  onDuplicateSelected: () => void;
  onCopySelected: () => void;
  onPasteClip: () => void;
  canPaste: boolean;
  onFreezeFrame: () => void;
  onReverseSelected: () => void;
  onDetachAudioSelected: () => void;
  onToggleKeyframeSelected: () => void;
  onAddMarker: () => void;
  onRemoveMarker: (markerId: string) => void;
  onAddTrack: (type: 'overlay' | 'audio') => void;
  onToggleRecordVoice: () => void;
  onToggleSnap: () => void;
  onToggleRipple: () => void;
  onChangeZoom: (pxPerSec: number) => void;
  onFitZoom: () => void;
  onSeek: (time: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onToggleTrackFlag: (trackId: string, flag: 'locked' | 'hidden' | 'muted') => void;
  onUpdateClipNoHistory: (
    clipId: string,
    updater: (clip: TimelineClip) => TimelineClip,
  ) => void;
  onCommitHistory: () => void;
  onDropAssetOnTimeline: (assetId: string, time: number) => void;
  onOpenCoverModal: () => void;
  onLoadSampleProject: () => void;
  onClearTimeline: () => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  tracks,
  clips,
  markers,
  selectedClipId,
  currentTime,
  totalDuration,
  fps,
  pxPerSecond,
  toolMode,
  snapEnabled,
  rippleEnabled,
  canUndo,
  canRedo,
  isRecordingVoice,
  t,
  onChangeToolMode,
  onUndo,
  onRedo,
  onSplitAtPlayhead,
  onSplitClipAt,
  onDeleteLeft,
  onDeleteRight,
  onDeleteSelected,
  onMergeSelected,
  canMerge,
  onDuplicateSelected,
  onCopySelected,
  onPasteClip,
  canPaste,
  onFreezeFrame,
  onReverseSelected,
  onDetachAudioSelected,
  onToggleKeyframeSelected,
  onAddMarker,
  onRemoveMarker,
  onAddTrack,
  onToggleRecordVoice,
  onToggleSnap,
  onToggleRipple,
  onChangeZoom,
  onFitZoom,
  onSeek,
  onSelectClip,
  onToggleTrackFlag,
  onUpdateClipNoHistory,
  onCommitHistory,
  onDropAssetOnTimeline,
  onOpenCoverModal,
  onLoadSampleProject,
  onClearTimeline,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    clip: TimelineClip;
  } | null>(null);

  const timelineSpanSeconds = Math.max(30, totalDuration + 12);
  const timelineWidthPx = Math.max(900, Math.ceil(timelineSpanSeconds * pxPerSecond));

  const rulerTicks = useMemo(() => {
    const { majorStep, minorStep } = getRulerStepSeconds(pxPerSecond);
    const ticks: Array<{ time: number; major: boolean }> = [];
    const count = Math.floor(timelineSpanSeconds / minorStep);
    for (let i = 0; i <= count; i++) {
      const sec = Number((i * minorStep).toFixed(2));
      const isMajor = Math.abs(sec % majorStep) < 0.001 || Math.abs((sec % majorStep) - majorStep) < 0.001;
      ticks.push({ time: sec, major: isMajor });
    }
    return ticks;
  }, [pxPerSecond, timelineSpanSeconds]);

  const seekFromClientX = (clientX: number) => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const xInside = clientX - rect.left + scroller.scrollLeft;
    const target = Math.max(0, pxToTime(xInside, pxPerSecond));
    onSeek(Number(target.toFixed(3)));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDraggingPlayhead(true);
    seekFromClientX(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingPlayhead) return;
    seekFromClientX(e.clientX);
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPlayhead) {
      setDraggingPlayhead(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleClipDragStart = (
    e: React.PointerEvent<HTMLDivElement>,
    clip: TimelineClip,
    mode: 'move' | 'trim-left' | 'trim-right',
  ) => {
    e.stopPropagation();

    if (toolMode === 'blade' && mode === 'move') {
      const scroller = scrollContainerRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const clickTime = pxToTime(
          e.clientX - rect.left + scroller.scrollLeft,
          pxPerSecond,
        );
        onSplitClipAt(clip.id, clickTime);
      }
      return;
    }

    onSelectClip(clip.id);
    const track = tracks.find((tr) => tr.id === clip.trackId);
    if (track?.locked) return;

    const startClientX = e.clientX;
    const origClip = { ...clip };
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      if (Math.abs(dx) > 2) moved = true;
      const deltaSec = dx / pxPerSecond;

      if (mode === 'move') {
        const rawStart = Math.max(0, origClip.startTime + deltaSec);
        const snapped = snapTime(
          rawStart,
          clips,
          currentTime,
          origClip.id,
          snapEnabled,
          0.25,
        );
        onUpdateClipNoHistory(origClip.id, (c) => ({
          ...c,
          startTime: snapped,
        }));
      } else if (mode === 'trim-left') {
        onUpdateClipNoHistory(origClip.id, () =>
          trimClipEdge(origClip, 'left', deltaSec),
        );
      } else {
        onUpdateClipNoHistory(origClip.id, () =>
          trimClipEdge(origClip, 'right', deltaSec),
        );
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) {
        onCommitHistory();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const playheadX = timeToPx(currentTime, pxPerSecond);

  return (
    <section
      aria-label="Timeline"
      className="flex flex-col bg-[#141417] border-t border-[#26262c] min-w-0 min-h-0 h-full select-none overflow-hidden"
    >
      {/* Timeline Toolbar */}
      <div className="h-9 shrink-0 px-3 border-b border-[#232329] bg-[#16161a] flex items-center justify-between gap-2 overflow-x-auto">
        {/* Left tool cluster */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-[#202026] rounded p-0.5 border border-[#2b2b33] mr-1">
            <button
              type="button"
              onClick={() => onChangeToolMode('select')}
              title={t.toolbar.select}
              aria-label={t.toolbar.select}
              className={`p-1 rounded cursor-pointer transition-colors ${
                toolMode === 'select'
                  ? 'bg-[#2f2f38] text-[#00d5dc]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeToolMode('blade')}
              title={t.toolbar.blade}
              aria-label={t.toolbar.blade}
              className={`p-1 rounded cursor-pointer transition-colors ${
                toolMode === 'blade'
                  ? 'bg-[#2f2f38] text-[#00d5dc]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
          </div>

          <ToolbarIconButton
            icon={Undo2}
            label={t.toolbar.undo}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolbarIconButton
            icon={Redo2}
            label={t.toolbar.redo}
            disabled={!canRedo}
            onClick={onRedo}
          />
          <div className="w-px h-4 bg-[#2a2a32] mx-1" />
          <ToolbarIconButton
            icon={Scissors}
            label={t.toolbar.split}
            onClick={onSplitAtPlayhead}
            testId="timeline-split-btn"
          />
          <ToolbarIconButton
            icon={ArrowLeftToLine}
            label={t.toolbar.deleteLeft}
            disabled={!selectedClipId}
            onClick={onDeleteLeft}
          />
          <ToolbarIconButton
            icon={ArrowRightToLine}
            label={t.toolbar.deleteRight}
            disabled={!selectedClipId}
            onClick={onDeleteRight}
          />
          <ToolbarIconButton
            icon={Merge}
            label={t.toolbar.merge}
            disabled={!canMerge}
            onClick={onMergeSelected}
            testId="timeline-merge-btn"
          />
          <ToolbarIconButton
            icon={Copy}
            label={t.toolbar.duplicate}
            disabled={!selectedClipId}
            onClick={onDuplicateSelected}
          />
          <ToolbarIconButton
            icon={Snowflake}
            label={t.toolbar.freeze}
            disabled={!selectedClipId}
            onClick={onFreezeFrame}
          />
          <ToolbarIconButton
            icon={RefreshCcw}
            label={t.toolbar.reverse}
            disabled={!selectedClipId}
            onClick={onReverseSelected}
            testId="timeline-reverse-btn"
          />
          <ToolbarIconButton
            icon={Unlink}
            label={t.toolbar.detachAudio}
            disabled={!selectedClipId}
            onClick={onDetachAudioSelected}
            testId="timeline-detach-audio-btn"
          />
          <ToolbarIconButton
            icon={Diamond}
            label={t.inspector.addKeyframe}
            disabled={!selectedClipId}
            onClick={onToggleKeyframeSelected}
            testId="timeline-keyframe-btn"
          />
          <ToolbarIconButton
            icon={BookmarkPlus}
            label={t.toolbar.addMarker}
            onClick={onAddMarker}
            testId="timeline-add-marker-btn"
          />
          <ToolbarIconButton
            icon={Trash2}
            label={t.toolbar.delete}
            disabled={!selectedClipId}
            onClick={onDeleteSelected}
            testId="timeline-delete-btn"
          />
        </div>

        {/* Right tool cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleRecordVoice}
            title={isRecordingVoice ? t.toolbar.stopRecord : t.toolbar.record}
            aria-label={isRecordingVoice ? t.toolbar.stopRecord : t.toolbar.record}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isRecordingVoice
                ? 'bg-rose-500/20 text-rose-400'
                : 'text-zinc-400 hover:text-white hover:bg-[#23232a]'
            }`}
          >
            {isRecordingVoice ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleSnap}
            title={t.toolbar.snap}
            aria-label={t.toolbar.snap}
            aria-pressed={snapEnabled}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              snapEnabled
                ? 'text-[#00d5dc] bg-[#212128]'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleRipple}
            title={t.toolbar.ripple}
            aria-label={t.toolbar.ripple}
            aria-pressed={rippleEnabled}
            className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              rippleEnabled
                ? 'text-[#00d5dc] bg-[#212128]'
                : 'text-zinc-500 hover:text-zinc-200'
            }`}
          >
            Ripple
          </button>

          <div className="w-px h-4 bg-[#2a2a32] mx-0.5" />

          <button
            type="button"
            onClick={onFitZoom}
            title={t.toolbar.fitView}
            aria-label={t.toolbar.fitView}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-[#23232a] cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onChangeZoom(Math.max(12, pxPerSecond - 12))}
            aria-label="Zoom out timeline"
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            aria-label="Timeline zoom"
            min={12}
            max={120}
            value={pxPerSecond}
            onChange={(e) => onChangeZoom(Number(e.target.value))}
            className="cc-slider w-20"
          />

          <button
            type="button"
            onClick={() => onChangeZoom(Math.min(120, pxPerSecond + 12))}
            aria-label="Zoom in timeline"
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {clips.length > 0 && (
            <button
              type="button"
              onClick={onClearTimeline}
              title={t.toolbar.clearAll}
              aria-label={t.toolbar.clearAll}
              data-testid="timeline-clear-btn"
              className="ml-1 px-2 py-1 rounded bg-[#202026] hover:bg-[#2a2a32] text-[10px] text-zinc-400 hover:text-zinc-100 cursor-pointer whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Timeline Body: Fixed Left Track Headers + Scrollable Ruler/Lanes */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Track Header Column */}
        <div className="w-40 shrink-0 border-r border-[#24242b] bg-[#141418] flex flex-col">
          {/* Corner cell aligned with Ruler */}
          <div className="h-6 shrink-0 border-b border-[#24242b] px-2 flex items-center justify-between">
            <span className="text-[10px] font-timecode text-zinc-500">
              {fps}fps
            </span>
            <button
              type="button"
              onClick={() => onAddTrack('overlay')}
              data-testid="add-track-btn"
              className="px-1.5 py-0.5 rounded bg-[#202026] hover:bg-[#2c2c34] text-[10px] text-[#00d5dc] flex items-center gap-0.5 cursor-pointer"
              title="Add overlay track"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>{t.toolbar.addTrack.replace(/^\+\s*/, '')}</span>
            </button>
          </div>

          {clips.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-2">
              <span className="text-[10px] text-zinc-600 text-center">Tracks</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1 space-y-1">
              {tracks.map((track) => {
                const TrackIcon =
                  track.id.includes('pip')
                    ? Layers
                    : track.type === 'overlay'
                      ? Type
                      : track.type === 'effect'
                        ? Sparkles
                        : track.type === 'audio'
                          ? Music
                          : Film;
                const rowHeight = track.isMain ? 'h-16' : 'h-10';
                return (
                  <div
                    key={track.id}
                    className={`${rowHeight} px-2 flex items-center justify-between gap-1 border-b border-[#1d1d22]`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TrackIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      {track.isMain ? (
                        <button
                          type="button"
                          onClick={onOpenCoverModal}
                          className="px-1.5 py-0.5 rounded bg-[#222229] hover:bg-[#2c2c35] text-[10px] text-zinc-200 flex items-center gap-1 shrink-0 cursor-pointer"
                          title={t.cover}
                        >
                          <ImageIcon className="w-2.5 h-2.5 text-[#00d5dc] shrink-0" />
                          <span>{t.cover}</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500 truncate">
                          {track.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleTrackFlag(track.id, 'locked')}
                        aria-label={`Lock ${track.label} track`}
                        className={`p-1 rounded cursor-pointer ${
                          track.locked ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        {track.locked ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                      </button>
                      {track.type !== 'audio' && (
                        <button
                          type="button"
                          onClick={() => onToggleTrackFlag(track.id, 'hidden')}
                          aria-label={`Toggle ${track.label} visibility`}
                          className={`p-1 rounded cursor-pointer ${
                            track.hidden ? 'text-rose-400' : 'text-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {track.hidden ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      )}
                      {(track.type === 'audio' || track.isMain) && (
                        <button
                          type="button"
                          onClick={() => onToggleTrackFlag(track.id, 'muted')}
                          aria-label={`Mute ${track.label} track`}
                          className={`p-1 rounded cursor-pointer ${
                            track.muted ? 'text-rose-400' : 'text-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {track.muted ? (
                            <VolumeX className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Ruler + Track Lanes */}
        <div
          ref={scrollContainerRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData('application/x-klipframe-asset');
            if (!raw) return;
            try {
              const parsed = JSON.parse(raw) as { type: string; assetId: string };
              if (parsed.type === 'media' && parsed.assetId) {
                const scroller = scrollContainerRef.current;
                const rect = scroller?.getBoundingClientRect();
                const dropTime = rect
                  ? pxToTime(e.clientX - rect.left + (scroller?.scrollLeft ?? 0), pxPerSecond)
                  : currentTime;
                onDropAssetOnTimeline(parsed.assetId, Number(dropTime.toFixed(2)));
              }
            } catch {
              // ignore invalid drop payload
            }
          }}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#111114]"
          onClick={() => {
            onSelectClip(null);
            setContextMenu(null);
          }}
        >
          <div style={{ width: `${timelineWidthPx}px` }} className="min-h-full relative flex flex-col">
            {/* Time Ruler */}
            <div
              onPointerDown={handleRulerPointerDown}
              onPointerMove={handleRulerPointerMove}
              onPointerUp={handleRulerPointerUp}
              className="h-6 shrink-0 border-b border-[#24242b] bg-[#151519] relative cursor-pointer"
            >
              {rulerTicks.map((tick) => {
                const left = timeToPx(tick.time, pxPerSecond);
                return (
                  <div
                    key={tick.time}
                    style={{ left: `${left}px` }}
                    className="absolute top-0 bottom-0 pointer-events-none"
                  >
                    <div
                      className={`w-px ${
                        tick.major ? 'h-2.5 bg-zinc-500' : 'h-1.5 bg-zinc-700'
                      }`}
                    />
                    {tick.major && (
                      <span className="absolute top-2 left-1 text-[10px] font-timecode text-zinc-400 whitespace-nowrap">
                        {formatRulerTime(tick.time)}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Timeline Markers */}
              {markers.map((mk) => (
                <button
                  key={mk.id}
                  type="button"
                  data-testid={`timeline-marker-${mk.id}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(mk.time);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveMarker(mk.id);
                  }}
                  style={{ left: `${timeToPx(mk.time, pxPerSecond) - 6}px` }}
                  aria-label={`Marker ${mk.label} at ${mk.time.toFixed(1)}s`}
                  title={`${mk.label} (${mk.time.toFixed(1)}s) — Right-click to remove`}
                  className="absolute top-0.5 w-3 h-3 rounded-b-sm bg-amber-400 hover:bg-amber-300 border border-black/40 z-30 cursor-pointer"
                />
              ))}
            </div>

            {/* Track Lanes or Empty State (matching Screenshot 2!) */}
            {clips.length === 0 ? (
              <div
                data-testid="timeline-empty-state"
                className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center"
              >
                <div className="flex items-center gap-2.5 text-zinc-400">
                  <Film className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-medium">{t.dragMaterialPrompt}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSampleProject();
                  }}
                  className="px-3 py-1.5 rounded bg-[#222229] hover:bg-[#2c2c35] border border-[#32323c] text-xs font-medium text-[#00d5dc] transition-colors cursor-pointer"
                >
                  {t.loadSampleProject}
                </button>
              </div>
            ) : (
              <div className="flex-1 py-1 space-y-1 relative">
                {tracks.map((track) => {
                  const trackClips = clips
                    .filter((c) => c.trackId === track.id)
                    .sort((a, b) => a.startTime - b.startTime);
                  const rowHeight = track.isMain ? 'h-16' : 'h-10';

                  return (
                    <div
                      key={track.id}
                      data-testid={`track-lane-${track.id}`}
                      className={`${rowHeight} relative border-b border-[#1b1b20] ${
                        track.hidden ? 'opacity-40' : ''
                      }`}
                    >
                      {trackClips.map((clip, idx) => {
                        const leftPx = timeToPx(clip.startTime, pxPerSecond);
                        const widthPx = Math.max(24, timeToPx(clip.duration, pxPerSecond));
                        const isSelected = clip.id === selectedClipId;
                        const nextClip = trackClips[idx + 1];
                        const hasTransitionSpot =
                          track.isMain &&
                          nextClip &&
                          Math.abs(clip.startTime + clip.duration - nextClip.startTime) < 0.15;

                        return (
                          <React.Fragment key={clip.id}>
                            <div
                              data-testid={`timeline-clip-${clip.id}`}
                              onPointerDown={(e) => handleClipDragStart(e, clip, 'move')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setContextMenu(null);
                                onSelectClip(clip.id);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSelectClip(clip.id);
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  clip,
                                });
                              }}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx}px`,
                                cursor: toolMode === 'blade' ? 'crosshair' : 'grab',
                              }}
                              className={`absolute top-0.5 bottom-0.5 rounded-[4px] overflow-hidden flex flex-col justify-between transition-shadow ${
                                clip.kind === 'text' || clip.kind === 'caption'
                                  ? isSelected
                                    ? 'bg-[#3b2121] border-2 border-[#ef4444] shadow-md'
                                    : 'bg-[#2b2224] border border-[#4f3439]'
                                  : clip.kind === 'audio'
                                    ? isSelected
                                      ? 'bg-[#0f3842] border-2 border-[#00d5dc]'
                                      : 'bg-[#102e38] border border-[#1d4c5c]'
                                    : clip.kind === 'effect' || clip.kind === 'filter'
                                      ? isSelected
                                        ? 'bg-[#2f2145] border-2 border-[#a855f7]'
                                        : 'bg-[#241b35] border border-[#433066]'
                                      : isSelected
                                        ? 'bg-[#133238] border-2 border-[#00d5dc] shadow-md'
                                        : 'bg-[#1a2b2f] border border-[#2a494f]'
                              }`}
                            >
                              {/* Video / Image filmstrip */}
                              {(clip.kind === 'video' || clip.kind === 'image') && (
                                <>
                                  <div className="px-1.5 py-0.5 bg-black/55 text-[10px] text-zinc-100 flex items-center justify-between gap-1 z-10 pointer-events-none">
                                    <span className="truncate font-medium">
                                      {clip.reversed ? '◀ ' : ''}
                                      {clip.name}
                                    </span>
                                    <span className="font-timecode text-zinc-300 shrink-0">
                                      {clip.audioDetached ? '🔇 ' : ''}
                                      {formatTimecode(clip.duration, fps)}
                                    </span>
                                  </div>
                                  <div className="flex-1 flex overflow-hidden opacity-85 pointer-events-none">
                                    {Array.from({
                                      length: Math.max(1, Math.ceil(widthPx / 56)),
                                    }).map((_, tileIdx) =>
                                      clip.thumbnail ? (
                                        <img
                                          key={tileIdx}
                                          src={clip.thumbnail}
                                          alt=""
                                          referrerPolicy="no-referrer"
                                          className="h-full w-14 object-cover shrink-0 border-r border-black/20"
                                        />
                                      ) : (
                                        <div
                                          key={tileIdx}
                                          className="h-full w-14 shrink-0 border-r border-black/25 bg-gradient-to-br from-teal-800 via-cyan-900 to-slate-900"
                                        />
                                      ),
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Text / Sticker / Caption */}
                              {(clip.kind === 'text' ||
                                clip.kind === 'sticker' ||
                                clip.kind === 'caption') && (
                                <div className="h-full px-2 flex items-center gap-1.5 text-[11px] text-white pointer-events-none">
                                  <span className="px-1 py-0.2 rounded bg-white/15 text-[9px] font-bold shrink-0">
                                    {clip.kind === 'sticker'
                                      ? clip.stickerEmoji
                                      : clip.kind === 'caption'
                                        ? 'CC'
                                        : 'T'}
                                  </span>
                                  <span className="truncate font-medium">
                                    {clip.text?.content || clip.name}
                                  </span>
                                </div>
                              )}

                              {/* Effect / Filter */}
                              {(clip.kind === 'effect' || clip.kind === 'filter') && (
                                <div className="h-full px-2 flex items-center gap-1.5 text-[11px] text-purple-100 pointer-events-none">
                                  <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
                                  <span className="truncate font-medium">{clip.name}</span>
                                </div>
                              )}

                              {/* Audio Waveform */}
                              {clip.kind === 'audio' && clip.audio && (
                                <div className="h-full px-1.5 py-1 flex flex-col justify-between pointer-events-none">
                                  <div className="text-[10px] text-cyan-100 truncate font-medium leading-none">
                                    {clip.name}
                                  </div>
                                  <div className="flex items-end gap-[2px] h-4 overflow-hidden opacity-80">
                                    {Array.from({
                                      length: Math.max(8, Math.floor(widthPx / 5)),
                                    }).map((_, wIdx) => {
                                      const wf = clip.audio!.waveform;
                                      const amp =
                                        wf.length > 0 ? wf[wIdx % wf.length] : 0.45;
                                      return (
                                        <span
                                          key={wIdx}
                                          style={{ height: `${Math.max(20, amp * 100)}%` }}
                                          className="w-[2px] rounded-full bg-[#38e2e8] shrink-0"
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Keyframe Diamond Markers */}
                              {clip.keyframes && clip.keyframes.length > 0 && (
                                <div className="absolute left-0 right-0 bottom-0.5 h-2.5 pointer-events-none z-20">
                                  {clip.keyframes.map((kf, kIdx) => (
                                    <span
                                      key={`${kf.timeOffset}-${kIdx}`}
                                      style={{
                                        left: `${Math.max(2, Math.min(widthPx - 10, timeToPx(kf.timeOffset, pxPerSecond) - 4))}px`,
                                      }}
                                      className="absolute bottom-0.5 w-2 h-2 rotate-45 bg-amber-400 border border-black/60 shadow"
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Left & Right Trim Handles */}
                              <div
                                onPointerDown={(e) => handleClipDragStart(e, clip, 'trim-left')}
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 z-20"
                                title="Trim start"
                              />
                              <div
                                onPointerDown={(e) => handleClipDragStart(e, clip, 'trim-right')}
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 z-20"
                                title="Trim end"
                              />
                            </div>

                            {/* Transition Diamond Indicator between adjacent main clips */}
                            {hasTransitionSpot && (
                              <div
                                style={{
                                  left: `${timeToPx(clip.startTime + clip.duration, pxPerSecond) - 9}px`,
                                }}
                                title={
                                  clip.transitionOut && clip.transitionOut.type !== 'none'
                                    ? `Transition: ${clip.transitionOut.type}`
                                    : 'No transition'
                                }
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 rounded-[2px] border z-30 flex items-center justify-center pointer-events-none ${
                                  clip.transitionOut && clip.transitionOut.type !== 'none'
                                    ? 'bg-[#00d5dc] border-white'
                                    : 'bg-[#24242b] border-zinc-500'
                                }`}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Vertical White Playhead Line */}
            <div
              style={{ left: `${playheadX}px` }}
              className="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-40"
            >
              <div className="w-3 h-3.5 -ml-[5.5px] bg-white rounded-t-[2px] clip-playhead shadow" />
            </div>
          </div>
        </div>
      </div>

      {/* Clip Right-Click Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          aria-label="Clip context menu"
          style={{
            left: `${Math.min(window.innerWidth - 180, contextMenu.x)}px`,
            top: `${Math.min(window.innerHeight - 230, contextMenu.y)}px`,
          }}
          className="fixed w-44 rounded-lg bg-[#1d1d23] border border-[#30303a] shadow-2xl py-1 z-50 text-xs"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSplitAtPlayhead();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
          >
            {t.toolbar.split}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDuplicateSelected();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
          >
            {t.toolbar.duplicate}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCopySelected();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
          >
            {t.toolbar.copy}
          </button>
          {canPaste && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onPasteClip();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
            >
              {t.toolbar.paste}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onReverseSelected();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
          >
            {t.toolbar.reverse}
          </button>
          {(contextMenu.clip.kind === 'video' || contextMenu.clip.kind === 'image') && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDetachAudioSelected();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
            >
              {t.toolbar.detachAudio}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleKeyframeSelected();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
          >
            {t.inspector.addKeyframe}
          </button>
          {canMerge && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMergeSelected();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-[#2a2a33] cursor-pointer"
            >
              {t.toolbar.merge}
            </button>
          )}
          <div className="my-1 border-t border-[#2b2b34]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDeleteSelected();
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-500/15 cursor-pointer"
          >
            {t.toolbar.delete}
          </button>
        </div>
      )}
    </section>
  );
};

const ToolbarIconButton: React.FC<{
  icon: React.FC<{ className?: string }>;
  label: string;
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
}> = ({ icon: Icon, label, disabled, testId, onClick }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    title={label}
    aria-label={label}
    data-testid={testId}
    className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#24242c] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);
