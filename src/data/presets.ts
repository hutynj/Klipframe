import type {
  ColorAdjustments,
  EffectPresetId,
  FilterPresetId,
  MediaAsset,
  ProjectConfig,
  SpeedCurvePreset,
  TextPresetItem,
  TimelineClip,
  TimelineTrack,
  TransitionType,
  VoiceEffectId,
} from '../types/editor';
import {
  createDefaultAdjustments,
  createDefaultAnimation,
  createDefaultTransform,
} from '../utils/timelineOps';

export const STOCK_IMAGES = {
  daffodils: '/src/assets/images/stock_spring_daffodils_1795259686549.jpg',
  coastal: '/src/assets/images/stock_coastal_sunset_1795259686832.jpg',
  tokyo: '/src/assets/images/stock_tokyo_rain_1795259687857.jpg',
  mountain: '/src/assets/images/stock_mountain_hike_1795259687441.jpg',
};

function makeWaveform(seed: number, count = 48): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const val =
      0.22 +
      0.45 * Math.abs(Math.sin(i * 0.42 + seed)) +
      0.3 * Math.abs(Math.cos(i * 1.13 + seed * 2));
    out.push(Number(Math.min(0.98, val).toFixed(2)));
  }
  return out;
}

export const INITIAL_STOCK_ASSETS: MediaAsset[] = [
  {
    id: 'asset-daffodils',
    name: 'Daffodil at spring morning.jpg',
    kind: 'image',
    src: STOCK_IMAGES.daffodils,
    thumbnail: STOCK_IMAGES.daffodils,
    duration: 8,
    width: 1920,
    height: 1080,
    category: 'stock',
  },
  {
    id: 'asset-coastal',
    name: 'Coastal Cliffs Sunset.jpg',
    kind: 'image',
    src: STOCK_IMAGES.coastal,
    thumbnail: STOCK_IMAGES.coastal,
    duration: 6,
    width: 1920,
    height: 1080,
    category: 'stock',
  },
  {
    id: 'asset-tokyo',
    name: 'City Rain Crosswalk.jpg',
    kind: 'image',
    src: STOCK_IMAGES.tokyo,
    thumbnail: STOCK_IMAGES.tokyo,
    duration: 6,
    width: 1920,
    height: 1080,
    category: 'stock',
  },
  {
    id: 'asset-mountain',
    name: 'Alpine Sunrise Trail.jpg',
    kind: 'image',
    src: STOCK_IMAGES.mountain,
    thumbnail: STOCK_IMAGES.mountain,
    duration: 6,
    width: 1080,
    height: 1920,
    category: 'stock',
  },
  {
    id: 'asset-proc-aurora',
    name: 'Aurora Borealis Motion.mp4',
    kind: 'video',
    src: 'procedural:spring',
    thumbnail: '',
    duration: 8,
    width: 1920,
    height: 1080,
    category: 'stock',
    proceduralKind: 'spring',
  },
  {
    id: 'asset-proc-sunset',
    name: 'Golden Horizon Loop.mp4',
    kind: 'video',
    src: 'procedural:sunset',
    thumbnail: '',
    duration: 8,
    width: 1920,
    height: 1080,
    category: 'stock',
    proceduralKind: 'sunset',
  },
  {
    id: 'asset-proc-neon',
    name: 'Prism Grid Motion.mp4',
    kind: 'video',
    src: 'procedural:neon',
    thumbnail: '',
    duration: 8,
    width: 1920,
    height: 1080,
    category: 'stock',
    proceduralKind: 'neon',
  },
  {
    id: 'asset-proc-abstract',
    name: 'Silk Waves Intro.mp4',
    kind: 'video',
    src: 'procedural:abstract',
    thumbnail: '',
    duration: 6,
    width: 1920,
    height: 1080,
    category: 'brand',
    proceduralKind: 'abstract',
  },
];

export interface AudioLibraryItem {
  id: string;
  name: string;
  artist: string;
  category: 'music' | 'sfx';
  duration: number;
  bpm?: number;
  synthPreset: string;
  waveform: number[];
}

export const AUDIO_LIBRARY: AudioLibraryItem[] = [
  {
    id: 'aud-spring-lofi',
    name: 'Morning Dew Lo-Fi',
    artist: 'Studio Beats',
    category: 'music',
    duration: 16,
    bpm: 84,
    synthPreset: 'lofi',
    waveform: makeWaveform(1.2),
  },
  {
    id: 'aud-cinematic-swell',
    name: 'Horizon Drift Ambient',
    artist: 'Aerial Score',
    category: 'music',
    duration: 14,
    bpm: 72,
    synthPreset: 'ambient',
    waveform: makeWaveform(2.7),
  },
  {
    id: 'aud-upbeat-vlog',
    name: 'Weekend Vlog Groove',
    artist: 'Metro Pulse',
    category: 'music',
    duration: 12,
    bpm: 112,
    synthPreset: 'vlog',
    waveform: makeWaveform(4.1),
  },
  {
    id: 'aud-synth-drive',
    name: 'Night Drive Synth',
    artist: 'Neon Avenue',
    category: 'music',
    duration: 14,
    bpm: 118,
    synthPreset: 'synth',
    waveform: makeWaveform(5.5),
  },
  {
    id: 'aud-acoustic-morning',
    name: 'Acoustic Breeze',
    artist: 'Woodland Strings',
    category: 'music',
    duration: 15,
    bpm: 92,
    synthPreset: 'acoustic',
    waveform: makeWaveform(6.2),
  },
  {
    id: 'aud-trap-pulse',
    name: 'Urban Beat 808',
    artist: 'Street Lab',
    category: 'music',
    duration: 12,
    bpm: 132,
    synthPreset: 'trap',
    waveform: makeWaveform(6.9),
  },
  {
    id: 'sfx-whoosh',
    name: 'Smooth Whoosh',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.5,
    synthPreset: 'whoosh',
    waveform: makeWaveform(7.3, 24),
  },
  {
    id: 'sfx-pop',
    name: 'Bubble Pop',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.0,
    synthPreset: 'pop',
    waveform: makeWaveform(8.9, 20),
  },
  {
    id: 'sfx-shutter',
    name: 'Camera Click',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.0,
    synthPreset: 'shutter',
    waveform: makeWaveform(9.4, 20),
  },
  {
    id: 'sfx-glitch',
    name: 'Digital Zap',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.2,
    synthPreset: 'glitch',
    waveform: makeWaveform(10.8, 24),
  },
  {
    id: 'sfx-chime',
    name: 'Sparkle Chime',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.4,
    synthPreset: 'chime',
    waveform: makeWaveform(11.4, 24),
  },
  {
    id: 'sfx-impact',
    name: 'Cinematic Bass Drop',
    artist: 'SFX',
    category: 'sfx',
    duration: 1.6,
    synthPreset: 'impact',
    waveform: makeWaveform(12.2, 24),
  },
];

export const TEXT_PRESETS: TextPresetItem[] = [
  {
    id: 'tpl-klipframe-clean',
    label: 'KlipFrame',
    category: 'basic',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'KlipFrame',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 82,
      fontWeight: 700,
      color: '#ffffff',
      strokeWidth: 0,
      bgOpacity: 0,
      shadowBlur: 18,
      shadowColor: 'rgba(0,0,0,0.65)',
    },
  },
  {
    id: 'tpl-mini-vlog',
    label: 'MINI VLOG',
    category: 'template',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'MINI VLOG',
      fontFamily: 'Oswald',
      fontSize: 64,
      fontWeight: 700,
      uppercase: true,
      letterSpacing: 6,
      color: '#ffffff',
      bgColor: '#111114',
      bgOpacity: 75,
      bgRadius: 8,
      strokeWidth: 0,
    },
  },
  {
    id: 'tpl-love-story',
    label: 'I love you.',
    category: 'template',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'I love you.',
      fontFamily: 'Playfair Display',
      fontSize: 68,
      fontWeight: 600,
      italic: true,
      color: '#fdf2f8',
      shadowBlur: 14,
      shadowColor: 'rgba(0,0,0,0.7)',
    },
  },
  {
    id: 'tpl-gold-title',
    label: 'CINEMATIC',
    category: 'template',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'CINEMATIC',
      fontFamily: 'Oswald',
      fontSize: 72,
      fontWeight: 700,
      uppercase: true,
      letterSpacing: 10,
      color: '#fbbf24',
      strokeColor: '#451a03',
      strokeWidth: 3,
      shadowBlur: 20,
      shadowColor: 'rgba(245,158,11,0.55)',
    },
  },
  {
    id: 'tpl-subscribe',
    label: 'SUBSCRIBE',
    category: 'effect',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'SUBSCRIBE',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 56,
      fontWeight: 800,
      uppercase: true,
      color: '#ffffff',
      bgColor: '#ef4444',
      bgOpacity: 95,
      bgRadius: 12,
      strokeWidth: 0,
      shadowBlur: 16,
      shadowColor: 'rgba(239,68,68,0.6)',
    },
  },
  {
    id: 'tpl-cyan-glow',
    label: 'CYAN NEON',
    category: 'effect',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'STUDIO PRO',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 68,
      fontWeight: 800,
      color: '#00d5dc',
      strokeColor: '#ffffff',
      strokeWidth: 2,
      shadowBlur: 24,
      shadowColor: 'rgba(0,213,220,0.85)',
    },
  },
  {
    id: 'tpl-mono-caption',
    label: 'TIME · 01',
    category: 'effect',
    previewBg: 'bg-zinc-900',
    style: {
      content: '01 · SPRING',
      fontFamily: 'JetBrains Mono',
      fontSize: 50,
      fontWeight: 600,
      color: '#e4e4e7',
      bgColor: '#000000',
      bgOpacity: 65,
      bgRadius: 6,
      letterSpacing: 3,
    },
  },
  {
    id: 'tpl-yellow-pop',
    label: 'HIGHLIGHT',
    category: 'effect',
    previewBg: 'bg-zinc-900',
    style: {
      content: 'HIGHLIGHT',
      fontFamily: 'Oswald',
      fontSize: 66,
      fontWeight: 700,
      color: '#18181b',
      bgColor: '#facc15',
      bgOpacity: 100,
      bgRadius: 6,
    },
  },
];

export interface StickerPreset {
  id: string;
  emoji: string;
  label: string;
  category: 'trending' | 'vlog' | 'icons' | 'shapes';
}

export const STICKER_PRESETS: StickerPreset[] = [
  { id: 'stk-spark', emoji: '✨', label: 'Sparkles', category: 'trending' },
  { id: 'stk-fire', emoji: '🔥', label: 'Fire', category: 'trending' },
  { id: 'stk-heart', emoji: '❤️', label: 'Heart', category: 'trending' },
  { id: 'stk-rec', emoji: '🔴', label: 'REC', category: 'vlog' },
  { id: 'stk-cam', emoji: '🎬', label: 'Clapper', category: 'vlog' },
  { id: 'stk-mic', emoji: '🎙️', label: 'Podcast', category: 'vlog' },
  { id: 'stk-star', emoji: '⭐', label: 'Star', category: 'icons' },
  { id: 'stk-bolt', emoji: '⚡', label: 'Bolt', category: 'icons' },
  { id: 'stk-music', emoji: '🎵', label: 'Note', category: 'icons' },
  { id: 'stk-arrow', emoji: '➡️', label: 'Arrow', category: 'shapes' },
  { id: 'stk-check', emoji: '✅', label: 'Check', category: 'shapes' },
  { id: 'stk-sun', emoji: '☀️', label: 'Sun', category: 'shapes' },
];

export interface EffectPreset {
  id: EffectPresetId;
  name: string;
  category: 'video' | 'retro' | 'light';
  accent: string;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'rgbSplit', name: 'RGB Chromatic', category: 'video', accent: '#00d5dc' },
  { id: 'filmGrain', name: '35mm Film Grain', category: 'retro', accent: '#f59e0b' },
  { id: 'vhsScanlines', name: 'VHS Scanlines', category: 'retro', accent: '#ec4899' },
  { id: 'sparkle', name: 'Dream Sparkles', category: 'light', accent: '#fde047' },
  { id: 'vignettePulse', name: 'Cinema Vignette', category: 'video', accent: '#6366f1' },
  { id: 'blurGlow', name: 'Soft Halation', category: 'light', accent: '#38bdf8' },
  { id: 'retroTV', name: 'CRT Retro', category: 'retro', accent: '#a855f7' },
  { id: 'edgeNeon', name: 'Edge Frame', category: 'video', accent: '#10b981' },
  { id: 'mirrorSplit', name: 'Mirror Frame', category: 'video', accent: '#14b8a6' },
  { id: 'shakePulse', name: 'Dynamic Shake', category: 'video', accent: '#f97316' },
  { id: 'flashStrobe', name: 'Beat Flash', category: 'light', accent: '#facc15' },
  { id: 'snowFall', name: 'Winter Snow', category: 'light', accent: '#e0f2fe' },
];

export interface TransitionPreset {
  id: TransitionType;
  name: string;
  category: 'basic' | 'camera' | 'light';
  defaultDuration: number;
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'dissolve', name: 'Cross Dissolve', category: 'basic', defaultDuration: 0.8 },
  { id: 'slideLeft', name: 'Slide Left', category: 'camera', defaultDuration: 0.6 },
  { id: 'slideRight', name: 'Slide Right', category: 'camera', defaultDuration: 0.6 },
  { id: 'zoomIn', name: 'Zoom Pull', category: 'camera', defaultDuration: 0.6 },
  { id: 'wipeRight', name: 'Linear Wipe', category: 'basic', defaultDuration: 0.7 },
  { id: 'flash', name: 'White Flash', category: 'light', defaultDuration: 0.5 },
  { id: 'glitch', name: 'Glitch Cut', category: 'light', defaultDuration: 0.5 },
];

export interface FilterPreset {
  id: FilterPresetId;
  name: string;
  category: 'life' | 'movies' | 'retro' | 'mono';
  swatch: string;
  adjustments: Partial<ColorAdjustments>;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'clear',
    name: 'Clear Boost',
    category: 'life',
    swatch: 'from-sky-400 to-emerald-400',
    adjustments: { contrast: 12, saturation: 14, brightness: 4 },
  },
  {
    id: 'springMist',
    name: 'Spring Mist',
    category: 'life',
    swatch: 'from-amber-200 to-lime-300',
    adjustments: { brightness: 8, temperature: 14, fade: 10, saturation: 10 },
  },
  {
    id: 'tealOrange',
    name: 'Teal & Orange',
    category: 'movies',
    swatch: 'from-teal-500 to-orange-500',
    adjustments: { contrast: 18, saturation: 16, temperature: 12, vignette: 24 },
  },
  {
    id: 'vintageFilm',
    name: 'Kodak 1984',
    category: 'retro',
    swatch: 'from-amber-600 to-stone-500',
    adjustments: { fade: 20, temperature: 18, contrast: -6, saturation: -10, vignette: 30 },
  },
  {
    id: 'noirBW',
    name: 'Noir B&W',
    category: 'mono',
    swatch: 'from-zinc-200 to-zinc-800',
    adjustments: { saturation: -50, contrast: 28, vignette: 32 },
  },
  {
    id: 'cyberDusk',
    name: 'Cyber Dusk',
    category: 'movies',
    swatch: 'from-cyan-500 to-fuchsia-600',
    adjustments: { contrast: 20, temperature: -22, saturation: 20, hue: -12 },
  },
  {
    id: 'warmSunset',
    name: 'Golden Hour',
    category: 'life',
    swatch: 'from-orange-400 to-rose-400',
    adjustments: { temperature: 28, brightness: 6, saturation: 12 },
  },
  {
    id: 'nordicCool',
    name: 'Nordic Slate',
    category: 'retro',
    swatch: 'from-slate-400 to-blue-700',
    adjustments: { temperature: -18, saturation: -14, contrast: 10, fade: 8 },
  },
  {
    id: 'emeraldForest',
    name: 'Forest Emerald',
    category: 'life',
    swatch: 'from-emerald-400 to-teal-800',
    adjustments: { saturation: 18, contrast: 12, hue: 12, temperature: -6 },
  },
  {
    id: 'roseQuartz',
    name: 'Rose Velvet',
    category: 'life',
    swatch: 'from-rose-300 to-pink-600',
    adjustments: { brightness: 6, temperature: 10, saturation: 12, hue: -14 },
  },
  {
    id: 'highContrast',
    name: 'Dramatic Punch',
    category: 'movies',
    swatch: 'from-zinc-400 to-black',
    adjustments: { contrast: 34, saturation: 10, vignette: 26 },
  },
  {
    id: 'sepiaClassic',
    name: 'Antique Sepia',
    category: 'mono',
    swatch: 'from-amber-300 to-amber-900',
    adjustments: { saturation: -38, temperature: 36, fade: 14, contrast: 8 },
  },
];

export const SAMPLE_CAPTIONS = [
  { start: 0.4, end: 2.8, text: 'Morning mist over the spring meadow' },
  { start: 3.1, end: 5.8, text: 'Golden sunlight hits the daffodils' },
  { start: 6.2, end: 9.0, text: 'Coastal cliffs meeting the ocean waves' },
  { start: 9.4, end: 12.2, text: 'Captured & edited in KlipFrame Studio' },
];

export interface SpeedCurvePresetItem {
  id: SpeedCurvePreset;
  name: string;
}

export const SPEED_CURVE_PRESETS: SpeedCurvePresetItem[] = [
  { id: 'none', name: 'Normal' },
  { id: 'montage', name: 'Montage' },
  { id: 'hero', name: 'Hero' },
  { id: 'bullet', name: 'Bullet' },
  { id: 'jumpCut', name: 'Jump Cut' },
  { id: 'flashIn', name: 'Flash In' },
  { id: 'flashOut', name: 'Flash Out' },
];

export interface VoiceEffectPresetItem {
  id: VoiceEffectId;
  name: string;
  pitchMul: number;
  accent: string;
}

export const VOICE_EFFECT_PRESETS: VoiceEffectPresetItem[] = [
  { id: 'normal', name: 'Original', pitchMul: 1, accent: '#71717a' },
  { id: 'deep', name: 'Deep', pitchMul: 0.72, accent: '#38bdf8' },
  { id: 'chipmunk', name: 'Chipmunk', pitchMul: 1.55, accent: '#f472b6' },
  { id: 'robot', name: 'Synth Robot', pitchMul: 0.92, accent: '#00d5dc' },
  { id: 'echo', name: 'Hall Echo', pitchMul: 1, accent: '#a855f7' },
  { id: 'megaphone', name: 'Megaphone', pitchMul: 1.15, accent: '#f59e0b' },
];

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: 'track-text', type: 'overlay', label: 'Text', locked: false, hidden: false, muted: false },
  { id: 'track-effect', type: 'effect', label: 'Effects', locked: false, hidden: false, muted: false },
  { id: 'track-pip', type: 'overlay', label: 'Overlay', locked: false, hidden: false, muted: false },
  { id: 'track-video-main', type: 'video', label: 'Video', locked: false, hidden: false, muted: false, isMain: true },
  { id: 'track-audio-main', type: 'audio', label: 'Audio', locked: false, hidden: false, muted: false },
];

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  name: 'Proyecto 1016',
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 30,
  coverTime: 1.5,
  previewQuality: '720p',
  canvasBg: {
    mode: 'black',
    color: '#070709',
  },
};

export function createInitialDemoClips(): TimelineClip[] {
  const springTransform = createDefaultTransform();
  const textTransform = {
    ...createDefaultTransform(),
    scale: 1.25,
    scaleX: 1.25,
    scaleY: 1.25,
  };

  return [
    {
      id: 'clip-demo-video-1',
      trackId: 'track-video-main',
      kind: 'image',
      name: 'Daffodil at the spring morning with fog',
      assetId: 'asset-daffodils',
      src: STOCK_IMAGES.daffodils,
      thumbnail: STOCK_IMAGES.daffodils,
      startTime: 0,
      duration: 8,
      trimStart: 0,
      sourceDuration: 20,
      speed: 1,
      transform: springTransform,
      adjustments: createDefaultAdjustments(),
      animation: createDefaultAnimation(),
      transitionOut: { type: 'dissolve', duration: 0.8 },
    },
    {
      id: 'clip-demo-video-2',
      trackId: 'track-video-main',
      kind: 'image',
      name: 'Coastal Cliffs Sunset',
      assetId: 'asset-coastal',
      src: STOCK_IMAGES.coastal,
      thumbnail: STOCK_IMAGES.coastal,
      startTime: 8,
      duration: 6,
      trimStart: 0,
      sourceDuration: 20,
      speed: 1,
      transform: createDefaultTransform(),
      adjustments: createDefaultAdjustments(),
      animation: createDefaultAnimation(),
    },
    {
      id: 'clip-demo-text-1',
      trackId: 'track-text',
      kind: 'text',
      name: 'KlipFrame',
      startTime: 1.2,
      duration: 5.2,
      trimStart: 0,
      sourceDuration: 60,
      speed: 1,
      transform: textTransform,
      adjustments: createDefaultAdjustments(),
      animation: {
        inPreset: 'fadeIn',
        inDuration: 0.4,
        outPreset: 'fadeIn',
        outDuration: 0.4,
      },
      text: {
        content: 'KlipFrame',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 84,
        fontWeight: 700,
        italic: false,
        underline: false,
        uppercase: false,
        color: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 0,
        bgColor: '#000000',
        bgOpacity: 0,
        bgRadius: 8,
        shadowBlur: 18,
        shadowColor: 'rgba(0,0,0,0.65)',
        align: 'center',
        letterSpacing: 1,
        lineHeight: 1.2,
        templateId: 'tpl-klipframe-clean',
      },
    },
    {
      id: 'clip-demo-audio-1',
      trackId: 'track-audio-main',
      kind: 'audio',
      name: 'Morning Dew Lo-Fi',
      startTime: 0,
      duration: 14,
      trimStart: 0,
      sourceDuration: 16,
      speed: 1,
      transform: createDefaultTransform(),
      adjustments: createDefaultAdjustments(),
      animation: createDefaultAnimation(),
      audio: {
        volume: 80,
        muted: false,
        fadeIn: 0.6,
        fadeOut: 1.0,
        synthPreset: 'lofi',
        waveform: makeWaveform(1.2),
      },
    },
  ];
}
