import type { AspectRatioPreset } from '../types/editor';

export function formatTimecode(seconds: number, fps = 30): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalFrames = Math.round(safe * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hrs = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatRulerTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function timeToPx(seconds: number, pxPerSecond: number): number {
  return Math.max(0, seconds * pxPerSecond);
}

export function pxToTime(px: number, pxPerSecond: number): number {
  if (pxPerSecond <= 0) return 0;
  return Math.max(0, px / pxPerSecond);
}

export function getCanvasDimensions(
  aspectRatio: AspectRatioPreset,
  resolution: '720p' | '1080p' | '4k' = '1080p',
): { width: number; height: number } {
  const baseShort =
    resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : 720;

  switch (aspectRatio) {
    case '16:9':
      return { width: Math.round((baseShort * 16) / 9), height: baseShort };
    case '9:16':
      return { width: baseShort, height: Math.round((baseShort * 16) / 9) };
    case '1:1':
      return { width: baseShort, height: baseShort };
    case '4:3':
      return { width: Math.round((baseShort * 4) / 3), height: baseShort };
    case '21:9':
      return { width: Math.round((baseShort * 21) / 9), height: baseShort };
    default:
      return { width: 1920, height: 1080 };
  }
}

export function getRulerStepSeconds(pxPerSecond: number): {
  majorStep: number;
  minorStep: number;
} {
  if (pxPerSecond >= 80) return { majorStep: 1, minorStep: 0.2 };
  if (pxPerSecond >= 40) return { majorStep: 2, minorStep: 0.5 };
  if (pxPerSecond >= 20) return { majorStep: 5, minorStep: 1 };
  if (pxPerSecond >= 10) return { majorStep: 10, minorStep: 2 };
  return { majorStep: 15, minorStep: 5 };
}
