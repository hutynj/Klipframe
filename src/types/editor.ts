export type LanguageCode = 'es' | 'en';

export type ResourceTabId =
  | 'import'
  | 'audio'
  | 'text'
  | 'stickers'
  | 'effects'
  | 'transitions'
  | 'captions'
  | 'filters'
  | 'adjustment';

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export type TrackType = 'overlay' | 'video' | 'audio' | 'effect';

export type ClipKind =
  | 'video'
  | 'image'
  | 'text'
  | 'audio'
  | 'sticker'
  | 'effect'
  | 'filter'
  | 'caption';

export type BlendMode =
  | 'normal'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'darken'
  | 'lighten';

export type MaskType = 'none' | 'circle' | 'rectangle' | 'split' | 'filmstrip';

export type AnimationPreset =
  | 'none'
  | 'fadeIn'
  | 'zoomIn'
  | 'slideUp'
  | 'slideLeft'
  | 'pop'
  | 'spin'
  | 'typewriter';

export type TransitionType =
  | 'none'
  | 'dissolve'
  | 'slideLeft'
  | 'slideRight'
  | 'zoomIn'
  | 'wipeRight'
  | 'flash'
  | 'glitch';

export type EffectPresetId =
  | 'rgbSplit'
  | 'filmGrain'
  | 'vhsScanlines'
  | 'sparkle'
  | 'vignettePulse'
  | 'blurGlow'
  | 'retroTV'
  | 'edgeNeon'
  | 'mirrorSplit'
  | 'shakePulse'
  | 'flashStrobe'
  | 'snowFall';

export type FilterPresetId =
  | 'none'
  | 'clear'
  | 'springMist'
  | 'tealOrange'
  | 'vintageFilm'
  | 'noirBW'
  | 'cyberDusk'
  | 'warmSunset'
  | 'nordicCool'
  | 'emeraldForest'
  | 'roseQuartz'
  | 'highContrast'
  | 'sepiaClassic';

export type SpeedCurvePreset =
  | 'none'
  | 'montage'
  | 'hero'
  | 'bullet'
  | 'jumpCut'
  | 'flashIn'
  | 'flashOut';

export type VoiceEffectId =
  | 'normal'
  | 'deep'
  | 'chipmunk'
  | 'robot'
  | 'echo'
  | 'megaphone';

export interface KeyframeEntry {
  timeOffset: number; // seconds relative to clip.startTime
  scale?: number;
  x?: number;
  y?: number;
  rotation?: number;
  opacity?: number;
}

export interface ChromaKeyProps {
  enabled: boolean;
  color: string; // hex e.g. '#00ff00'
  strength: number; // 0..100
  feather: number; // 0..100
}

export interface CropRect {
  top: number; // 0..45 %
  right: number; // 0..45 %
  bottom: number; // 0..45 %
  left: number; // 0..45 %
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface TransformProps {
  scale: number; // 1 = 100%, 2.14 = 214%
  uniformScale: boolean;
  scaleX: number;
  scaleY: number;
  x: number; // pixel offset relative to canvas center
  y: number;
  rotation: number; // degrees
  opacity: number; // 0..100
  flipH: boolean;
  flipV: boolean;
  blendMode: BlendMode;
  mask: MaskType;
}

export interface ColorAdjustments {
  brightness: number; // -50..50
  contrast: number; // -50..50
  saturation: number; // -50..50
  temperature: number; // -50..50
  exposure: number; // -50..50
  hue: number; // -180..180
  sharpen: number; // 0..50
  vignette: number; // 0..100
  fade: number; // 0..50
}

export interface TextStyleProps {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 600 | 700 | 800;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  bgOpacity: number;
  bgRadius: number;
  shadowBlur: number;
  shadowColor: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  templateId?: string;
}

export interface AudioProps {
  volume: number; // 0..200 (%)
  muted: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  synthPreset?: string;
  waveform: number[];
  voiceEffect?: VoiceEffectId;
  noiseReduction?: boolean;
  normalize?: boolean;
}

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // seconds
}

export interface AnimationProps {
  inPreset: AnimationPreset;
  inDuration: number;
  outPreset: AnimationPreset;
  outDuration: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'audio';
  src: string; // image/video URL or 'procedural:<id>' or 'synth:<id>'
  thumbnail: string;
  duration: number; // seconds
  width?: number;
  height?: number;
  category: 'device' | 'stock' | 'brand';
  proceduralKind?: 'spring' | 'sunset' | 'neon' | 'abstract';
  synthPreset?: string;
  waveform?: number[];
}

export interface TimelineClip {
  id: string;
  trackId: string;
  kind: ClipKind;
  name: string;
  assetId?: string;
  src?: string;
  thumbnail?: string;
  proceduralKind?: 'spring' | 'sunset' | 'neon' | 'abstract';
  startTime: number; // seconds on timeline
  duration: number; // visible duration on timeline
  trimStart: number; // offset inside source media
  sourceDuration: number;
  speed: number; // 0.25..4
  speedCurve?: SpeedCurvePreset;
  reversed?: boolean;
  audioDetached?: boolean;
  keyframes?: KeyframeEntry[];
  chromaKey?: ChromaKeyProps;
  crop?: CropRect;
  transform: TransformProps;
  adjustments: ColorAdjustments;
  text?: TextStyleProps;
  audio?: AudioProps;
  stickerEmoji?: string;
  stickerLabel?: string;
  effectId?: EffectPresetId;
  effectIntensity?: number; // 0..100
  filterId?: FilterPresetId;
  filterIntensity?: number; // 0..100
  animation: AnimationProps;
  transitionOut?: TransitionConfig;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  label: string;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  isMain?: boolean;
}

export interface CanvasBackgroundConfig {
  mode: 'black' | 'color' | 'blur';
  color: string;
}

export interface ProjectConfig {
  name: string;
  aspectRatio: AspectRatioPreset;
  resolution: '720p' | '1080p' | '4k';
  fps: 24 | 30 | 60;
  coverTime: number;
  previewQuality?: '540p' | '720p' | '1080p';
  canvasBg?: CanvasBackgroundConfig;
}

export interface TimelineState {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers?: TimelineMarker[];
}

export interface TextPresetItem {
  id: string;
  label: string;
  category: 'basic' | 'template' | 'effect';
  previewBg: string;
  style: Partial<TextStyleProps>;
}
