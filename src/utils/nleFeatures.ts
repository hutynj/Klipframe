import type {
  KeyframeEntry,
  SpeedCurvePreset,
  TimelineClip,
} from '../types/editor';
import {
  createDefaultAdjustments,
  createDefaultAnimation,
  createDefaultTransform,
  findNonOverlappingStart,
} from './timelineOps';

export const SPEED_CURVE_POINTS: Record<SpeedCurvePreset, Array<[number, number]>> = {
  none: [
    [0, 1],
    [1, 1],
  ],
  montage: [
    [0, 0.6],
    [0.25, 2.2],
    [0.5, 0.7],
    [0.75, 2.4],
    [1, 0.8],
  ],
  hero: [
    [0, 1.8],
    [0.3, 1.8],
    [0.45, 0.35],
    [0.7, 0.35],
    [0.85, 2.0],
    [1, 1.6],
  ],
  bullet: [
    [0, 3.0],
    [0.25, 0.4],
    [0.75, 0.4],
    [1, 2.8],
  ],
  jumpCut: [
    [0, 0.7],
    [0.35, 0.7],
    [0.45, 3.2],
    [0.6, 3.2],
    [0.7, 0.7],
    [1, 0.7],
  ],
  flashIn: [
    [0, 3.2],
    [0.4, 1.1],
    [1, 0.85],
  ],
  flashOut: [
    [0, 0.85],
    [0.6, 1.1],
    [1, 3.2],
  ],
};

export function upsertKeyframe(
  keyframes: KeyframeEntry[] | undefined,
  timeOffset: number,
  patch: Omit<KeyframeEntry, 'timeOffset'>,
  tolerance = 0.08,
): KeyframeEntry[] {
  const clampedTime = Number(Math.max(0, timeOffset).toFixed(3));
  const list = [...(keyframes ?? [])];
  const existingIdx = list.findIndex(
    (kf) => Math.abs(kf.timeOffset - clampedTime) <= tolerance,
  );
  if (existingIdx >= 0) {
    list[existingIdx] = {
      ...list[existingIdx],
      ...patch,
      timeOffset: list[existingIdx].timeOffset,
    };
  } else {
    list.push({ timeOffset: clampedTime, ...patch });
  }
  return list.sort((a, b) => a.timeOffset - b.timeOffset);
}

export function removeKeyframeAt(
  keyframes: KeyframeEntry[] | undefined,
  timeOffset: number,
  tolerance = 0.08,
): KeyframeEntry[] {
  if (!keyframes || keyframes.length === 0) return [];
  return keyframes.filter((kf) => Math.abs(kf.timeOffset - timeOffset) > tolerance);
}

export function hasKeyframeNear(
  keyframes: KeyframeEntry[] | undefined,
  timeOffset: number,
  tolerance = 0.08,
): boolean {
  if (!keyframes || keyframes.length === 0) return false;
  return keyframes.some((kf) => Math.abs(kf.timeOffset - timeOffset) <= tolerance);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function evaluateKeyframesAtTime(
  clip: TimelineClip,
  timelineTime: number,
): { scale: number; x: number; y: number; rotation: number; opacity: number } {
  const baseScale = clip.transform.uniformScale
    ? clip.transform.scale
    : (clip.transform.scaleX + clip.transform.scaleY) / 2;

  const base = {
    scale: baseScale,
    x: clip.transform.x,
    y: clip.transform.y,
    rotation: clip.transform.rotation,
    opacity: clip.transform.opacity,
  };

  const kfs = clip.keyframes;
  if (!kfs || kfs.length === 0) return base;

  const rel = Math.max(0, Math.min(clip.duration, timelineTime - clip.startTime));
  const sorted = [...kfs].sort((a, b) => a.timeOffset - b.timeOffset);

  const pickVal = (
    key: 'scale' | 'x' | 'y' | 'rotation' | 'opacity',
    fallback: number,
  ): number => {
    const withProp = sorted.filter((k) => typeof k[key] === 'number');
    if (withProp.length === 0) return fallback;
    if (rel <= withProp[0].timeOffset) return withProp[0][key] as number;
    if (rel >= withProp[withProp.length - 1].timeOffset) {
      return withProp[withProp.length - 1][key] as number;
    }
    for (let i = 0; i < withProp.length - 1; i++) {
      const a = withProp[i];
      const b = withProp[i + 1];
      if (rel >= a.timeOffset && rel <= b.timeOffset) {
        const span = Math.max(0.0001, b.timeOffset - a.timeOffset);
        const t = (rel - a.timeOffset) / span;
        // Smoothstep easing for smooth NLE motion interpolation
        const ease = t * t * (3 - 2 * t);
        return lerp(a[key] as number, b[key] as number, ease);
      }
    }
    return fallback;
  };

  return {
    scale: pickVal('scale', base.scale),
    x: pickVal('x', base.x),
    y: pickVal('y', base.y),
    rotation: pickVal('rotation', base.rotation),
    opacity: pickVal('opacity', base.opacity),
  };
}

export function evaluateSpeedCurveMultiplier(
  preset: SpeedCurvePreset | undefined,
  normalizedTime: number,
): number {
  if (!preset || preset === 'none') return 1;
  const pts = SPEED_CURVE_POINTS[preset] ?? SPEED_CURVE_POINTS.none;
  const tNorm = Math.max(0, Math.min(1, normalizedTime));
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (tNorm >= t0 && tNorm <= t1) {
      const span = Math.max(0.0001, t1 - t0);
      return lerp(v0, v1, (tNorm - t0) / span);
    }
  }
  return 1;
}

export function remapSpeedCurveTime(
  clip: TimelineClip,
  localElapsedSeconds: number,
): number {
  const dur = Math.max(0.001, clip.duration);
  const clamped = Math.max(0, Math.min(dur, localElapsedSeconds));
  const preset = clip.speedCurve ?? 'none';

  let mappedOffset = 0;
  if (preset === 'none') {
    mappedOffset = clamped * clip.speed;
  } else {
    // Numerical integration along curve points for monotonic, smooth time remapping
    const steps = 24;
    const targetNorm = clamped / dur;
    const stepNorm = targetNorm / steps;
    let accum = 0;
    for (let i = 0; i < steps; i++) {
      const mid = (i + 0.5) * stepNorm;
      accum += evaluateSpeedCurveMultiplier(preset, mid) * stepNorm;
    }
    mappedOffset = accum * dur * clip.speed;
  }

  const maxSpan = Math.max(0.1, dur * clip.speed);
  if (clip.reversed) {
    const endSource = Math.min(clip.sourceDuration, clip.trimStart + maxSpan);
    return Number(Math.max(0, endSource - mappedOffset).toFixed(3));
  }
  return Number(Math.min(clip.sourceDuration, clip.trimStart + mappedOffset).toFixed(3));
}

export function detachAudioFromClip(
  clips: TimelineClip[],
  clipId: string,
  makeId: () => string,
  audioTrackId = 'track-audio-main',
): { clips: TimelineClip[]; detachedClipId: string | null } {
  const target = clips.find((c) => c.id === clipId);
  if (!target || (target.kind !== 'video' && target.kind !== 'image')) {
    return { clips, detachedClipId: null };
  }

  const detachedId = makeId();
  const waveform =
    target.audio?.waveform && target.audio.waveform.length > 0
      ? target.audio.waveform
      : Array.from({ length: 32 }, (_, i) =>
          Number((0.25 + 0.55 * Math.abs(Math.sin(i * 0.55 + 1.1))).toFixed(2)),
        );

  const start = findNonOverlappingStart(
    clips,
    audioTrackId,
    target.startTime,
    target.duration,
  );

  const extractedAudio: TimelineClip = {
    id: detachedId,
    trackId: audioTrackId,
    kind: 'audio',
    name: `${target.name} (Audio)`,
    assetId: target.assetId,
    src: target.src,
    startTime: start,
    duration: target.duration,
    trimStart: target.trimStart,
    sourceDuration: target.sourceDuration,
    speed: target.speed,
    reversed: target.reversed,
    transform: createDefaultTransform(),
    adjustments: createDefaultAdjustments(),
    animation: createDefaultAnimation(),
    audio: {
      volume: target.audio?.volume ?? 100,
      muted: false,
      fadeIn: target.audio?.fadeIn ?? 0.2,
      fadeOut: target.audio?.fadeOut ?? 0.2,
      synthPreset: target.audio?.synthPreset ?? 'ambient',
      waveform,
      voiceEffect: target.audio?.voiceEffect ?? 'normal',
      noiseReduction: target.audio?.noiseReduction ?? false,
      normalize: target.audio?.normalize ?? false,
    },
  };

  const nextClips = clips.map((c) =>
    c.id === clipId
      ? {
          ...c,
          audioDetached: true,
          audio: {
            volume: c.audio?.volume ?? 100,
            muted: true,
            fadeIn: c.audio?.fadeIn ?? 0,
            fadeOut: c.audio?.fadeOut ?? 0,
            waveform,
            synthPreset: c.audio?.synthPreset,
          },
        }
      : c,
  );

  return { clips: [...nextClips, extractedAudio], detachedClipId: detachedId };
}

function parseSrtTimestamp(raw: string): number {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length !== 3) return 0;
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const s = Number(parts[2]) || 0;
  return Number((h * 3600 + m * 60 + s).toFixed(3));
}

function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(Math.min(999, n)).padStart(3, '0');
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

export interface ParsedSrtCue {
  start: number;
  end: number;
  text: string;
}

export function parseSrt(srtText: string): ParsedSrtCue[] {
  const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const cues: ParsedSrtCue[] = [];
  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;
    const timingLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingLineIdx === -1) continue;
    const [startRaw, endRaw] = lines[timingLineIdx].split('-->');
    if (!startRaw || !endRaw) continue;
    const start = parseSrtTimestamp(startRaw);
    const end = Math.max(start + 0.3, parseSrtTimestamp(endRaw));
    const text = lines.slice(timingLineIdx + 1).join(' ').trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

export function serializeSrt(clips: TimelineClip[]): string {
  const captionClips = clips
    .filter((c) => c.kind === 'caption' && c.text?.content)
    .sort((a, b) => a.startTime - b.startTime);

  return captionClips
    .map((clip, idx) => {
      const start = formatSrtTimestamp(clip.startTime);
      const end = formatSrtTimestamp(clip.startTime + clip.duration);
      return `${idx + 1}\n${start} --> ${end}\n${clip.text?.content ?? ''}`;
    })
    .join('\n\n');
}
