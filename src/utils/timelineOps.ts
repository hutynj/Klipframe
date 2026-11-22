import type {
  AnimationProps,
  ColorAdjustments,
  TimelineClip,
  TimelineTrack,
  TransformProps,
} from '../types/editor';

export const MIN_CLIP_DURATION = 0.3;

export function createDefaultTransform(): TransformProps {
  return {
    scale: 1,
    uniformScale: true,
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 100,
    flipH: false,
    flipV: false,
    blendMode: 'normal',
    mask: 'none',
  };
}

export function createDefaultAdjustments(): ColorAdjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    exposure: 0,
    hue: 0,
    sharpen: 0,
    vignette: 0,
    fade: 0,
  };
}

export function createDefaultAnimation(): AnimationProps {
  return {
    inPreset: 'none',
    inDuration: 0.5,
    outPreset: 'none',
    outDuration: 0.5,
  };
}

export function computeProjectDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  return clips.reduce(
    (maxEnd, clip) => Math.max(maxEnd, clip.startTime + clip.duration),
    0,
  );
}

export function findTrackEndTime(
  clips: TimelineClip[],
  trackId: string,
): number {
  return clips
    .filter((c) => c.trackId === trackId)
    .reduce((maxEnd, c) => Math.max(maxEnd, c.startTime + c.duration), 0);
}

export function findNonOverlappingStart(
  clips: TimelineClip[],
  trackId: string,
  desiredStart: number,
  duration: number,
  excludeClipId?: string,
): number {
  const trackClips = clips
    .filter((c) => c.trackId === trackId && c.id !== excludeClipId)
    .sort((a, b) => a.startTime - b.startTime);

  let candidate = Math.max(0, desiredStart);
  for (const existing of trackClips) {
    const existingEnd = existing.startTime + existing.duration;
    const candidateEnd = candidate + duration;
    const overlaps =
      candidate < existingEnd - 0.001 && candidateEnd > existing.startTime + 0.001;
    if (overlaps) {
      candidate = existingEnd;
    }
  }
  return Number(candidate.toFixed(3));
}

export function splitClipAtTime(
  clips: TimelineClip[],
  clipId: string,
  splitTime: number,
  makeId: () => string,
): TimelineClip[] {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return clips;

  const rel = splitTime - target.startTime;
  if (rel <= MIN_CLIP_DURATION || target.duration - rel <= MIN_CLIP_DURATION) {
    return clips;
  }

  const leftKeyframes = target.keyframes
    ? target.keyframes.filter((kf) => kf.timeOffset <= rel + 0.001)
    : undefined;

  const rightKeyframes = target.keyframes
    ? target.keyframes
        .filter((kf) => kf.timeOffset >= rel - 0.001)
        .map((kf) => ({
          ...kf,
          timeOffset: Number(Math.max(0, kf.timeOffset - rel).toFixed(3)),
        }))
    : undefined;

  const leftClip: TimelineClip = {
    ...target,
    duration: Number(rel.toFixed(3)),
    transitionOut: undefined,
    keyframes: leftKeyframes && leftKeyframes.length > 0 ? leftKeyframes : undefined,
  };

  const rightClip: TimelineClip = {
    ...target,
    id: makeId(),
    startTime: Number(splitTime.toFixed(3)),
    duration: Number((target.duration - rel).toFixed(3)),
    trimStart: Number((target.trimStart + rel * target.speed).toFixed(3)),
    keyframes: rightKeyframes && rightKeyframes.length > 0 ? rightKeyframes : undefined,
  };

  return clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c]));
}

export function deleteClipsByIds(
  clips: TimelineClip[],
  ids: string[],
  rippleMainTrack = false,
  mainTrackId = 'track-video-main',
): TimelineClip[] {
  const idSet = new Set(ids);
  const remaining = clips.filter((c) => !idSet.has(c.id));

  if (!rippleMainTrack) return remaining;

  const mainClips = remaining
    .filter((c) => c.trackId === mainTrackId)
    .sort((a, b) => a.startTime - b.startTime);

  let cursor = 0;
  const compactedMain = mainClips.map((clip) => {
    const updated = { ...clip, startTime: Number(cursor.toFixed(3)) };
    cursor += clip.duration;
    return updated;
  });

  const nonMain = remaining.filter((c) => c.trackId !== mainTrackId);
  return [...nonMain, ...compactedMain];
}

export function deleteLeftOfPlayhead(
  clips: TimelineClip[],
  clipId: string,
  playheadTime: number,
): TimelineClip[] {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    const rel = playheadTime - clip.startTime;
    if (rel <= 0.05 || clip.duration - rel < MIN_CLIP_DURATION) return clip;
    return {
      ...clip,
      startTime: Number(playheadTime.toFixed(3)),
      duration: Number((clip.duration - rel).toFixed(3)),
      trimStart: Number((clip.trimStart + rel * clip.speed).toFixed(3)),
    };
  });
}

export function deleteRightOfPlayhead(
  clips: TimelineClip[],
  clipId: string,
  playheadTime: number,
): TimelineClip[] {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    const rel = playheadTime - clip.startTime;
    if (rel < MIN_CLIP_DURATION || rel >= clip.duration - 0.05) return clip;
    return {
      ...clip,
      duration: Number(rel.toFixed(3)),
      transitionOut: undefined,
    };
  });
}

export function trimClipEdge(
  clip: TimelineClip,
  edge: 'left' | 'right',
  deltaSeconds: number,
): TimelineClip {
  if (edge === 'left') {
    const maxShift = clip.duration - MIN_CLIP_DURATION;
    const minShift = -Math.min(clip.startTime, clip.trimStart / clip.speed);
    const clampedShift = Math.max(minShift, Math.min(maxShift, deltaSeconds));
    return {
      ...clip,
      startTime: Number((clip.startTime + clampedShift).toFixed(3)),
      duration: Number((clip.duration - clampedShift).toFixed(3)),
      trimStart: Number(
        Math.max(0, clip.trimStart + clampedShift * clip.speed).toFixed(3),
      ),
    };
  }

  const maxExtra =
    clip.kind === 'video' || clip.kind === 'audio'
      ? Math.max(0, (clip.sourceDuration - clip.trimStart) / clip.speed - clip.duration)
      : 120;
  const minDuration = MIN_CLIP_DURATION;
  const nextDuration = Math.max(
    minDuration,
    Math.min(clip.duration + maxExtra, clip.duration + deltaSeconds),
  );
  return {
    ...clip,
    duration: Number(nextDuration.toFixed(3)),
  };
}

export function mergeAdjacentClip(
  clips: TimelineClip[],
  clipId: string,
): { clips: TimelineClip[]; mergedId: string | null } {
  const target = clips.find((c) => c.id === clipId);
  if (!target) return { clips, mergedId: null };

  const sameTrack = clips
    .filter((c) => c.trackId === target.trackId)
    .sort((a, b) => a.startTime - b.startTime);

  const idx = sameTrack.findIndex((c) => c.id === clipId);
  if (idx === -1 || idx >= sameTrack.length - 1) {
    return { clips, mergedId: null };
  }

  const nextClip = sameTrack[idx + 1];
  const mergedDuration = Number((target.duration + nextClip.duration).toFixed(3));
  const combinedKeyframes = [
    ...(target.keyframes ?? []),
    ...(nextClip.keyframes ?? []).map((kf) => ({
      ...kf,
      timeOffset: Number((kf.timeOffset + target.duration).toFixed(3)),
    })),
  ];
  const mergedClip: TimelineClip = {
    ...target,
    name: target.name.includes('+') ? target.name : `${target.name} + ${nextClip.name}`,
    duration: mergedDuration,
    sourceDuration: Math.max(target.sourceDuration, target.trimStart + mergedDuration * target.speed),
    transitionOut: nextClip.transitionOut,
    keyframes: combinedKeyframes.length > 0 ? combinedKeyframes : undefined,
  };

  // Shift subsequent clips if there was a gap between target and nextClip
  const gap = Math.max(0, nextClip.startTime - (target.startTime + target.duration));
  const nextClips = clips
    .filter((c) => c.id !== nextClip.id)
    .map((c) => {
      if (c.id === target.id) return mergedClip;
      if (gap > 0 && c.trackId === target.trackId && c.startTime > nextClip.startTime) {
        return { ...c, startTime: Number(Math.max(0, c.startTime - gap).toFixed(3)) };
      }
      return c;
    });

  return { clips: nextClips, mergedId: mergedClip.id };
}

export function snapTime(
  targetTime: number,
  clips: TimelineClip[],
  playheadTime: number,
  excludeClipId: string,
  snapEnabled: boolean,
  thresholdSeconds = 0.2,
): number {
  const safe = Math.max(0, targetTime);
  if (!snapEnabled) return Number(safe.toFixed(3));

  const candidates = [0, playheadTime];
  for (const clip of clips) {
    if (clip.id === excludeClipId) continue;
    candidates.push(clip.startTime, clip.startTime + clip.duration);
  }

  let best = safe;
  let bestDist = thresholdSeconds;
  for (const point of candidates) {
    const dist = Math.abs(safe - point);
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return Number(Math.max(0, best).toFixed(3));
}

export function getActiveClipsAtTime(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  time: number,
): TimelineClip[] {
  const hiddenTracks = new Set(tracks.filter((t) => t.hidden).map((t) => t.id));
  const trackOrder = new Map(tracks.map((t, idx) => [t.id, idx]));

  return clips
    .filter(
      (c) =>
        !hiddenTracks.has(c.trackId) &&
        time >= c.startTime - 0.0001 &&
        time < c.startTime + c.duration - 0.0001,
    )
    .sort((a, b) => {
      // Lower track index renders on top in visual layering; main video at bottom
      const oa = trackOrder.get(a.trackId) ?? 0;
      const ob = trackOrder.get(b.trackId) ?? 0;
      return ob - oa;
    });
}

export function computeAnimationState(
  clip: TimelineClip,
  time: number,
): { opacityMul: number; scaleMul: number; offsetX: number; offsetY: number; rotOffset: number } {
  const rel = time - clip.startTime;
  const remaining = clip.startTime + clip.duration - time;
  let opacityMul = 1;
  let scaleMul = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotOffset = 0;

  const { inPreset, inDuration, outPreset, outDuration } = clip.animation;

  if (inPreset !== 'none' && inDuration > 0 && rel < inDuration) {
    const p = Math.max(0, Math.min(1, rel / inDuration));
    const ease = 1 - Math.pow(1 - p, 3);
    switch (inPreset) {
      case 'fadeIn':
        opacityMul *= ease;
        break;
      case 'zoomIn':
        opacityMul *= ease;
        scaleMul *= 0.65 + 0.35 * ease;
        break;
      case 'slideUp':
        opacityMul *= ease;
        offsetY += (1 - ease) * 90;
        break;
      case 'slideLeft':
        opacityMul *= ease;
        offsetX += (1 - ease) * 140;
        break;
      case 'pop': {
        const bounce = p < 0.7 ? (p / 0.7) * 1.12 : 1.12 - ((p - 0.7) / 0.3) * 0.12;
        scaleMul *= Math.max(0.2, bounce);
        opacityMul *= Math.min(1, p * 3);
        break;
      }
      case 'spin':
        opacityMul *= ease;
        scaleMul *= 0.4 + 0.6 * ease;
        rotOffset += (1 - ease) * -180;
        break;
      default:
        break;
    }
  }

  if (outPreset !== 'none' && outDuration > 0 && remaining < outDuration) {
    const p = Math.max(0, Math.min(1, remaining / outDuration));
    const ease = 1 - Math.pow(1 - p, 2);
    switch (outPreset) {
      case 'fadeIn':
        opacityMul *= ease;
        break;
      case 'zoomIn':
        opacityMul *= ease;
        scaleMul *= 0.7 + 0.3 * ease;
        break;
      case 'slideUp':
        opacityMul *= ease;
        offsetY -= (1 - ease) * 80;
        break;
      case 'slideLeft':
        opacityMul *= ease;
        offsetX -= (1 - ease) * 120;
        break;
      default:
        opacityMul *= ease;
        break;
    }
  }

  return { opacityMul, scaleMul, offsetX, offsetY, rotOffset };
}

export function generateBeatMarkerTimes(
  startTime: number,
  duration: number,
  bpm = 110,
  maxBeats = 24,
): number[] {
  const safeBpm = Math.max(40, Math.min(220, bpm));
  const beatStep = (60 / safeBpm) * 2; // mark every 2 beats for clean timeline spacing
  const times: number[] = [];
  for (let offset = beatStep; offset < duration - 0.15 && times.length < maxBeats; offset += beatStep) {
    times.push(Number((startTime + offset).toFixed(2)));
  }
  return times;
}
