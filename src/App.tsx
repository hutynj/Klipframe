import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CoverModal,
  ExportModal,
  ProjectSettingsModal,
  ShareProjectModal,
  ShortcutsModal,
} from './components/Modals';
import { InspectorPanel } from './components/InspectorPanel';
import { PlayerPanel } from './components/PlayerPanel';
import { ResourcePanel } from './components/ResourcePanel';
import { TimelinePanel } from './components/TimelinePanel';
import { TopBar } from './components/TopBar';
import {
  AUDIO_LIBRARY,
  createInitialDemoClips,
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_TRACKS,
  INITIAL_STOCK_ASSETS,
  SAMPLE_CAPTIONS,
  type AudioLibraryItem,
} from './data/presets';
import type {
  AspectRatioPreset,
  EffectPresetId,
  FilterPresetId,
  LanguageCode,
  MediaAsset,
  ProjectConfig,
  ResourceTabId,
  TextPresetItem,
  TextStyleProps,
  TimelineClip,
  TimelineState,
  TransitionType,
} from './types/editor';
import { audioEngine } from './utils/audioEngine';
import { createMediaCache } from './utils/canvasRenderer';
import { I18N } from './utils/i18n';
import {
  detachAudioFromClip,
  hasKeyframeNear,
  parseSrt,
  removeKeyframeAt,
  serializeSrt,
  upsertKeyframe,
} from './utils/nleFeatures';
import {
  computeProjectDuration,
  createDefaultAdjustments,
  createDefaultAnimation,
  createDefaultTransform,
  deleteClipsByIds,
  deleteLeftOfPlayhead,
  deleteRightOfPlayhead,
  findNonOverlappingStart,
  findTrackEndTime,
  generateBeatMarkerTimes,
  mergeAdjacentClip,
  splitClipAtTime,
} from './utils/timelineOps';

const STORAGE_KEY = 'klipframe_studio_project_v1';

let idCounter = 100;
function nextId(prefix = 'clip'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function nowClock(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('es');
  const t = I18N[lang];

  const [project, setProject] = useState<ProjectConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.project) return parsed.project;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PROJECT_CONFIG;
  });

  const [timeline, setTimeline] = useState<TimelineState>(() => {
    const startEmpty =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('empty') === '1';
    if (startEmpty) {
      return { tracks: DEFAULT_TRACKS, clips: [] };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.timeline?.tracks && Array.isArray(parsed?.timeline?.clips)) {
          return parsed.timeline;
        }
      }
    } catch {
      // ignore
    }
    return {
      tracks: DEFAULT_TRACKS,
      clips: createInitialDemoClips(),
    };
  });

  const [historyPast, setHistoryPast] = useState<TimelineState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<TimelineState[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(INITIAL_STOCK_ASSETS);
  const [savedTextPresets, setSavedTextPresets] = useState<TextPresetItem[]>([]);

  const [activeTab, setActiveTab] = useState<ResourceTabId>('text');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(() => {
    const startEmpty =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('empty') === '1';
    return startEmpty ? null : 'clip-demo-text-1';
  });

  const [currentTime, setCurrentTime] = useState<number>(1.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pxPerSecond, setPxPerSecond] = useState(32);
  const [toolMode, setToolMode] = useState<'select' | 'blade'>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'default' | 'timeline' | 'preview'>('default');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => nowClock());
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [copiedClip, setCopiedClip] = useState<TimelineClip | null>(null);

  // Modals
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const cacheRef = useRef(createMediaCache());
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStartTimeRef = useRef<number>(0);

  const totalDuration = useMemo(
    () => computeProjectDuration(timeline.clips),
    [timeline.clips],
  );

  const selectedClip = useMemo(
    () => timeline.clips.find((c) => c.id === selectedClipId) ?? null,
    [timeline.clips, selectedClipId],
  );

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ project, timeline }),
      );
      setLastSavedTime(nowClock());
    } catch {
      // ignore quota errors
    }
  }, [project, timeline]);

  // Helper to commit timeline mutation to Undo stack
  const commitTimeline = useCallback(
    (updater: (prev: TimelineState) => TimelineState) => {
      setTimeline((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        setHistoryPast((p) => [...p.slice(-29), prev]);
        setHistoryFuture([]);
        return next;
      });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setTimeline((current) => {
        setHistoryFuture((f) => [current, ...f.slice(0, 29)]);
        return previous;
      });
      return past.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setTimeline((current) => {
        setHistoryPast((p) => [...p.slice(-29), current]);
        return next;
      });
      return future.slice(1);
    });
  }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      audioEngine.stopPlayback();
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      setCurrentTime((prev) => {
        const maxDur = Math.max(0.5, totalDuration);
        const next = prev + dt;
        if (next >= maxDur) {
          setIsPlaying(false);
          return maxDur;
        }
        return next;
      });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      audioEngine.stopPlayback();
    };
  }, [isPlaying, totalDuration]);

  // Audio synthesizer tick synced to currentTime while playing
  useEffect(() => {
    if (!isPlaying) return;
    const trackMap = new Map(timeline.tracks.map((tr) => [tr.id, tr]));
    const activeAudio = timeline.clips
      .filter((c) => {
        const tr = trackMap.get(c.trackId);
        return (
          c.kind === 'audio' &&
          c.audio &&
          !tr?.muted &&
          !tr?.hidden &&
          currentTime >= c.startTime &&
          currentTime < c.startTime + c.duration
        );
      })
      .map((c) => ({
        id: c.id,
        startTime: c.startTime,
        duration: c.duration,
        volume: c.audio?.volume ?? 100,
        muted: c.audio?.muted ?? false,
        synthPreset: c.audio?.synthPreset,
        voiceEffect: c.audio?.voiceEffect,
        normalize: c.audio?.normalize,
      }));

    audioEngine.tickPlayback(
      currentTime,
      isPlaying,
      activeAudio,
      false,
    );
  }, [currentTime, isPlaying, timeline.clips, timeline.tracks]);

  // Media Import (real local video/image/audio files)
  const handleImportFiles = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const kind: MediaAsset['kind'] = isVideo
          ? 'video'
          : isAudio
            ? 'audio'
            : 'image';

        const baseAsset: MediaAsset = {
          id: nextId('asset'),
          name: file.name,
          kind,
          src: url,
          thumbnail: kind === 'image' ? url : '',
          duration: kind === 'image' ? 5 : 8,
          category: 'device',
          waveform: isAudio
            ? Array.from({ length: 36 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 0.6)))
            : undefined,
        };

        if (isVideo) {
          const vid = document.createElement('video');
          vid.src = url;
          vid.onloadedmetadata = () => {
            setMediaAssets((prev) =>
              prev.map((a) =>
                a.id === baseAsset.id
                  ? { ...a, duration: Math.max(1, Math.min(60, vid.duration || 8)) }
                  : a,
              ),
            );
          };
        }

        setMediaAssets((prev) => [baseAsset, ...prev]);
      });
    },
    [],
  );

  // Add Media Asset to Timeline
  const handleAddMediaToTimeline = useCallback(
    (asset: MediaAsset, explicitTime?: number) => {
      if (asset.kind === 'audio') {
        const trackId = 'track-audio-main';
        const newClipId = nextId('clip');
        commitTimeline((prev) => {
          const start =
            explicitTime !== undefined
              ? findNonOverlappingStart(prev.clips, trackId, explicitTime, asset.duration)
              : findTrackEndTime(prev.clips, trackId);
          const clip: TimelineClip = {
            id: newClipId,
            trackId,
            kind: 'audio',
            name: asset.name,
            assetId: asset.id,
            src: asset.src,
            startTime: start,
            duration: asset.duration,
            trimStart: 0,
            sourceDuration: asset.duration,
            speed: 1,
            transform: createDefaultTransform(),
            adjustments: createDefaultAdjustments(),
            animation: createDefaultAnimation(),
            audio: {
              volume: 100,
              muted: false,
              fadeIn: 0.3,
              fadeOut: 0.3,
              synthPreset: asset.synthPreset || 'lofi',
              waveform: asset.waveform ?? [0.4, 0.7, 0.5, 0.8],
            },
          };
          return { ...prev, clips: [...prev.clips, clip] };
        });
        setSelectedClipId(newClipId);
        return;
      }

      const trackId = 'track-video-main';
      const newClipId = nextId('clip');
      commitTimeline((prev) => {
        const start =
          explicitTime !== undefined
            ? findNonOverlappingStart(prev.clips, trackId, explicitTime, asset.duration)
            : findTrackEndTime(prev.clips, trackId);
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: asset.kind === 'video' ? 'video' : 'image',
          name: asset.name,
          assetId: asset.id,
          src: asset.src,
          thumbnail: asset.thumbnail,
          proceduralKind: asset.proceduralKind,
          startTime: start,
          duration: asset.duration,
          trimStart: 0,
          sourceDuration: Math.max(asset.duration, 20),
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline],
  );

  const handleAddOverlayToTimeline = useCallback(
    (asset: MediaAsset) => {
      if (asset.kind === 'audio') return;
      const newClipId = nextId('pip');
      commitTimeline((prev) => {
        let tracks = prev.tracks;
        let pipTrack = tracks.find((tr) => tr.id === 'track-pip') ??
          tracks.find((tr) => tr.type === 'overlay' && tr.id !== 'track-text');
        if (!pipTrack) {
          pipTrack = {
            id: 'track-pip',
            type: 'overlay',
            label: 'Overlay',
            locked: false,
            hidden: false,
            muted: false,
          };
          const mainIdx = tracks.findIndex((tr) => tr.isMain);
          tracks =
            mainIdx >= 0
              ? [...tracks.slice(0, mainIdx), pipTrack, ...tracks.slice(mainIdx)]
              : [pipTrack, ...tracks];
        }
        const start = findNonOverlappingStart(
          prev.clips,
          pipTrack.id,
          currentTime,
          asset.duration,
        );
        const clip: TimelineClip = {
          id: newClipId,
          trackId: pipTrack.id,
          kind: asset.kind === 'video' ? 'video' : 'image',
          name: `${asset.name} (PIP)`,
          assetId: asset.id,
          src: asset.src,
          thumbnail: asset.thumbnail,
          proceduralKind: asset.proceduralKind,
          startTime: start,
          duration: asset.duration,
          trimStart: 0,
          sourceDuration: Math.max(asset.duration, 20),
          speed: 1,
          transform: {
            ...createDefaultTransform(),
            scale: 0.42,
            scaleX: 0.42,
            scaleY: 0.42,
            x: 180,
            y: -90,
          },
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
        };
        return { ...prev, tracks, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleAddAudioToTimeline = useCallback(
    (item: AudioLibraryItem) => {
      const trackId = 'track-audio-main';
      const newClipId = nextId('clip');
      commitTimeline((prev) => {
        const start = findNonOverlappingStart(
          prev.clips,
          trackId,
          currentTime,
          item.duration,
        );
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: 'audio',
          name: item.name,
          startTime: start,
          duration: item.duration,
          trimStart: 0,
          sourceDuration: item.duration,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
          audio: {
            volume: 85,
            muted: false,
            fadeIn: 0.4,
            fadeOut: 0.6,
            synthPreset: item.synthPreset,
            waveform: item.waveform,
          },
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleAddTextToTimeline = useCallback(
    (preset?: TextPresetItem) => {
      const trackId = 'track-text';
      const newClipId = nextId('text');
      const style: TextStyleProps = {
        content: preset?.style.content ?? 'Nuevo texto',
        fontFamily: preset?.style.fontFamily ?? 'Plus Jakarta Sans',
        fontSize: preset?.style.fontSize ?? 72,
        fontWeight: preset?.style.fontWeight ?? 700,
        italic: preset?.style.italic ?? false,
        underline: preset?.style.underline ?? false,
        uppercase: preset?.style.uppercase ?? false,
        color: preset?.style.color ?? '#ffffff',
        strokeColor: preset?.style.strokeColor ?? '#000000',
        strokeWidth: preset?.style.strokeWidth ?? 0,
        bgColor: preset?.style.bgColor ?? '#000000',
        bgOpacity: preset?.style.bgOpacity ?? 0,
        bgRadius: preset?.style.bgRadius ?? 8,
        shadowBlur: preset?.style.shadowBlur ?? 12,
        shadowColor: preset?.style.shadowColor ?? 'rgba(0,0,0,0.65)',
        align: preset?.style.align ?? 'center',
        letterSpacing: preset?.style.letterSpacing ?? 1,
        lineHeight: preset?.style.lineHeight ?? 1.2,
        templateId: preset?.id,
      };

      commitTimeline((prev) => {
        const start = findNonOverlappingStart(prev.clips, trackId, currentTime, 4);
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: 'text',
          name: style.content.slice(0, 20),
          startTime: start,
          duration: 4,
          trimStart: 0,
          sourceDuration: 60,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: {
            inPreset: 'fadeIn',
            inDuration: 0.35,
            outPreset: 'fadeIn',
            outDuration: 0.35,
          },
          text: style,
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleAddStickerToTimeline = useCallback(
    (emoji: string, label: string) => {
      const trackId = 'track-text';
      const newClipId = nextId('stk');
      commitTimeline((prev) => {
        const start = findNonOverlappingStart(prev.clips, trackId, currentTime, 3.5);
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: 'sticker',
          name: `${emoji} ${label}`,
          stickerEmoji: emoji,
          stickerLabel: label,
          startTime: start,
          duration: 3.5,
          trimStart: 0,
          sourceDuration: 60,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: {
            inPreset: 'pop',
            inDuration: 0.4,
            outPreset: 'fadeIn',
            outDuration: 0.3,
          },
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleAddEffectToTimeline = useCallback(
    (effectId: EffectPresetId, name: string) => {
      const trackId = 'track-effect';
      const newClipId = nextId('fx');
      commitTimeline((prev) => {
        const start = findNonOverlappingStart(prev.clips, trackId, currentTime, 4);
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: 'effect',
          name,
          effectId,
          effectIntensity: 80,
          startTime: start,
          duration: 4,
          trimStart: 0,
          sourceDuration: 60,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleAddFilterToTimeline = useCallback(
    (filterId: FilterPresetId, name: string) => {
      const trackId = 'track-effect';
      const newClipId = nextId('flt');
      commitTimeline((prev) => {
        const start = findNonOverlappingStart(prev.clips, trackId, currentTime, 5);
        const clip: TimelineClip = {
          id: newClipId,
          trackId,
          kind: 'filter',
          name,
          filterId,
          filterIntensity: 85,
          startTime: start,
          duration: 5,
          trimStart: 0,
          sourceDuration: 60,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(newClipId);
    },
    [commitTimeline, currentTime],
  );

  const handleApplyTransition = useCallback(
    (type: TransitionType, duration: number) => {
      commitTimeline((prev) => {
        const mainClips = prev.clips
          .filter((c) => c.trackId === 'track-video-main')
          .sort((a, b) => a.startTime - b.startTime);
        if (mainClips.length === 0) return prev;

        const targetId =
          selectedClipId && mainClips.some((c) => c.id === selectedClipId)
            ? selectedClipId
            : mainClips[0].id;

        return {
          ...prev,
          clips: prev.clips.map((c) =>
            c.id === targetId ? { ...c, transitionOut: { type, duration } } : c,
          ),
        };
      });
    },
    [commitTimeline, selectedClipId],
  );

  const handleGenerateAutoCaptions = useCallback(() => {
    const trackId = 'track-text';
    commitTimeline((prev) => {
      const generated: TimelineClip[] = SAMPLE_CAPTIONS.map((cap, idx) => ({
        id: nextId(`cap-${idx}`),
        trackId,
        kind: 'caption',
        name: cap.text,
        startTime: cap.start,
        duration: Number((cap.end - cap.start).toFixed(2)),
        trimStart: 0,
        sourceDuration: 30,
        speed: 1,
        transform: createDefaultTransform(),
        adjustments: createDefaultAdjustments(),
        animation: createDefaultAnimation(),
        text: {
          content: cap.text,
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 42,
          fontWeight: 600,
          italic: false,
          underline: false,
          uppercase: false,
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 0,
          bgColor: '#000000',
          bgOpacity: 75,
          bgRadius: 10,
          shadowBlur: 0,
          shadowColor: '#000000',
          align: 'center',
          letterSpacing: 0,
          lineHeight: 1.2,
        },
      }));
      return { ...prev, clips: [...prev.clips, ...generated] };
    });
  }, [commitTimeline]);

  const handleAddManualCaption = useCallback(
    (text: string) => {
      const capId = nextId('cap');
      commitTimeline((prev) => {
        const start = findNonOverlappingStart(prev.clips, 'track-text', currentTime, 3);
        const clip: TimelineClip = {
          id: capId,
          trackId: 'track-text',
          kind: 'caption',
          name: text.slice(0, 24),
          startTime: start,
          duration: 3,
          trimStart: 0,
          sourceDuration: 30,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
          text: {
            content: text,
            fontFamily: 'Plus Jakarta Sans',
            fontSize: 42,
            fontWeight: 600,
            italic: false,
            underline: false,
            uppercase: false,
            color: '#ffffff',
            strokeColor: '#000000',
            strokeWidth: 0,
            bgColor: '#000000',
            bgOpacity: 75,
            bgRadius: 10,
            shadowBlur: 0,
            shadowColor: '#000000',
            align: 'center',
            letterSpacing: 0,
            lineHeight: 1.2,
          },
        };
        return { ...prev, clips: [...prev.clips, clip] };
      });
      setSelectedClipId(capId);
    },
    [commitTimeline, currentTime],
  );

  const handleImportSrt = useCallback(
    (srtText: string) => {
      const cues = parseSrt(srtText);
      if (cues.length === 0) return;
      commitTimeline((prev) => {
        const imported: TimelineClip[] = cues.map((cue, idx) => ({
          id: nextId(`srt-${idx}`),
          trackId: 'track-text',
          kind: 'caption',
          name: cue.text.slice(0, 24),
          startTime: cue.start,
          duration: Number((cue.end - cue.start).toFixed(2)),
          trimStart: 0,
          sourceDuration: 60,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
          text: {
            content: cue.text,
            fontFamily: 'Plus Jakarta Sans',
            fontSize: 42,
            fontWeight: 600,
            italic: false,
            underline: false,
            uppercase: false,
            color: '#ffffff',
            strokeColor: '#000000',
            strokeWidth: 0,
            bgColor: '#000000',
            bgOpacity: 75,
            bgRadius: 10,
            shadowBlur: 0,
            shadowColor: '#000000',
            align: 'center',
            letterSpacing: 0,
            lineHeight: 1.2,
          },
        }));
        return { ...prev, clips: [...prev.clips, ...imported] };
      });
    },
    [commitTimeline],
  );

  const handleExportSrt = useCallback(() => {
    const content = serializeSrt(timeline.clips);
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project.name, timeline.clips]);

  const handleApplyAdjustmentPreset = useCallback(
    (presetName: string) => {
      const mainClips = timeline.clips.filter((c) => c.trackId === 'track-video-main');
      const targetId =
        selectedClipId && mainClips.some((c) => c.id === selectedClipId)
          ? selectedClipId
          : mainClips[0]?.id;
      if (!targetId) return;

      const map: Record<string, Partial<TimelineClip['adjustments']>> = {
        cinematic: { contrast: 18, saturation: -6, vignette: 28, temperature: 8 },
        bright: { brightness: 12, exposure: 10, contrast: 8, saturation: 10 },
        moody: { brightness: -8, contrast: 22, fade: 14, vignette: 35, temperature: -10 },
        vivid: { saturation: 28, contrast: 14, brightness: 4 },
      };
      const patch = map[presetName] ?? {};
      commitTimeline((prev) => ({
        ...prev,
        clips: prev.clips.map((c) =>
          c.id === targetId
            ? { ...c, adjustments: { ...c.adjustments, ...patch } }
            : c,
        ),
      }));
    },
    [commitTimeline, selectedClipId, timeline.clips],
  );

  // Timeline editing actions
  const handleSplitAtPlayhead = useCallback(() => {
    commitTimeline((prev) => {
      const target =
        (selectedClipId
          ? prev.clips.find(
              (c) =>
                c.id === selectedClipId &&
                currentTime > c.startTime + 0.3 &&
                currentTime < c.startTime + c.duration - 0.3,
            )
          : undefined) ??
        prev.clips.find(
          (c) =>
            c.trackId === 'track-video-main' &&
            currentTime > c.startTime + 0.3 &&
            currentTime < c.startTime + c.duration - 0.3,
        ) ??
        prev.clips.find(
          (c) =>
            currentTime > c.startTime + 0.3 &&
            currentTime < c.startTime + c.duration - 0.3,
        );

      if (!target) return prev;
      return {
        ...prev,
        clips: splitClipAtTime(prev.clips, target.id, currentTime, () => nextId('clip')),
      };
    });
  }, [commitTimeline, currentTime, selectedClipId]);

  const handleSplitClipAt = useCallback(
    (clipId: string, time: number) => {
      commitTimeline((prev) => ({
        ...prev,
        clips: splitClipAtTime(prev.clips, clipId, time, () => nextId('clip')),
      }));
    },
    [commitTimeline],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedClipId) return;
    commitTimeline((prev) => ({
      ...prev,
      clips: deleteClipsByIds(prev.clips, [selectedClipId], rippleEnabled, 'track-video-main'),
    }));
    setSelectedClipId(null);
  }, [commitTimeline, rippleEnabled, selectedClipId]);

  const canMergeSelected = useMemo(() => {
    if (!selectedClipId) return false;
    const target = timeline.clips.find((c) => c.id === selectedClipId);
    if (!target) return false;
    const sameTrack = timeline.clips
      .filter((c) => c.trackId === target.trackId)
      .sort((a, b) => a.startTime - b.startTime);
    const idx = sameTrack.findIndex((c) => c.id === selectedClipId);
    return idx !== -1 && idx < sameTrack.length - 1;
  }, [selectedClipId, timeline.clips]);

  const handleMergeSelected = useCallback(() => {
    if (!selectedClipId) return;
    commitTimeline((prev) => {
      const { clips: nextClips, mergedId } = mergeAdjacentClip(prev.clips, selectedClipId);
      if (!mergedId) return prev;
      return { ...prev, clips: nextClips };
    });
  }, [commitTimeline, selectedClipId]);

  const handleDeleteLeft = useCallback(() => {
    if (!selectedClipId) return;
    commitTimeline((prev) => ({
      ...prev,
      clips: deleteLeftOfPlayhead(prev.clips, selectedClipId, currentTime),
    }));
  }, [commitTimeline, currentTime, selectedClipId]);

  const handleDeleteRight = useCallback(() => {
    if (!selectedClipId) return;
    commitTimeline((prev) => ({
      ...prev,
      clips: deleteRightOfPlayhead(prev.clips, selectedClipId, currentTime),
    }));
  }, [commitTimeline, currentTime, selectedClipId]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedClipId) return;
    const dupId = nextId('dup');
    commitTimeline((prev) => {
      const target = prev.clips.find((c) => c.id === selectedClipId);
      if (!target) return prev;
      const start = findNonOverlappingStart(
        prev.clips,
        target.trackId,
        target.startTime + target.duration,
        target.duration,
      );
      const copy: TimelineClip = {
        ...target,
        id: dupId,
        startTime: start,
        keyframes: target.keyframes ? target.keyframes.map((k) => ({ ...k })) : undefined,
      };
      return { ...prev, clips: [...prev.clips, copy] };
    });
    setSelectedClipId(dupId);
  }, [commitTimeline, selectedClipId]);

  const handleCopySelected = useCallback(() => {
    if (!selectedClipId) return;
    const target = timeline.clips.find((c) => c.id === selectedClipId);
    if (!target) return;
    setCopiedClip({
      ...target,
      keyframes: target.keyframes ? target.keyframes.map((k) => ({ ...k })) : undefined,
    });
  }, [selectedClipId, timeline.clips]);

  const handlePasteClip = useCallback(() => {
    if (!copiedClip) return;
    const pastedId = nextId('paste');
    commitTimeline((prev) => {
      const start = findNonOverlappingStart(
        prev.clips,
        copiedClip.trackId,
        currentTime,
        copiedClip.duration,
      );
      const copy: TimelineClip = {
        ...copiedClip,
        id: pastedId,
        startTime: start,
        keyframes: copiedClip.keyframes ? copiedClip.keyframes.map((k) => ({ ...k })) : undefined,
      };
      return { ...prev, clips: [...prev.clips, copy] };
    });
    setSelectedClipId(pastedId);
  }, [commitTimeline, copiedClip, currentTime]);

  const handleFreezeFrame = useCallback(() => {
    if (!selectedClipId) return;
    const freezeId = nextId('freeze');
    commitTimeline((prev) => {
      const target = prev.clips.find((c) => c.id === selectedClipId);
      if (!target || (target.kind !== 'video' && target.kind !== 'image')) return prev;
      const start = findNonOverlappingStart(
        prev.clips,
        target.trackId,
        target.startTime + target.duration,
        3,
      );
      const frozen: TimelineClip = {
        ...target,
        id: freezeId,
        kind: 'image',
        name: `${target.name} (Freeze)`,
        startTime: start,
        duration: 3,
      };
      return { ...prev, clips: [...prev.clips, frozen] };
    });
    setSelectedClipId(freezeId);
  }, [commitTimeline, selectedClipId]);

  const handleReverseSelected = useCallback(() => {
    if (!selectedClipId) return;
    commitTimeline((prev) => ({
      ...prev,
      clips: prev.clips.map((c) =>
        c.id === selectedClipId ? { ...c, reversed: !c.reversed } : c,
      ),
    }));
  }, [commitTimeline, selectedClipId]);

  const handleDetachAudioSelected = useCallback(() => {
    if (!selectedClipId) return;
    let nextSelected: string | null = null;
    commitTimeline((prev) => {
      const { clips: nextClips, detachedClipId } = detachAudioFromClip(
        prev.clips,
        selectedClipId,
        () => nextId('aud'),
      );
      if (!detachedClipId) return prev;
      nextSelected = detachedClipId;
      return { ...prev, clips: nextClips };
    });
    if (nextSelected) {
      setSelectedClipId(nextSelected);
    }
  }, [commitTimeline, selectedClipId]);

  const handleToggleKeyframe = useCallback(
    (clipId: string) => {
      commitTimeline((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => {
          if (c.id !== clipId) return c;
          const relOffset = Math.max(0, Math.min(c.duration, currentTime - c.startTime));
          if (hasKeyframeNear(c.keyframes, relOffset)) {
            return {
              ...c,
              keyframes: removeKeyframeAt(c.keyframes, relOffset),
            };
          }
          return {
            ...c,
            keyframes: upsertKeyframe(c.keyframes, relOffset, {
              scale: c.transform.scale,
              x: c.transform.x,
              y: c.transform.y,
              rotation: c.transform.rotation,
              opacity: c.transform.opacity,
            }),
          };
        }),
      }));
    },
    [commitTimeline, currentTime],
  );

  const handleAddMarker = useCallback(() => {
    commitTimeline((prev) => {
      const existing = prev.markers ?? [];
      const nextMarker = {
        id: nextId('mk'),
        time: Number(currentTime.toFixed(2)),
        label: `M${existing.length + 1}`,
        color: '#facc15',
      };
      return { ...prev, markers: [...existing, nextMarker] };
    });
  }, [commitTimeline, currentTime]);

  const handleRemoveMarker = useCallback(
    (markerId: string) => {
      commitTimeline((prev) => ({
        ...prev,
        markers: (prev.markers ?? []).filter((m) => m.id !== markerId),
      }));
    },
    [commitTimeline],
  );

  const handleGenerateBeatMarkers = useCallback(
    (clip: TimelineClip) => {
      const presetItem = AUDIO_LIBRARY.find((a) => a.synthPreset === clip.audio?.synthPreset);
      const bpm = presetItem?.bpm ?? 110;
      const beatTimes = generateBeatMarkerTimes(clip.startTime, clip.duration, bpm);
      if (beatTimes.length === 0) return;
      commitTimeline((prev) => {
        const existing = prev.markers ?? [];
        const newMarkers = beatTimes
          .filter((bt) => !existing.some((m) => Math.abs(m.time - bt) < 0.25))
          .map((bt, idx) => ({
            id: nextId(`beat-${idx}`),
            time: bt,
            label: `B${idx + 1}`,
            color: '#00d5dc',
          }));
        return { ...prev, markers: [...existing, ...newMarkers] };
      });
    },
    [commitTimeline],
  );

  const handleAddTrack = useCallback(
    (type: 'overlay' | 'audio') => {
      commitTimeline((prev) => {
        const count = prev.tracks.filter((tr) => tr.type === type).length + 1;
        const newTrack = {
          id: nextId('track'),
          type,
          label: type === 'overlay' ? `Overlay ${count}` : `Audio ${count}`,
          locked: false,
          hidden: false,
          muted: false,
        };
        if (type === 'overlay') {
          const mainIdx = prev.tracks.findIndex((tr) => tr.isMain);
          const tracks =
            mainIdx >= 0
              ? [...prev.tracks.slice(0, mainIdx), newTrack, ...prev.tracks.slice(mainIdx)]
              : [newTrack, ...prev.tracks];
          return { ...prev, tracks };
        }
        return { ...prev, tracks: [...prev.tracks, newTrack] };
      });
    },
    [commitTimeline],
  );

  // Voiceover recording
  const handleToggleRecordVoice = useCallback(async () => {
    if (isRecordingVoice) {
      recorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }

    recordStartTimeRef.current = currentTime;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const recId = nextId('vo');
          commitTimeline((prev) => ({
            ...prev,
            clips: [
              ...prev.clips,
              {
                id: recId,
                trackId: 'track-audio-main',
                kind: 'audio',
                name: 'Voiceover Recording',
                src: url,
                startTime: recordStartTimeRef.current,
                duration: 3,
                trimStart: 0,
                sourceDuration: 3,
                speed: 1,
                transform: createDefaultTransform(),
                adjustments: createDefaultAdjustments(),
                animation: createDefaultAnimation(),
                audio: {
                  volume: 100,
                  muted: false,
                  fadeIn: 0.1,
                  fadeOut: 0.2,
                  synthPreset: 'ambient',
                  waveform: [0.3, 0.7, 0.9, 0.5, 0.8, 0.4, 0.6, 0.7],
                },
              },
            ],
          }));
          setSelectedClipId(recId);
        };
        recorderRef.current = rec;
        rec.start();
        setIsRecordingVoice(true);
        return;
      }
    } catch {
      // Fallback: insert a 3s voiceover synth track cleanly if mic permission unavailable
    }

    const voId = nextId('vo');
    commitTimeline((prev) => ({
      ...prev,
      clips: [
        ...prev.clips,
        {
          id: voId,
          trackId: 'track-audio-main',
          kind: 'audio',
          name: 'Voiceover Track',
          startTime: currentTime,
          duration: 3,
          trimStart: 0,
          sourceDuration: 3,
          speed: 1,
          transform: createDefaultTransform(),
          adjustments: createDefaultAdjustments(),
          animation: createDefaultAnimation(),
          audio: {
            volume: 100,
            muted: false,
            fadeIn: 0.2,
            fadeOut: 0.2,
            synthPreset: 'ambient',
            waveform: [0.25, 0.65, 0.85, 0.5, 0.75, 0.4, 0.6, 0.3],
          },
        },
      ],
    }));
    setSelectedClipId(voId);
  }, [commitTimeline, currentTime, isRecordingVoice]);

  // Direct clip updater (for smooth slider & canvas drags)
  const handleUpdateClip = useCallback(
    (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => {
      setTimeline((prev) => ({
        ...prev,
        clips: prev.clips.map((c) => (c.id === clipId ? updater(c) : c)),
      }));
    },
    [],
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditingInput) return;

      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      if (e.code === 'Space' && !hasModifier) {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleCopySelected();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handlePasteClip();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (!hasModifier && (e.key === 'v' || e.key === 'V')) {
        setToolMode('select');
      } else if (!hasModifier && (e.key === 'b' || e.key === 'B')) {
        setToolMode('blade');
      } else if (!hasModifier && (e.key === 'q' || e.key === 'Q')) {
        handleDeleteLeft();
      } else if (!hasModifier && (e.key === 'w' || e.key === 'W')) {
        handleDeleteRight();
      } else if (!hasModifier && (e.key === 'm' || e.key === 'M')) {
        handleMergeSelected();
      } else if (!hasModifier && (e.key === 'k' || e.key === 'K')) {
        handleAddMarker();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t0) => Math.max(0, t0 - 1 / project.fps));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t0) =>
          Math.min(Math.max(1, totalDuration), t0 + 1 / project.fps),
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleAddMarker,
    handleCopySelected,
    handleDeleteLeft,
    handleDeleteRight,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleMergeSelected,
    handlePasteClip,
    handleRedo,
    handleSplitAtPlayhead,
    handleUndo,
    project.fps,
    totalDuration,
  ]);

  const projectJsonString = useMemo(
    () => JSON.stringify({ project, timeline }, null, 2),
    [project, timeline],
  );

  const timelineHeightClass =
    layoutMode === 'timeline'
      ? 'h-[52vh]'
      : layoutMode === 'preview'
        ? 'h-[26vh]'
        : 'h-[38vh] min-h-[235px]';

  return (
    <div
      data-testid="klipframe-workspace"
      data-playing={isPlaying ? 'true' : 'false'}
      data-clip-count={timeline.clips.length}
      className="h-screen w-screen overflow-hidden flex flex-col bg-[#0e0e10] text-[#ececf0]"
    >
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleImportFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      <TopBar
        projectName={project.name}
        onRenameProject={(name) => setProject((p) => ({ ...p, name }))}
        lastSavedTime={lastSavedTime}
        lang={lang}
        t={t}
        onToggleLang={() => setLang((l) => (l === 'es' ? 'en' : 'es'))}
        onNewEmptyProject={() => {
          setIsPlaying(false);
          setSelectedClipId(null);
          setCurrentTime(0);
          commitTimeline(() => ({ tracks: DEFAULT_TRACKS, clips: [], markers: [] }));
        }}
        onClearTimeline={() => {
          setIsPlaying(false);
          setSelectedClipId(null);
          setCurrentTime(0);
          commitTimeline((prev) => ({ ...prev, clips: [], markers: [] }));
        }}
        onRestoreDemo={() => {
          setIsPlaying(false);
          setCurrentTime(1.8);
          commitTimeline(() => ({
            tracks: DEFAULT_TRACKS,
            clips: createInitialDemoClips(),
            markers: [],
          }));
          setSelectedClipId('clip-demo-text-1');
        }}
        onTriggerImport={() => hiddenFileInputRef.current?.click()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenExport={() => {
          setIsPlaying(false);
          setExportOpen(true);
        }}
        layoutMode={layoutMode}
        onCycleLayout={() =>
          setLayoutMode((m) =>
            m === 'default' ? 'timeline' : m === 'timeline' ? 'preview' : 'default',
          )
        }
      />

      {/* Top 3-Pane Studio Grid */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] xl:grid-cols-[380px_1fr_340px] overflow-hidden">
        <ResourcePanel
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          mediaAssets={mediaAssets}
          savedTextPresets={savedTextPresets}
          t={t}
          onImportFiles={handleImportFiles}
          onAddMediaToTimeline={(asset) => handleAddMediaToTimeline(asset)}
          onAddOverlayToTimeline={handleAddOverlayToTimeline}
          onAddAudioToTimeline={handleAddAudioToTimeline}
          onAddTextToTimeline={handleAddTextToTimeline}
          onAddStickerToTimeline={handleAddStickerToTimeline}
          onAddEffectToTimeline={handleAddEffectToTimeline}
          onApplyTransition={handleApplyTransition}
          onAddFilterToTimeline={handleAddFilterToTimeline}
          onGenerateAutoCaptions={handleGenerateAutoCaptions}
          onAddManualCaption={handleAddManualCaption}
          onImportSrt={handleImportSrt}
          onExportSrt={handleExportSrt}
          onApplyAdjustmentPreset={handleApplyAdjustmentPreset}
        />

        <PlayerPanel
          project={project}
          tracks={timeline.tracks}
          clips={timeline.clips}
          selectedClipId={selectedClipId}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          cache={cacheRef.current}
          t={t}
          onTogglePlay={() => {
            if (!isPlaying && totalDuration > 0 && currentTime >= totalDuration - 0.05) {
              setCurrentTime(0);
            }
            setIsPlaying((p) => !p);
          }}
          onSeek={(time) => setCurrentTime(Math.max(0, time))}
          onChangeAspectRatio={(aspectRatio: AspectRatioPreset) =>
            setProject((p) => ({ ...p, aspectRatio }))
          }
          onChangePreviewQuality={(previewQuality) =>
            setProject((p) => ({ ...p, previewQuality }))
          }
          onUpdateClipTransform={(clipId, patch) =>
            handleUpdateClip(clipId, (c) => ({
              ...c,
              transform: { ...c.transform, ...patch },
            }))
          }
          onCommitHistory={() => {
            setHistoryPast((p) => [...p.slice(-29), timeline]);
            setHistoryFuture([]);
          }}
          onSelectClip={setSelectedClipId}
        />

        <InspectorPanel
          project={project}
          selectedClip={selectedClip}
          currentTime={currentTime}
          totalDuration={totalDuration}
          tracksCount={timeline.tracks.length}
          clipsCount={timeline.clips.length}
          t={t}
          onOpenProjectSettings={() => setSettingsOpen(true)}
          onUpdateClip={handleUpdateClip}
          onToggleKeyframe={handleToggleKeyframe}
          onGenerateBeatMarkers={handleGenerateBeatMarkers}
          onSaveTextPreset={(style) => {
            setSavedTextPresets((prev) => [
              {
                id: nextId('preset'),
                label: style.content.slice(0, 14) || 'Preset',
                category: 'basic',
                previewBg: 'bg-zinc-900',
                style,
              },
              ...prev,
            ]);
          }}
          onAddTtsAudioClip={(text) => {
            audioEngine.speakText(text);
            const ttsId = nextId('tts');
            commitTimeline((prev) => ({
              ...prev,
              clips: [
                ...prev.clips,
                {
                  id: ttsId,
                  trackId: 'track-audio-main',
                  kind: 'audio',
                  name: `TTS: ${text.slice(0, 18)}`,
                  startTime: currentTime,
                  duration: Math.max(2, Math.min(8, text.length * 0.12)),
                  trimStart: 0,
                  sourceDuration: 10,
                  speed: 1,
                  transform: createDefaultTransform(),
                  adjustments: createDefaultAdjustments(),
                  animation: createDefaultAnimation(),
                  audio: {
                    volume: 100,
                    muted: false,
                    fadeIn: 0.1,
                    fadeOut: 0.2,
                    synthPreset: 'vlog',
                    waveform: [0.3, 0.7, 0.85, 0.4, 0.9, 0.5, 0.7, 0.35],
                  },
                },
              ],
            }));
            setSelectedClipId(ttsId);
          }}
        />
      </main>

      {/* Bottom Multi-Track Timeline */}
      <div className={`${timelineHeightClass} shrink-0 overflow-hidden`}>
        <TimelinePanel
          tracks={timeline.tracks}
          clips={timeline.clips}
          markers={timeline.markers ?? []}
          selectedClipId={selectedClipId}
          currentTime={currentTime}
          totalDuration={totalDuration}
          fps={project.fps}
          pxPerSecond={pxPerSecond}
          toolMode={toolMode}
          snapEnabled={snapEnabled}
          rippleEnabled={rippleEnabled}
          canUndo={historyPast.length > 0}
          canRedo={historyFuture.length > 0}
          isRecordingVoice={isRecordingVoice}
          t={t}
          onChangeToolMode={setToolMode}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSplitAtPlayhead={handleSplitAtPlayhead}
          onSplitClipAt={handleSplitClipAt}
          onDeleteLeft={handleDeleteLeft}
          onDeleteRight={handleDeleteRight}
          onDeleteSelected={handleDeleteSelected}
          onMergeSelected={handleMergeSelected}
          canMerge={canMergeSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onCopySelected={handleCopySelected}
          onPasteClip={handlePasteClip}
          canPaste={Boolean(copiedClip)}
          onFreezeFrame={handleFreezeFrame}
          onReverseSelected={handleReverseSelected}
          onDetachAudioSelected={handleDetachAudioSelected}
          onToggleKeyframeSelected={() => {
            if (selectedClipId) handleToggleKeyframe(selectedClipId);
          }}
          onAddMarker={handleAddMarker}
          onRemoveMarker={handleRemoveMarker}
          onAddTrack={handleAddTrack}
          onToggleRecordVoice={handleToggleRecordVoice}
          onToggleSnap={() => setSnapEnabled((s) => !s)}
          onToggleRipple={() => setRippleEnabled((r) => !r)}
          onChangeZoom={setPxPerSecond}
          onFitZoom={() => {
            const dur = Math.max(10, totalDuration);
            const targetPx = Math.max(14, Math.min(90, Math.round(920 / dur)));
            setPxPerSecond(targetPx);
          }}
          onSeek={(time) => setCurrentTime(Math.max(0, time))}
          onSelectClip={setSelectedClipId}
          onToggleTrackFlag={(trackId, flag) =>
            commitTimeline((prev) => ({
              ...prev,
              tracks: prev.tracks.map((tr) =>
                tr.id === trackId ? { ...tr, [flag]: !tr[flag] } : tr,
              ),
            }))
          }
          onUpdateClipNoHistory={handleUpdateClip}
          onCommitHistory={() => {
            setHistoryPast((p) => [...p.slice(-29), timeline]);
            setHistoryFuture([]);
          }}
          onDropAssetOnTimeline={(assetId, dropTime) => {
            const asset = mediaAssets.find((a) => a.id === assetId);
            if (asset) handleAddMediaToTimeline(asset, dropTime);
          }}
          onOpenCoverModal={() => setCoverOpen(true)}
          onLoadSampleProject={() => {
            setCurrentTime(1.8);
            commitTimeline(() => ({
              tracks: DEFAULT_TRACKS,
              clips: createInitialDemoClips(),
              markers: [],
            }));
            setSelectedClipId('clip-demo-text-1');
          }}
          onClearTimeline={() => {
            setIsPlaying(false);
            setSelectedClipId(null);
            setCurrentTime(0);
            commitTimeline((prev) => ({ ...prev, clips: [], markers: [] }));
          }}
        />
      </div>

      {/* Modals */}
      <ExportModal
        open={exportOpen}
        project={project}
        tracks={timeline.tracks}
        clips={timeline.clips}
        totalDuration={totalDuration}
        cache={cacheRef.current}
        onClose={() => setExportOpen(false)}
      />

      <ProjectSettingsModal
        open={settingsOpen}
        project={project}
        onSave={setProject}
        onClose={() => setSettingsOpen(false)}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ShareProjectModal
        open={shareOpen}
        projectJson={projectJsonString}
        projectName={project.name}
        onImportJson={(txt) => {
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.project && parsed?.timeline?.tracks && parsed?.timeline?.clips) {
              setProject(parsed.project);
              commitTimeline(() => parsed.timeline);
              setSelectedClipId(null);
            }
          } catch {
            // ignore invalid JSON
          }
        }}
        onClose={() => setShareOpen(false)}
      />

      <CoverModal
        open={coverOpen}
        currentTime={currentTime}
        coverTime={project.coverTime}
        onSetCoverTime={(coverTime) => setProject((p) => ({ ...p, coverTime }))}
        onClose={() => setCoverOpen(false)}
      />
    </div>
  );
}
