import { FILTER_PRESETS } from '../data/presets';
import type {
  CanvasBackgroundConfig,
  ChromaKeyProps,
  ColorAdjustments,
  CropRect,
  EffectPresetId,
  FilterPresetId,
  TimelineClip,
  TimelineTrack,
} from '../types/editor';
import { evaluateKeyframesAtTime, remapSpeedCurveTime } from './nleFeatures';
import { computeAnimationState, getActiveClipsAtTime } from './timelineOps';

export interface MediaCache {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
  chromaCanvas?: HTMLCanvasElement;
}

export function createMediaCache(): MediaCache {
  return {
    images: new Map(),
    videos: new Map(),
  };
}

function getOrLoadImage(
  cache: MediaCache,
  src: string,
  onReady?: () => void,
): HTMLImageElement | null {
  if (!src || src.startsWith('procedural:')) return null;
  const existing = cache.images.get(src);
  if (existing) {
    return existing.complete && existing.naturalWidth > 0 ? existing : null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    onReady?.();
  };
  img.src = src;
  cache.images.set(src, img);
  return null;
}

export function getOrLoadVideo(
  cache: MediaCache,
  src: string,
): HTMLVideoElement | null {
  if (!src || src.startsWith('procedural:')) return null;
  const existing = cache.videos.get(src);
  if (existing) return existing;
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  cache.videos.set(src, video);
  return video;
}

function drawProceduralFrame(
  ctx: CanvasRenderingContext2D,
  kind: 'spring' | 'sunset' | 'neon' | 'abstract',
  width: number,
  height: number,
  t: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  if (kind === 'spring') {
    grad.addColorStop(0, '#0f3d3e');
    grad.addColorStop(0.5, '#1d6f5f');
    grad.addColorStop(1, '#d9b44a');
  } else if (kind === 'sunset') {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.45, '#be185d');
    grad.addColorStop(1, '#f59e0b');
  } else if (kind === 'neon') {
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(0.5, '#083344');
    grad.addColorStop(1, '#1e1b4b');
  } else {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#164e63');
    grad.addColorStop(1, '#312e81');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  ctx.save();
  for (let i = 0; i < 6; i++) {
    const phase = t * (0.4 + i * 0.08) + i * 1.1;
    const cx = Math.sin(phase) * width * 0.28;
    const cy = Math.cos(phase * 0.8) * height * 0.22;
    const r = Math.min(width, height) * (0.18 + (i % 3) * 0.08);
    const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const hue = kind === 'sunset' ? 28 + i * 14 : kind === 'neon' ? 180 + i * 25 : 155 + i * 15;
    orb.addColorStop(0, `hsla(${hue}, 85%, 65%, 0.35)`);
    orb.addColorStop(1, `hsla(${hue}, 85%, 50%, 0)`);
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (kind === 'neon') {
    ctx.strokeStyle = 'rgba(0, 213, 220, 0.22)';
    ctx.lineWidth = 2;
    const step = width / 12;
    const shift = (t * 45) % step;
    for (let x = -width / 2 + shift; x < width / 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -height / 2);
      ctx.lineTo(x, height / 2);
      ctx.stroke();
    }
    for (let y = -height / 2 + shift; y < height / 2; y += step) {
      ctx.beginPath();
      ctx.moveTo(-width / 2, y);
      ctx.lineTo(width / 2, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function buildFilterString(
  adj: ColorAdjustments,
  extraFilter?: { id: FilterPresetId; intensity: number },
): string {
  let b = 100 + adj.brightness * 0.8 + adj.exposure * 0.7;
  let c = 100 + adj.contrast * 1.1 + adj.sharpen * 0.35;
  let s = 100 + adj.saturation * 1.6 + adj.sharpen * 0.15;
  let h = adj.hue;
  let sepia = adj.temperature > 0 ? adj.temperature * 0.5 : 0;

  if (extraFilter && extraFilter.id !== 'none') {
    const preset = FILTER_PRESETS.find((f) => f.id === extraFilter.id);
    if (preset) {
      const k = extraFilter.intensity / 100;
      const fa = preset.adjustments;
      b += (fa.brightness ?? 0) * 0.8 * k;
      c += (fa.contrast ?? 0) * 1.1 * k;
      s += (fa.saturation ?? 0) * 1.6 * k;
      h += (fa.hue ?? 0) * k;
      if ((fa.temperature ?? 0) > 0) sepia += (fa.temperature ?? 0) * 0.5 * k;
    }
  }

  b = Math.max(20, Math.min(220, b));
  c = Math.max(20, Math.min(220, c));
  s = Math.max(0, Math.min(250, s));

  // Fast path: skip GPU/software offscreen filter pass on unmodified clips
  const parts: string[] = [];
  if (Math.abs(b - 100) >= 0.5) parts.push(`brightness(${b.toFixed(0)}%)`);
  if (Math.abs(c - 100) >= 0.5) parts.push(`contrast(${c.toFixed(0)}%)`);
  if (Math.abs(s - 100) >= 0.5) parts.push(`saturate(${s.toFixed(0)}%)`);
  if (Math.abs(h) >= 0.5) parts.push(`hue-rotate(${h.toFixed(0)}deg)`);
  if (Math.abs(sepia) >= 0.5) parts.push(`sepia(${sepia.toFixed(0)}%)`);

  return parts.length > 0 ? parts.join(' ') : 'none';
}

function applyMask(
  ctx: CanvasRenderingContext2D,
  mask: TimelineClip['transform']['mask'],
  w: number,
  h: number,
): void {
  if (mask === 'none') return;
  ctx.beginPath();
  if (mask === 'circle') {
    ctx.arc(0, 0, Math.min(w, h) * 0.4, 0, Math.PI * 2);
  } else if (mask === 'rectangle') {
    const rw = w * 0.72;
    const rh = h * 0.72;
    ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 28);
  } else if (mask === 'split') {
    ctx.rect(-w / 2, -h / 2, w / 2, h);
  } else if (mask === 'filmstrip') {
    const rh = h * 0.68;
    ctx.rect(-w / 2, -rh / 2, w, rh);
  }
  ctx.clip();
}

function drawEffectOverlay(
  ctx: CanvasRenderingContext2D,
  effectId: EffectPresetId,
  intensity: number,
  w: number,
  h: number,
  time: number,
): void {
  const k = Math.max(0, Math.min(1, intensity / 100));
  ctx.save();

  if (effectId === 'rgbSplit') {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(0, 213, 220, ${0.14 * k})`;
    ctx.fillRect(-10 * k, 0, w, h);
    ctx.fillStyle = `rgba(244, 63, 94, ${0.14 * k})`;
    ctx.fillRect(10 * k, 0, w, h);
  } else if (effectId === 'vhsScanlines' || effectId === 'retroTV') {
    const scanStep = Math.max(4, Math.round(h / 180));
    const barThickness = Math.max(1.5, scanStep * 0.34);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * k})`;
    for (let y = 0; y < h; y += scanStep) {
      ctx.fillRect(0, y, w, barThickness);
    }
    if (effectId === 'retroTV') {
      const scanY = ((time * 160) % (h + 80)) - 40;
      const g = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.12 * k})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, scanY - 30, w, 60);
    }
  } else if (effectId === 'filmGrain') {
    const count = Math.round(180 * k);
    for (let i = 0; i < count; i++) {
      const x = ((Math.sin(i * 12.9898 + time * 40) * 43758.5453) % 1 + 1) % 1;
      const y = ((Math.sin(i * 78.233 + time * 27) * 24634.6345) % 1 + 1) % 1;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${0.18 * k})` : `rgba(0,0,0,${0.2 * k})`;
      ctx.fillRect(x * w, y * h, 2.5, 2.5);
    }
  } else if (effectId === 'sparkle') {
    const stars = 18;
    for (let i = 0; i < stars; i++) {
      const sx = (((i * 197 + 50) % 1000) / 1000) * w;
      const sy = (((i * 353 + 120) % 1000) / 1000) * h;
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 3 + i));
      const size = (8 + (i % 4) * 5) * pulse * k;
      ctx.strokeStyle = `rgba(255, 245, 190, ${0.85 * pulse * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - size, sy);
      ctx.lineTo(sx + size, sy);
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx, sy + size);
      ctx.stroke();
    }
  } else if (effectId === 'vignettePulse') {
    const rad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.68);
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(1, `rgba(0,0,0,${0.75 * k})`);
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  } else if (effectId === 'blurGlow') {
    const rad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.55);
    rad.addColorStop(0, `rgba(255,255,255,${0.16 * k})`);
    rad.addColorStop(1, 'rgba(0,213,220,0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  } else if (effectId === 'edgeNeon') {
    ctx.strokeStyle = `rgba(0, 213, 220, ${0.85 * k})`;
    ctx.lineWidth = 10 * k;
    ctx.strokeRect(18, 18, w - 36, h - 36);
  } else if (effectId === 'mirrorSplit') {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.fillStyle = `rgba(20, 184, 166, ${0.14 * k})`;
    ctx.fillRect(w / 2, 0, w / 2, h);
  } else if (effectId === 'shakePulse') {
    const pulse = Math.abs(Math.sin(time * 9)) * k;
    ctx.strokeStyle = `rgba(249, 115, 22, ${0.45 * pulse})`;
    ctx.lineWidth = 14 * pulse;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  } else if (effectId === 'flashStrobe') {
    const strobe = Math.max(0, Math.sin(time * 12)) * 0.42 * k;
    ctx.fillStyle = `rgba(255, 255, 255, ${strobe})`;
    ctx.fillRect(0, 0, w, h);
  } else if (effectId === 'snowFall') {
    ctx.fillStyle = `rgba(240, 249, 255, ${0.85 * k})`;
    for (let i = 0; i < 42; i++) {
      const x = (((i * 97 + time * 30 * (1 + (i % 3) * 0.3)) % w) + w) % w;
      const y = (((i * 61 + time * 95 * (0.8 + (i % 4) * 0.25)) % h) + h) % h;
      const r = 2 + (i % 4) * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  time: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  selectedClipId: string | null;
  showSafeZones: boolean;
  showSelectionBox: boolean;
  cache: MediaCache;
  canvasBg?: CanvasBackgroundConfig;
  isPlaying?: boolean;
  isExporting?: boolean;
  onAssetLoaded?: () => void;
}

export async function prepareExportFrameMedia(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  time: number,
  cache: MediaCache,
): Promise<void> {
  const active = getActiveClipsAtTime(tracks, clips, time);
  const waits: Promise<void>[] = [];

  for (const clip of active) {
    if (clip.kind !== 'video' || !clip.src || clip.proceduralKind) continue;
    const videoEl = getOrLoadVideo(cache, clip.src);
    if (!videoEl || videoEl.readyState < 1) continue;
    const sourceTime = remapSpeedCurveTime(clip, time - clip.startTime);
    const dur = Number.isFinite(videoEl.duration) && videoEl.duration > 0
      ? videoEl.duration
      : clip.sourceDuration;
    const targetVideoTime = Math.max(0, Math.min(dur, sourceTime));
    if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.03) {
      waits.push(
        new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            videoEl.removeEventListener('seeked', finish);
            resolve();
          };
          videoEl.addEventListener('seeked', finish, { once: true });
          window.setTimeout(finish, 180);
          try {
            videoEl.currentTime = targetVideoTime;
          } catch {
            finish();
          }
        }),
      );
    }
  }

  if (waits.length > 0) {
    await Promise.all(waits);
  }
}

export function renderComposition(
  ctx: CanvasRenderingContext2D,
  opts: RenderOptions,
): BoundingBox | null {
  const {
    width,
    height,
    time,
    tracks,
    clips,
    selectedClipId,
    showSafeZones,
    showSelectionBox,
    cache,
    canvasBg,
    isPlaying = false,
    isExporting = false,
    onAssetLoaded,
  } = opts;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = canvasBg?.mode === 'color' && canvasBg.color ? canvasBg.color : '#070709';
  ctx.fillRect(0, 0, width, height);

  const activeClips = getActiveClipsAtTime(tracks, clips, time);
  const activeFilterClip = activeClips.find((c) => c.kind === 'filter');
  const activeFilter = activeFilterClip
    ? {
        id: activeFilterClip.filterId ?? 'none',
        intensity: activeFilterClip.filterIntensity ?? 80,
      }
    : undefined;

  // Optional blurred canvas backdrop behind scaled/vertical media
  if (canvasBg?.mode === 'blur') {
    const bgVisual = activeClips.find((c) => c.kind === 'image' || c.kind === 'video');
    if (bgVisual) {
      ctx.save();
      ctx.filter = 'blur(28px) brightness(55%)';
      ctx.translate(width / 2, height / 2);
      const srcT = remapSpeedCurveTime(bgVisual, time - bgVisual.startTime);
      if (bgVisual.proceduralKind) {
        drawProceduralFrame(ctx, bgVisual.proceduralKind, width * 1.15, height * 1.15, srcT);
      } else if (bgVisual.kind === 'video' && bgVisual.src) {
        const vel = getOrLoadVideo(cache, bgVisual.src);
        if (vel && vel.readyState >= 2) {
          const { drawW, drawH } = fitMedia(width * 1.15, height * 1.15, (vel.videoWidth || 16) / (vel.videoHeight || 9));
          ctx.drawImage(vel, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      } else if (bgVisual.src) {
        const img = getOrLoadImage(cache, bgVisual.src, onAssetLoaded);
        if (img) {
          const { drawW, drawH } = fitMedia(width * 1.15, height * 1.15, img.naturalWidth / img.naturalHeight);
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }
      }
      ctx.restore();
    }
  }

  let selectedBox: BoundingBox | null = null;

  for (const clip of activeClips) {
    if (clip.kind === 'audio' || clip.kind === 'filter') continue;

    if (clip.kind === 'effect' && clip.effectId) {
      drawEffectOverlay(
        ctx,
        clip.effectId,
        clip.effectIntensity ?? 75,
        width,
        height,
        time,
      );
      continue;
    }

    const anim = computeAnimationState(clip, time);
    const kf = evaluateKeyframesAtTime(clip, time);
    const baseOpacity = (kf.opacity / 100) * anim.opacityMul;
    if (baseOpacity <= 0.01) continue;

    const effScaleX = clip.transform.uniformScale
      ? kf.scale
      : clip.transform.scaleX * (kf.scale / Math.max(0.01, clip.transform.scale));
    const effScaleY = clip.transform.uniformScale
      ? kf.scale
      : clip.transform.scaleY * (kf.scale / Math.max(0.01, clip.transform.scale));

    const scaleX = effScaleX * anim.scaleMul * (clip.transform.flipH ? -1 : 1);
    const scaleY = effScaleY * anim.scaleMul * (clip.transform.flipV ? -1 : 1);

    const cx = width / 2 + kf.x + anim.offsetX;
    const cy = height / 2 + kf.y + anim.offsetY;
    const rotRad = ((kf.rotation + anim.rotOffset) * Math.PI) / 180;

    // Transition check for outgoing main clip
    let transitionProgress = 0;
    const activeTransitionType = clip.transitionOut?.type ?? 'none';
    if (clip.transitionOut && activeTransitionType !== 'none') {
      const transStart = clip.startTime + clip.duration - clip.transitionOut.duration;
      if (time >= transStart && time <= clip.startTime + clip.duration) {
        transitionProgress = Math.max(
          0,
          Math.min(1, (time - transStart) / clip.transitionOut.duration),
        );
      }
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, baseOpacity));
    ctx.globalCompositeOperation = clip.transform.blendMode === 'normal'
      ? 'source-over'
      : clip.transform.blendMode;

    if (clip.kind === 'image' || clip.kind === 'video') {
      ctx.filter = buildFilterString(clip.adjustments, activeFilter);
      ctx.translate(cx, cy);
      ctx.rotate(rotRad);
      ctx.scale(scaleX, scaleY);
      applyCropRect(ctx, clip.crop, width, height);
      applyMask(ctx, clip.transform.mask, width, height);

      if (transitionProgress > 0) {
        if (activeTransitionType === 'dissolve') {
          ctx.globalAlpha *= 1 - transitionProgress * 0.65;
        } else if (activeTransitionType === 'slideLeft') {
          ctx.translate(-transitionProgress * width * 0.45, 0);
        } else if (activeTransitionType === 'slideRight') {
          ctx.translate(transitionProgress * width * 0.45, 0);
        } else if (activeTransitionType === 'zoomIn') {
          const z = 1 + transitionProgress * 0.35;
          ctx.scale(z, z);
          ctx.globalAlpha *= 1 - transitionProgress * 0.6;
        }
      }

      const sourceTime = remapSpeedCurveTime(clip, time - clip.startTime);

      if (clip.proceduralKind) {
        if (clip.chromaKey?.enabled) {
          drawWithChromaKey(
            ctx,
            cache,
            width,
            height,
            clip.chromaKey,
            (offCtx, ow, oh) => {
              offCtx.translate(ow / 2, oh / 2);
              drawProceduralFrame(offCtx, clip.proceduralKind!, ow, oh, sourceTime);
            },
          );
        } else {
          drawProceduralFrame(ctx, clip.proceduralKind, width, height, sourceTime);
        }
      } else if (clip.kind === 'video' && clip.src) {
        const videoEl = getOrLoadVideo(cache, clip.src);
        if (videoEl && videoEl.readyState >= 2) {
          const dur = Number.isFinite(videoEl.duration) && videoEl.duration > 0
            ? videoEl.duration
            : clip.sourceDuration;
          const targetVideoTime = Math.max(0, Math.min(dur, sourceTime));
          if (!isExporting) {
            const threshold = isPlaying ? 0.35 : 0.04;
            if (Math.abs(videoEl.currentTime - targetVideoTime) > threshold) {
              videoEl.currentTime = targetVideoTime;
            }
            if (isPlaying && !clip.reversed && (clip.speedCurve ?? 'none') === 'none') {
              videoEl.playbackRate = Math.max(0.25, Math.min(4, clip.speed));
              if (videoEl.paused) {
                videoEl.play().catch(() => {});
              }
            } else if (!videoEl.paused) {
              videoEl.pause();
            }
          }
          const aspect = (videoEl.videoWidth || 16) / (videoEl.videoHeight || 9);
          const { drawW, drawH } = fitMedia(width, height, aspect);
          if (clip.chromaKey?.enabled) {
            drawWithChromaKey(
              ctx,
              cache,
              width,
              height,
              clip.chromaKey,
              (offCtx, ow, oh) => {
                const s = ow / width;
                offCtx.drawImage(
                  videoEl,
                  ow / 2 - (drawW * s) / 2,
                  oh / 2 - (drawH * s) / 2,
                  drawW * s,
                  drawH * s,
                );
              },
            );
          } else {
            ctx.drawImage(videoEl, -drawW / 2, -drawH / 2, drawW, drawH);
          }
        } else {
          drawProceduralFrame(ctx, 'abstract', width, height, sourceTime);
        }
      } else if (clip.src) {
        const img = getOrLoadImage(cache, clip.src, onAssetLoaded);
        if (img) {
          const aspect = img.naturalWidth / img.naturalHeight;
          const { drawW, drawH } = fitMedia(width, height, aspect);
          if (clip.chromaKey?.enabled) {
            drawWithChromaKey(
              ctx,
              cache,
              width,
              height,
              clip.chromaKey,
              (offCtx, ow, oh) => {
                const s = ow / width;
                offCtx.drawImage(
                  img,
                  ow / 2 - (drawW * s) / 2,
                  oh / 2 - (drawH * s) / 2,
                  drawW * s,
                  drawH * s,
                );
              },
            );
          } else {
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          }
        } else {
          drawProceduralFrame(ctx, 'spring', width, height, sourceTime);
        }
      }

      ctx.filter = 'none';

      // Vignette & Fade overlays
      if (clip.adjustments.vignette > 0) {
        const v = clip.adjustments.vignette / 100;
        const rad = ctx.createRadialGradient(0, 0, width * 0.18, 0, 0, width * 0.65);
        rad.addColorStop(0, 'rgba(0,0,0,0)');
        rad.addColorStop(1, `rgba(0,0,0,${0.8 * v})`);
        ctx.fillStyle = rad;
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
      if (clip.adjustments.fade > 0) {
        ctx.fillStyle = `rgba(24, 24, 30, ${(clip.adjustments.fade / 100) * 0.65})`;
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }

      if (showSelectionBox && clip.id === selectedClipId) {
        selectedBox = {
          x: cx,
          y: cy,
          width: width * Math.abs(scaleX),
          height: height * Math.abs(scaleY),
          rotation: kf.rotation,
        };
      }
    } else if (clip.kind === 'text' && clip.text) {
      const tStyle = clip.text;
      const rawText = tStyle.uppercase ? tStyle.content.toUpperCase() : tStyle.content;
      const lines = (rawText || 'Texto').split('\n');
      const fontStyle = `${tStyle.italic ? 'italic ' : ''}${tStyle.fontWeight} ${tStyle.fontSize}px "${tStyle.fontFamily}", sans-serif`;
      ctx.font = fontStyle;
      ctx.textAlign = tStyle.align;
      ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
          `${tStyle.letterSpacing}px`;
      }

      let maxLineW = 0;
      for (const line of lines) {
        const m = ctx.measureText(line);
        maxLineW = Math.max(maxLineW, m.width);
      }
      const linePx = tStyle.fontSize * tStyle.lineHeight;
      const blockW = Math.max(120, maxLineW + 48);
      const blockH = Math.max(60, lines.length * linePx + 28);

      ctx.translate(cx, cy);
      ctx.rotate(rotRad);
      ctx.scale(scaleX, scaleY);

      if (tStyle.bgOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= tStyle.bgOpacity / 100;
        ctx.fillStyle = tStyle.bgColor;
        ctx.beginPath();
        ctx.roundRect(-blockW / 2, -blockH / 2, blockW, blockH, tStyle.bgRadius);
        ctx.fill();
        ctx.restore();
      }

      if (tStyle.shadowBlur > 0) {
        ctx.shadowColor = tStyle.shadowColor;
        ctx.shadowBlur = tStyle.shadowBlur;
        ctx.shadowOffsetY = 4;
      }

      lines.forEach((line, idx) => {
        const yPos = (idx - (lines.length - 1) / 2) * linePx;
        const xPos =
          tStyle.align === 'left'
            ? -blockW / 2 + 24
            : tStyle.align === 'right'
              ? blockW / 2 - 24
              : 0;

        if (tStyle.strokeWidth > 0) {
          ctx.strokeStyle = tStyle.strokeColor;
          ctx.lineWidth = tStyle.strokeWidth * 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(line, xPos, yPos);
        }
        ctx.fillStyle = tStyle.color;
        ctx.fillText(line, xPos, yPos);

        if (tStyle.underline) {
          const lineW = ctx.measureText(line).width;
          ctx.fillRect(-lineW / 2, yPos + tStyle.fontSize * 0.45, lineW, 4);
        }
      });

      if (showSelectionBox && clip.id === selectedClipId) {
        selectedBox = {
          x: cx,
          y: cy,
          width: blockW * Math.abs(scaleX),
          height: blockH * Math.abs(scaleY),
          rotation: kf.rotation,
        };
      }
    } else if (clip.kind === 'caption' && clip.text) {
      const capText = clip.text.content;
      ctx.font = `600 42px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const metrics = ctx.measureText(capText);
      const boxW = metrics.width + 44;
      const boxH = 68;
      const capY = height * 0.84 + kf.y;

      ctx.translate(width / 2 + kf.x, capY);
      ctx.fillStyle = 'rgba(10, 10, 14, 0.78)';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 12);
      ctx.fill();
      ctx.fillStyle = clip.text.color || '#ffffff';
      ctx.fillText(capText, 0, 0);

      if (showSelectionBox && clip.id === selectedClipId) {
        selectedBox = {
          x: width / 2 + kf.x,
          y: capY,
          width: boxW,
          height: boxH,
          rotation: 0,
        };
      }
    } else if (clip.kind === 'sticker' && clip.stickerEmoji) {
      const size = 140;
      ctx.translate(cx, cy);
      ctx.rotate(rotRad);
      ctx.scale(scaleX, scaleY);
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clip.stickerEmoji, 0, 0);

      if (showSelectionBox && clip.id === selectedClipId) {
        selectedBox = {
          x: cx,
          y: cy,
          width: size * 1.15 * Math.abs(scaleX),
          height: size * 1.15 * Math.abs(scaleY),
          rotation: kf.rotation,
        };
      }
    }

    ctx.restore();

    // Flash / Wipe / Glitch transition overlays
    if (transitionProgress > 0 && clip.transitionOut) {
      const tType = clip.transitionOut.type;
      if (tType === 'flash') {
        const flashAlpha = Math.sin(transitionProgress * Math.PI) * 0.88;
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      } else if (tType === 'wipeRight') {
        ctx.fillStyle = 'rgba(0, 213, 220, 0.25)';
        ctx.fillRect(transitionProgress * width - 4, 0, 8, height);
      } else if (tType === 'glitch') {
        ctx.fillStyle = `rgba(0, 213, 220, ${0.28 * (1 - Math.abs(transitionProgress - 0.5) * 2)})`;
        ctx.fillRect(0, height * 0.3, width, 24);
        ctx.fillStyle = `rgba(244, 63, 94, ${0.28 * (1 - Math.abs(transitionProgress - 0.5) * 2)})`;
        ctx.fillRect(0, height * 0.62, width, 18);
      }
    }
  }

  // Safe zone rule-of-thirds overlay
  if (showSafeZones) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width * 2) / 3, 0);
    ctx.lineTo((width * 2) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height * 2) / 3);
    ctx.lineTo(width, (height * 2) / 3);
    ctx.stroke();
    ctx.strokeRect(width * 0.08, height * 0.08, width * 0.84, height * 0.84);
    ctx.restore();
  }

  // Interactive bounding box on selected element
  if (showSelectionBox && selectedBox) {
    ctx.save();
    ctx.translate(selectedBox.x, selectedBox.y);
    ctx.rotate((selectedBox.rotation * Math.PI) / 180);
    const hw = selectedBox.width / 2;
    const hh = selectedBox.height / 2;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-hw, -hh, selectedBox.width, selectedBox.height);

    // 4 white corner handles
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [-hw, hh],
      [hw, hh],
    ];
    for (const [hx, hy] of corners) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Bottom rotation handle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hh);
    ctx.lineTo(0, hh + 34);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, hh + 38, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  return selectedBox;
}

function fitMedia(
  canvasW: number,
  canvasH: number,
  mediaAspect: number,
): { drawW: number; drawH: number } {
  const canvasAspect = canvasW / canvasH;
  if (mediaAspect > canvasAspect) {
    const drawH = canvasH;
    const drawW = canvasH * mediaAspect;
    return { drawW, drawH };
  }
  const drawW = canvasW;
  const drawH = canvasW / mediaAspect;
  return { drawW, drawH };
}

function applyCropRect(
  ctx: CanvasRenderingContext2D,
  crop: CropRect | undefined,
  w: number,
  h: number,
): void {
  if (!crop) return;
  if (crop.top <= 0 && crop.right <= 0 && crop.bottom <= 0 && crop.left <= 0) return;
  const x0 = -w / 2 + (w * crop.left) / 100;
  const y0 = -h / 2 + (h * crop.top) / 100;
  const cw = Math.max(8, w - (w * (crop.left + crop.right)) / 100);
  const ch = Math.max(8, h - (h * (crop.top + crop.bottom)) / 100);
  ctx.beginPath();
  ctx.rect(x0, y0, cw, ch);
  ctx.clip();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [0, 255, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function drawWithChromaKey(
  ctx: CanvasRenderingContext2D,
  cache: MediaCache,
  width: number,
  height: number,
  chroma: ChromaKeyProps,
  drawSource: (offCtx: CanvasRenderingContext2D, ow: number, oh: number) => void,
): void {
  const maxW = 480;
  const scale = Math.min(1, maxW / Math.max(1, width));
  const ow = Math.max(16, Math.round(width * scale));
  const oh = Math.max(16, Math.round(height * scale));

  if (!cache.chromaCanvas) {
    cache.chromaCanvas = document.createElement('canvas');
  }
  const off = cache.chromaCanvas;
  if (off.width !== ow || off.height !== oh) {
    off.width = ow;
    off.height = oh;
  }
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  if (!offCtx) return;

  offCtx.clearRect(0, 0, ow, oh);
  offCtx.save();
  drawSource(offCtx, ow, oh);
  offCtx.restore();

  try {
    const imgData = offCtx.getImageData(0, 0, ow, oh);
    const data = imgData.data;
    const [kr, kg, kb] = hexToRgb(chroma.color);
    const threshold = 24 + (chroma.strength / 100) * 190;
    const featherSpan = 8 + (chroma.feather / 100) * 90;

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - kr;
      const dg = data[i + 1] - kg;
      const db = data[i + 2] - kb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < threshold) {
        data[i + 3] = 0;
      } else if (dist < threshold + featherSpan) {
        const alphaRatio = (dist - threshold) / featherSpan;
        data[i + 3] = Math.round(data[i + 3] * alphaRatio);
      }
    }
    offCtx.putImageData(imgData, 0, 0);
  } catch {
    // Fallback if canvas is tainted
  }

  ctx.drawImage(off, -width / 2, -height / 2, width, height);
}
