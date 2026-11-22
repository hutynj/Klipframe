import React, { useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  RotateCcw,
  Underline,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SPEED_CURVE_PRESETS,
  TEXT_PRESETS,
  VOICE_EFFECT_PRESETS,
} from '../data/presets';
import type {
  AnimationPreset,
  BlendMode,
  MaskType,
  ProjectConfig,
  SpeedCurvePreset,
  TextStyleProps,
  TimelineClip,
  VoiceEffectId,
} from '../types/editor';
import { audioEngine } from '../utils/audioEngine';
import type { Translations } from '../utils/i18n';
import { hasKeyframeNear, SPEED_CURVE_POINTS } from '../utils/nleFeatures';
import { formatTimecode } from '../utils/timecode';
import { createDefaultAdjustments, createDefaultTransform } from '../utils/timelineOps';

interface InspectorPanelProps {
  project: ProjectConfig;
  selectedClip: TimelineClip | null;
  currentTime: number;
  totalDuration: number;
  tracksCount: number;
  clipsCount: number;
  t: Translations;
  onOpenProjectSettings: () => void;
  onUpdateClip: (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => void;
  onToggleKeyframe: (clipId: string) => void;
  onSaveTextPreset: (style: TextStyleProps) => void;
  onAddTtsAudioClip: (text: string) => void;
  onGenerateBeatMarkers: (clip: TimelineClip) => void;
}

const FONT_OPTIONS = [
  'Plus Jakarta Sans',
  'DM Sans',
  'Oswald',
  'Playfair Display',
  'JetBrains Mono',
];

const COLOR_SWATCHES = [
  '#ffffff',
  '#00d5dc',
  '#facc15',
  '#fb7185',
  '#38bdf8',
  '#a855f7',
  '#22c55e',
  '#18181b',
];

const ANIMATION_OPTIONS: Array<{ id: AnimationPreset; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'fadeIn', label: 'Fade' },
  { id: 'zoomIn', label: 'Zoom' },
  { id: 'slideUp', label: 'Slide Up' },
  { id: 'slideLeft', label: 'Slide Left' },
  { id: 'pop', label: 'Bounce Pop' },
  { id: 'spin', label: 'Spin' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedClip,
  currentTime,
  totalDuration,
  tracksCount,
  clipsCount,
  t,
  onOpenProjectSettings,
  onUpdateClip,
  onToggleKeyframe,
  onSaveTextPreset,
  onAddTtsAudioClip,
  onGenerateBeatMarkers,
}) => {
  const [videoTab, setVideoTab] = useState<'video' | 'audio' | 'speed' | 'animation' | 'adjustment'>('video');
  const [videoSubTab, setVideoSubTab] = useState<'basic' | 'cutout' | 'crop' | 'mask' | 'enhance'>('basic');
  const [speedSubMode, setSpeedSubMode] = useState<'normal' | 'curve'>('normal');
  const [textTab, setTextTab] = useState<'text' | 'tts' | 'animation'>('text');
  const [textSubTab, setTextSubTab] = useState<'basic' | 'templates' | 'effects'>('basic');
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(1);
  const [presetSavedFlash, setPresetSavedFlash] = useState(false);

  const relTime = selectedClip ? Math.max(0, currentTime - selectedClip.startTime) : 0;
  const isAtKeyframe = selectedClip
    ? hasKeyframeNear(selectedClip.keyframes, relTime)
    : false;

  // Empty selection -> Project Details panel matching Screenshot 2
  if (!selectedClip) {
    return (
      <aside
        aria-label={t.details}
        className="flex flex-col bg-[#161619] border-l border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
      >
        <div className="h-9 shrink-0 px-3.5 border-b border-[#26262c] flex items-center">
          <span className="text-xs font-semibold text-zinc-200">{t.details}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
          <DetailRow label={t.detailsFields.name} value={project.name} />
          <DetailRow label={t.detailsFields.aspectRatio} value={project.aspectRatio} />
          <DetailRow label={t.detailsFields.resolution} value={project.resolution.toUpperCase()} />
          <DetailRow label={t.detailsFields.frameRate} value={`${project.fps}.00fps`} mono />
          <DetailRow
            label={t.detailsFields.duration}
            value={formatTimecode(totalDuration, project.fps)}
            mono
          />
          <DetailRow label={t.detailsFields.tracks} value={String(tracksCount)} mono />
          <DetailRow label={t.detailsFields.clipsCount} value={String(clipsCount)} mono />
          <DetailRow
            label={t.detailsFields.arrangeLayers}
            value={t.detailsFields.turnedOn}
          />
        </div>

        <div className="p-3 border-t border-[#26262c] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onOpenProjectSettings}
            className="px-4 py-1.5 rounded bg-[#27272e] hover:bg-[#32323b] text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
          >
            {t.modify}
          </button>
        </div>
      </aside>
    );
  }

  // TEXT & CAPTION INSPECTOR (matching Screenshot 1!)
  if ((selectedClip.kind === 'text' || selectedClip.kind === 'caption') && selectedClip.text) {
    const txt = selectedClip.text;
    const updateText = (patch: Partial<TextStyleProps>) => {
      onUpdateClip(selectedClip.id, (c) => ({
        ...c,
        name: patch.content !== undefined ? patch.content.slice(0, 24) || 'Text' : c.name,
        text: c.text ? { ...c.text, ...patch } : undefined,
      }));
    };

    const updateTransform = (patch: Partial<TimelineClip['transform']>) => {
      onUpdateClip(selectedClip.id, (c) => ({
        ...c,
        transform: { ...c.transform, ...patch },
      }));
    };

    return (
      <aside
        aria-label="Text Inspector"
        className="flex flex-col bg-[#161619] border-l border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
      >
        {/* Top tabs: Text | Text to speech | Animation */}
        <div className="flex items-center gap-4 px-3.5 pt-2 border-b border-[#26262c] shrink-0">
          {(
            [
              ['text', t.inspector.text],
              ['tts', t.inspector.tts],
              ['animation', t.inspector.animation],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTextTab(id)}
              className={`pb-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                textTab === id
                  ? 'border-[#00d5dc] text-[#00d5dc]'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {textTab === 'text' && (
          <>
            {/* Sub-tabs: Basic | Templates | Effects */}
            <div className="px-3 pt-2.5 pb-1 shrink-0">
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded bg-[#111114] border border-[#25252c]">
                {(
                  [
                    ['basic', t.inspector.basic],
                    ['templates', t.inspector.templates],
                    ['effects', t.inspector.effects],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTextSubTab(id)}
                    className={`py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      textSubTab === id
                        ? 'bg-[#282830] text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {textSubTab === 'basic' && (
                <>
                  {/* Text paragraph box */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="inspector-text-content"
                      className="text-[11px] font-medium text-zinc-400 block"
                    >
                      The 1 paragraph
                    </label>
                    <textarea
                      id="inspector-text-content"
                      rows={2}
                      value={txt.content}
                      onChange={(e) => updateText({ content: e.target.value })}
                      className="w-full rounded bg-[#101013] border border-[#2a2a32] focus:border-[#00d5dc] px-2.5 py-2 text-xs text-white outline-none resize-none"
                    />
                  </div>

                  {/* Font & Size */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        {t.inspector.font}
                      </label>
                      <select
                        aria-label={t.inspector.font}
                        value={txt.fontFamily}
                        onChange={(e) => updateText({ fontFamily: e.target.value })}
                        className="w-full bg-[#222228] border border-[#2f2f38] rounded px-2 py-1.5 text-xs text-zinc-100 outline-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">
                        {t.inspector.size}
                      </label>
                      <input
                        type="number"
                        min={16}
                        max={200}
                        aria-label={t.inspector.size}
                        value={txt.fontSize}
                        onChange={(e) =>
                          updateText({
                            fontSize: Math.max(12, Math.min(220, Number(e.target.value) || 48)),
                          })
                        }
                        className="w-full bg-[#222228] border border-[#2f2f38] rounded px-2 py-1.5 text-xs font-timecode text-zinc-100 outline-none"
                      />
                    </div>
                  </div>

                  {/* Style buttons & Color */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Bold"
                        onClick={() =>
                          updateText({ fontWeight: txt.fontWeight >= 700 ? 400 : 700 })
                        }
                        className={`p-1.5 rounded border cursor-pointer ${
                          txt.fontWeight >= 700
                            ? 'bg-[#2a2a33] border-[#00d5dc] text-[#00d5dc]'
                            : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                        }`}
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Italic"
                        onClick={() => updateText({ italic: !txt.italic })}
                        className={`p-1.5 rounded border cursor-pointer ${
                          txt.italic
                            ? 'bg-[#2a2a33] border-[#00d5dc] text-[#00d5dc]'
                            : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                        }`}
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Underline"
                        onClick={() => updateText({ underline: !txt.underline })}
                        className={`p-1.5 rounded border cursor-pointer ${
                          txt.underline
                            ? 'bg-[#2a2a33] border-[#00d5dc] text-[#00d5dc]'
                            : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                        }`}
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {COLOR_SWATCHES.slice(0, 5).map((sw) => (
                        <button
                          key={sw}
                          type="button"
                          aria-label={`Text color ${sw}`}
                          onClick={() => updateText({ color: sw })}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            txt.color.toLowerCase() === sw
                              ? 'border-[#00d5dc] scale-110'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: sw }}
                        />
                      ))}
                      <input
                        type="color"
                        aria-label="Custom text color"
                        value={txt.color}
                        onChange={(e) => updateText({ color: e.target.value })}
                        className="w-5 h-5 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Stroke & Background */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#24242b]">
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                        <span>{t.inspector.stroke}</span>
                        <span className="font-timecode">{txt.strokeWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={txt.strokeWidth}
                        onChange={(e) => updateText({ strokeWidth: Number(e.target.value) })}
                        className="cc-slider w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                        <span>{t.inspector.background}</span>
                        <span className="font-timecode">{txt.bgOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={txt.bgOpacity}
                        onChange={(e) => updateText({ bgOpacity: Number(e.target.value) })}
                        className="cc-slider w-full"
                      />
                    </div>
                  </div>

                  {/* Transform Section matching Screenshot 1 */}
                  <div className="pt-2 border-t border-[#24242b] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">
                        {t.inspector.transform}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleKeyframe(selectedClip.id)}
                          aria-label={isAtKeyframe ? t.inspector.removeKeyframe : t.inspector.addKeyframe}
                          title={isAtKeyframe ? t.inspector.removeKeyframe : t.inspector.addKeyframe}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isAtKeyframe
                              ? 'text-[#00d5dc] bg-[#00d5dc]/15'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Diamond className={`w-3.5 h-3.5 ${isAtKeyframe ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTransform(createDefaultTransform())}
                          aria-label="Reset transform"
                          className="text-zinc-400 hover:text-white cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Scale slider + percentage */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">{t.inspector.scale}</span>
                        <span className="font-timecode text-zinc-200 bg-[#222228] px-2 py-0.5 rounded">
                          {Math.round(selectedClip.transform.scale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        aria-label={t.inspector.scale}
                        min={20}
                        max={350}
                        value={Math.round(selectedClip.transform.scale * 100)}
                        onChange={(e) => {
                          const s = Number(e.target.value) / 100;
                          updateTransform({ scale: s, scaleX: s, scaleY: s });
                        }}
                        className="cc-slider w-full"
                      />
                    </div>

                    {/* Uniform Scale toggle */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">{t.inspector.uniformScale}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={selectedClip.transform.uniformScale}
                        onClick={() =>
                          updateTransform({
                            uniformScale: !selectedClip.transform.uniformScale,
                          })
                        }
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                          selectedClip.transform.uniformScale ? 'bg-[#00d5dc]' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                            selectedClip.transform.uniformScale ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Position X / Y */}
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label="X"
                        value={selectedClip.transform.x}
                        onChange={(v) => updateTransform({ x: v })}
                      />
                      <NumberField
                        label="Y"
                        value={selectedClip.transform.y}
                        onChange={(v) => updateTransform({ y: v })}
                      />
                    </div>

                    {/* Rotation */}
                    <NumberField
                      label={t.inspector.rotation}
                      value={selectedClip.transform.rotation}
                      suffix="°"
                      onChange={(v) => updateTransform({ rotation: v })}
                    />

                    {/* Alignment Row */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-400">{t.inspector.align}</span>
                      <div className="flex items-center gap-1">
                        {(
                          [
                            ['left', AlignLeft],
                            ['center', AlignCenter],
                            ['right', AlignRight],
                          ] as const
                        ).map(([al, Icon]) => (
                          <button
                            key={al}
                            type="button"
                            aria-label={`Align ${al}`}
                            onClick={() => updateText({ align: al })}
                            className={`p-1.5 rounded cursor-pointer ${
                              txt.align === al
                                ? 'bg-[#2a2a33] text-[#00d5dc]'
                                : 'bg-[#202026] text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {textSubTab === 'templates' && (
                <div className="grid grid-cols-2 gap-2">
                  {TEXT_PRESETS.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => updateText(tpl.style)}
                      className="rounded bg-[#202026] border border-[#2c2c34] hover:border-[#00d5dc] p-2.5 text-center cursor-pointer"
                    >
                      <span
                        style={{
                          fontFamily: tpl.style.fontFamily,
                          color: tpl.style.color,
                          fontWeight: tpl.style.fontWeight,
                        }}
                        className="text-xs block truncate"
                      >
                        {tpl.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {textSubTab === 'effects' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>{t.inspector.shadow}</span>
                      <span className="font-timecode">{txt.shadowBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={txt.shadowBlur}
                      onChange={(e) => updateText({ shadowBlur: Number(e.target.value) })}
                      className="cc-slider w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Letter spacing</span>
                      <span className="font-timecode">{txt.letterSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      value={txt.letterSpacing}
                      onChange={(e) => updateText({ letterSpacing: Number(e.target.value) })}
                      className="cc-slider w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-2.5 border-t border-[#26262c] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSaveTextPreset(txt);
                  setPresetSavedFlash(true);
                  window.setTimeout(() => setPresetSavedFlash(false), 1400);
                }}
                className="px-3.5 py-1.5 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#091214] text-xs font-semibold transition-colors cursor-pointer"
              >
                {presetSavedFlash ? 'Saved!' : t.saveAsPreset}
              </button>
            </div>
          </>
        )}

        {textTab === 'tts' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            <div className="text-xs text-zinc-300 bg-[#1e1e24] border border-[#2a2a33] rounded p-2.5">
              "{txt.content || 'KlipFrame Studio'}"
            </div>
            <SliderField
              label="Rate"
              value={Math.round(ttsRate * 100)}
              min={60}
              max={160}
              suffix="%"
              onChange={(v) => setTtsRate(v / 100)}
            />
            <SliderField
              label="Pitch"
              value={Math.round(ttsPitch * 100)}
              min={60}
              max={150}
              suffix="%"
              onChange={(v) => setTtsPitch(v / 100)}
            />
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => audioEngine.speakText(txt.content, ttsRate, ttsPitch)}
                className="w-full py-2 px-3 rounded bg-[#25252d] hover:bg-[#30303a] text-xs font-medium text-white cursor-pointer"
              >
                {t.inspector.speakPreview}
              </button>
              <button
                type="button"
                onClick={() => onAddTtsAudioClip(txt.content)}
                className="w-full py-2 px-3 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-xs font-semibold text-[#091214] cursor-pointer"
              >
                {t.inspector.addVoiceClip}
              </button>
            </div>
          </div>
        )}

        {textTab === 'animation' && (
          <AnimationInspector
            clip={selectedClip}
            t={t}
            onUpdate={(anim) => onUpdateClip(selectedClip.id, (c) => ({ ...c, animation: anim }))}
          />
        )}
      </aside>
    );
  }

  // AUDIO INSPECTOR
  if (selectedClip.kind === 'audio' && selectedClip.audio) {
    const aud = selectedClip.audio;
    const updateAudio = (patch: Partial<NonNullable<TimelineClip['audio']>>) => {
      onUpdateClip(selectedClip.id, (c) => ({
        ...c,
        audio: c.audio ? { ...c.audio, ...patch } : undefined,
      }));
    };
    return (
      <aside
        aria-label="Audio Inspector"
        className="flex flex-col bg-[#161619] border-l border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
      >
        <div className="h-9 shrink-0 px-3.5 border-b border-[#26262c] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#00d5dc]">{t.inspector.audio}</span>
          <button
            type="button"
            onClick={() => updateAudio({ muted: !aud.muted })}
            className="text-zinc-300 hover:text-white cursor-pointer"
            aria-label={t.inspector.muteClip}
          >
            {aud.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          <SliderField
            label={t.inspector.volume}
            value={aud.volume}
            min={0}
            max={200}
            suffix="%"
            onChange={(v) => updateAudio({ volume: v })}
          />
          <SliderField
            label={t.inspector.fadeIn}
            value={Math.round(aud.fadeIn * 10)}
            min={0}
            max={50}
            displayValue={`${aud.fadeIn.toFixed(1)}s`}
            onChange={(v) => updateAudio({ fadeIn: v / 10 })}
          />
          <SliderField
            label={t.inspector.fadeOut}
            value={Math.round(aud.fadeOut * 10)}
            min={0}
            max={50}
            displayValue={`${aud.fadeOut.toFixed(1)}s`}
            onChange={(v) => updateAudio({ fadeOut: v / 10 })}
          />
          <SliderField
            label={t.inspector.playbackSpeed}
            value={Math.round(selectedClip.speed * 100)}
            min={50}
            max={200}
            displayValue={`${selectedClip.speed.toFixed(2)}x`}
            onChange={(v) => onUpdateClip(selectedClip.id, (c) => ({ ...c, speed: v / 100 }))}
          />

          <div className="pt-2 border-t border-[#24242b] space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300">{t.inspector.noiseReduction}</span>
              <ToggleSwitch
                checked={Boolean(aud.noiseReduction)}
                label={t.inspector.noiseReduction}
                onChange={() => updateAudio({ noiseReduction: !aud.noiseReduction })}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300">{t.inspector.normalizeAudio}</span>
              <ToggleSwitch
                checked={Boolean(aud.normalize)}
                label={t.inspector.normalizeAudio}
                onChange={() => updateAudio({ normalize: !aud.normalize })}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#24242b] space-y-2">
            <span className="text-xs font-semibold text-zinc-200 block">
              {t.inspector.voiceEffects}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {VOICE_EFFECT_PRESETS.map((vf) => {
                const active = (aud.voiceEffect ?? 'normal') === vf.id;
                return (
                  <button
                    key={vf.id}
                    type="button"
                    onClick={() => {
                      updateAudio({ voiceEffect: vf.id as VoiceEffectId });
                      audioEngine.previewVoiceEffect(vf.id, 1.0);
                    }}
                    className={`py-1.5 px-2 rounded border text-[11px] font-medium text-left flex items-center gap-1.5 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                        : 'bg-[#1f1f25] border-[#2b2b33] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: vf.accent }}
                    />
                    <span className="truncate">{vf.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-[#24242b]">
            <button
              type="button"
              data-testid="inspector-beat-markers-btn"
              onClick={() => onGenerateBeatMarkers(selectedClip)}
              className="w-full py-2 px-3 rounded bg-[#222229] hover:bg-[#2c2c36] border border-[#32323d] text-[11px] font-medium text-[#00d5dc] cursor-pointer transition-colors"
            >
              {t.inspector.beatMarkers}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // EFFECT or FILTER INSPECTOR
  if (selectedClip.kind === 'effect' || selectedClip.kind === 'filter') {
    const isEffect = selectedClip.kind === 'effect';
    const val = isEffect
      ? (selectedClip.effectIntensity ?? 75)
      : (selectedClip.filterIntensity ?? 80);

    return (
      <aside
        aria-label="Effect or Filter Inspector"
        className="flex flex-col bg-[#161619] border-l border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
      >
        <div className="h-9 shrink-0 px-3.5 border-b border-[#26262c] flex items-center">
          <span className="text-xs font-semibold text-[#00d5dc] truncate">
            {selectedClip.name}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          <SliderField
            label={t.inspector.intensity}
            value={val}
            min={0}
            max={100}
            suffix="%"
            onChange={(next) =>
              onUpdateClip(selectedClip.id, (c) =>
                isEffect
                  ? { ...c, effectIntensity: next }
                  : { ...c, filterIntensity: next },
              )
            }
          />
          <SliderField
            label={t.inspector.durationSec}
            value={Math.round(selectedClip.duration * 10)}
            min={5}
            max={200}
            displayValue={`${selectedClip.duration.toFixed(1)}s`}
            onChange={(v) =>
              onUpdateClip(selectedClip.id, (c) => ({ ...c, duration: v / 10 }))
            }
          />
        </div>
      </aside>
    );
  }

  // VIDEO / IMAGE / STICKER INSPECTOR
  const updateTransform = (patch: Partial<TimelineClip['transform']>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      transform: { ...c.transform, ...patch },
    }));
  };

  const updateAdj = (patch: Partial<TimelineClip['adjustments']>) => {
    onUpdateClip(selectedClip.id, (c) => ({
      ...c,
      adjustments: { ...c.adjustments, ...patch },
    }));
  };

  return (
    <aside
      aria-label="Video and Transform Inspector"
      className="flex flex-col bg-[#161619] border-l border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
    >
      {/* Top tabs */}
      <div className="flex items-center gap-3 px-3 pt-2 border-b border-[#26262c] overflow-x-auto shrink-0">
        {(
          [
            ['video', t.inspector.video],
            ['audio', t.inspector.audio],
            ['speed', t.inspector.speed],
            ['animation', t.inspector.animation],
            ['adjustment', t.inspector.adjustment],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVideoTab(id)}
            className={`pb-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              videoTab === id
                ? 'border-[#00d5dc] text-[#00d5dc]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {videoTab === 'video' && (
        <>
          <div className="px-2.5 pt-2.5 pb-1 shrink-0">
            <div className="grid grid-cols-5 gap-0.5 p-0.5 rounded bg-[#111114] border border-[#25252c]">
              {(
                [
                  ['basic', t.inspector.basic],
                  ['cutout', t.inspector.cutout],
                  ['crop', t.inspector.crop],
                  ['mask', t.inspector.mask],
                  ['enhance', t.inspector.enhance],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVideoSubTab(id)}
                  className={`py-1 px-0.5 rounded text-[10px] font-medium truncate transition-colors cursor-pointer ${
                    videoSubTab === id
                      ? 'bg-[#282830] text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {videoSubTab === 'basic' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">
                    {t.inspector.transform}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="inspector-keyframe-btn"
                      onClick={() => onToggleKeyframe(selectedClip.id)}
                      aria-label={isAtKeyframe ? t.inspector.removeKeyframe : t.inspector.addKeyframe}
                      title={isAtKeyframe ? t.inspector.removeKeyframe : t.inspector.addKeyframe}
                      className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer ${
                        isAtKeyframe
                          ? 'text-[#00d5dc] bg-[#00d5dc]/15 border border-[#00d5dc]/40'
                          : 'text-zinc-400 hover:text-white bg-[#202026]'
                      }`}
                    >
                      <Diamond className={`w-3 h-3 ${isAtKeyframe ? 'fill-current' : ''}`} />
                      <span>{selectedClip.keyframes?.length ?? 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTransform(createDefaultTransform())}
                      aria-label="Reset transform"
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <SliderField
                  label={t.inspector.scale}
                  value={Math.round(selectedClip.transform.scale * 100)}
                  min={20}
                  max={300}
                  suffix="%"
                  onChange={(v) => {
                    const s = v / 100;
                    updateTransform({ scale: s, scaleX: s, scaleY: s });
                  }}
                />

                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="X"
                    value={selectedClip.transform.x}
                    onChange={(v) => updateTransform({ x: v })}
                  />
                  <NumberField
                    label="Y"
                    value={selectedClip.transform.y}
                    onChange={(v) => updateTransform({ y: v })}
                  />
                </div>

                <NumberField
                  label={t.inspector.rotation}
                  value={selectedClip.transform.rotation}
                  suffix="°"
                  onChange={(v) => updateTransform({ rotation: v })}
                />

                <SliderField
                  label={t.inspector.opacity}
                  value={selectedClip.transform.opacity}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateTransform({ opacity: v })}
                />

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#24242b]">
                  <span className="text-[11px] text-zinc-400">{t.inspector.blendMode}</span>
                  <select
                    aria-label={t.inspector.blendMode}
                    value={selectedClip.transform.blendMode}
                    onChange={(e) =>
                      updateTransform({ blendMode: e.target.value as BlendMode })
                    }
                    className="bg-[#222228] border border-[#2f2f38] rounded px-2 py-1 text-xs text-zinc-100 outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="screen">Screen</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                    <option value="lighten">Lighten</option>
                    <option value="darken">Darken</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">{t.inspector.flip}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Flip Horizontal"
                      onClick={() => updateTransform({ flipH: !selectedClip.transform.flipH })}
                      className={`p-1.5 rounded border cursor-pointer ${
                        selectedClip.transform.flipH
                          ? 'bg-[#2a2a33] border-[#00d5dc] text-[#00d5dc]'
                          : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                      }`}
                    >
                      <FlipHorizontal2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Flip Vertical"
                      onClick={() => updateTransform({ flipV: !selectedClip.transform.flipV })}
                      className={`p-1.5 rounded border cursor-pointer ${
                        selectedClip.transform.flipV
                          ? 'bg-[#2a2a33] border-[#00d5dc] text-[#00d5dc]'
                          : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                      }`}
                    >
                      <FlipVertical2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateTransform({
                        rotation: (selectedClip.transform.rotation + 90) % 360,
                      })
                    }
                    className="py-1.5 rounded bg-[#202026] hover:bg-[#2a2a33] border border-[#2c2c34] text-[11px] text-zinc-200 cursor-pointer"
                  >
                    {t.inspector.rotate90}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTransform({ scale: 1, scaleX: 1, scaleY: 1, x: 0, y: 0 })
                    }
                    className="py-1.5 rounded bg-[#202026] hover:bg-[#2a2a33] border border-[#2c2c34] text-[11px] text-zinc-200 cursor-pointer"
                  >
                    {t.inspector.fitCanvas}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateTransform({ scale: 1.35, scaleX: 1.35, scaleY: 1.35, x: 0, y: 0 })
                    }
                    className="py-1.5 rounded bg-[#202026] hover:bg-[#2a2a33] border border-[#2c2c34] text-[11px] text-zinc-200 cursor-pointer"
                  >
                    {t.inspector.fillCanvas}
                  </button>
                </div>
              </>
            )}

            {videoSubTab === 'cutout' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">
                    {t.inspector.chromaKey}
                  </span>
                  <ToggleSwitch
                    checked={Boolean(selectedClip.chromaKey?.enabled)}
                    label={t.inspector.chromaKey}
                    onChange={() =>
                      onUpdateClip(selectedClip.id, (c) => ({
                        ...c,
                        chromaKey: {
                          enabled: !(c.chromaKey?.enabled ?? false),
                          color: c.chromaKey?.color ?? '#00ff00',
                          strength: c.chromaKey?.strength ?? 38,
                          feather: c.chromaKey?.feather ?? 20,
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400">{t.inspector.chromaColor}</span>
                  <div className="flex items-center gap-1.5">
                    {['#00ff00', '#0000ff', '#00d5dc', '#18181b'].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        aria-label={`Chroma color ${sw}`}
                        onClick={() =>
                          onUpdateClip(selectedClip.id, (c) => ({
                            ...c,
                            chromaKey: {
                              enabled: true,
                              color: sw,
                              strength: c.chromaKey?.strength ?? 38,
                              feather: c.chromaKey?.feather ?? 20,
                            },
                          }))
                        }
                        className={`w-5 h-5 rounded-full border cursor-pointer ${
                          (selectedClip.chromaKey?.color ?? '#00ff00').toLowerCase() === sw
                            ? 'border-[#00d5dc] scale-110'
                            : 'border-white/25'
                        }`}
                        style={{ backgroundColor: sw }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom chroma color"
                      value={selectedClip.chromaKey?.color ?? '#00ff00'}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, (c) => ({
                          ...c,
                          chromaKey: {
                            enabled: true,
                            color: e.target.value,
                            strength: c.chromaKey?.strength ?? 38,
                            feather: c.chromaKey?.feather ?? 20,
                          },
                        }))
                      }
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                </div>

                <SliderField
                  label={t.inspector.chromaStrength}
                  value={selectedClip.chromaKey?.strength ?? 38}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (c) => ({
                      ...c,
                      chromaKey: {
                        enabled: c.chromaKey?.enabled ?? true,
                        color: c.chromaKey?.color ?? '#00ff00',
                        strength: v,
                        feather: c.chromaKey?.feather ?? 20,
                      },
                    }))
                  }
                />

                <SliderField
                  label={t.inspector.chromaFeather}
                  value={selectedClip.chromaKey?.feather ?? 20}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) =>
                    onUpdateClip(selectedClip.id, (c) => ({
                      ...c,
                      chromaKey: {
                        enabled: c.chromaKey?.enabled ?? true,
                        color: c.chromaKey?.color ?? '#00ff00',
                        strength: c.chromaKey?.strength ?? 38,
                        feather: v,
                      },
                    }))
                  }
                />
              </div>
            )}

            {videoSubTab === 'crop' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">
                    {t.inspector.cropFrame}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (c) => ({
                        ...c,
                        crop: { top: 0, right: 0, bottom: 0, left: 0 },
                      }))
                    }
                    className="text-[11px] text-[#00d5dc] hover:underline cursor-pointer"
                  >
                    {t.inspector.reset}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Free', crop: { top: 0, right: 0, bottom: 0, left: 0 } },
                    { label: '1:1', crop: { top: 0, right: 22, bottom: 0, left: 22 } },
                    { label: '9:16', crop: { top: 0, right: 34, bottom: 0, left: 34 } },
                    { label: '21:9', crop: { top: 14, right: 0, bottom: 14, left: 0 } },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        onUpdateClip(selectedClip.id, (c) => ({ ...c, crop: p.crop }))
                      }
                      className="py-1.5 rounded bg-[#202026] hover:bg-[#2a2a33] border border-[#2c2c34] text-[11px] text-zinc-200 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
                  const val = selectedClip.crop?.[side] ?? 0;
                  const label =
                    side === 'top'
                      ? t.inspector.cropTop
                      : side === 'bottom'
                        ? t.inspector.cropBottom
                        : side === 'left'
                          ? t.inspector.cropLeft
                          : t.inspector.cropRight;
                  return (
                    <SliderField
                      key={side}
                      label={label}
                      value={val}
                      min={0}
                      max={42}
                      suffix="%"
                      onChange={(next) =>
                        onUpdateClip(selectedClip.id, (c) => ({
                          ...c,
                          crop: {
                            top: c.crop?.top ?? 0,
                            right: c.crop?.right ?? 0,
                            bottom: c.crop?.bottom ?? 0,
                            left: c.crop?.left ?? 0,
                            [side]: next,
                          },
                        }))
                      }
                    />
                  );
                })}
              </div>
            )}

            {videoSubTab === 'mask' && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['none', 'None'],
                    ['circle', 'Circle'],
                    ['rectangle', 'Rounded'],
                    ['split', 'Split Half'],
                    ['filmstrip', 'Cinema 2.39'],
                  ] as Array<[MaskType, string]>
                ).map(([mId, mLabel]) => (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => updateTransform({ mask: mId })}
                    className={`py-2.5 px-2 rounded border text-xs font-medium cursor-pointer transition-colors ${
                      selectedClip.transform.mask === mId
                        ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                        : 'bg-[#1f1f25] border-[#2b2b33] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {mLabel}
                  </button>
                ))}
              </div>
            )}

            {videoSubTab === 'enhance' && (
              <div className="space-y-4">
                <SliderField
                  label={t.inspector.vignette}
                  value={selectedClip.adjustments.vignette}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAdj({ vignette: v })}
                />
                <SliderField
                  label={t.inspector.fade}
                  value={selectedClip.adjustments.fade}
                  min={0}
                  max={50}
                  suffix="%"
                  onChange={(v) => updateAdj({ fade: v })}
                />
              </div>
            )}
          </div>
        </>
      )}

      {videoTab === 'audio' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          <SliderField
            label={t.inspector.volume}
            value={selectedClip.audio?.volume ?? 100}
            min={0}
            max={200}
            suffix="%"
            onChange={(v) =>
              onUpdateClip(selectedClip.id, (c) => ({
                ...c,
                audio: {
                  volume: v,
                  muted: c.audio?.muted ?? false,
                  fadeIn: c.audio?.fadeIn ?? 0,
                  fadeOut: c.audio?.fadeOut ?? 0,
                  waveform: c.audio?.waveform ?? [],
                  voiceEffect: c.audio?.voiceEffect ?? 'normal',
                  noiseReduction: c.audio?.noiseReduction ?? false,
                },
              }))
            }
          />
          <div className="pt-2 border-t border-[#24242b] space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300">{t.inspector.noiseReduction}</span>
              <ToggleSwitch
                checked={Boolean(selectedClip.audio?.noiseReduction)}
                label={t.inspector.noiseReduction}
                onChange={() =>
                  onUpdateClip(selectedClip.id, (c) => ({
                    ...c,
                    audio: {
                      volume: c.audio?.volume ?? 100,
                      muted: c.audio?.muted ?? false,
                      fadeIn: c.audio?.fadeIn ?? 0,
                      fadeOut: c.audio?.fadeOut ?? 0,
                      waveform: c.audio?.waveform ?? [],
                      noiseReduction: !c.audio?.noiseReduction,
                    },
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {videoTab === 'speed' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded bg-[#111114] border border-[#25252c]">
            <button
              type="button"
              onClick={() => setSpeedSubMode('normal')}
              className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                speedSubMode === 'normal'
                  ? 'bg-[#282830] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.inspector.speedNormal}
            </button>
            <button
              type="button"
              onClick={() => setSpeedSubMode('curve')}
              className={`py-1 rounded text-[11px] font-medium cursor-pointer ${
                speedSubMode === 'curve'
                  ? 'bg-[#282830] text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t.inspector.speedCurve}
            </button>
          </div>

          {speedSubMode === 'normal' ? (
            <>
              <SliderField
                label={t.inspector.playbackSpeed}
                value={Math.round(selectedClip.speed * 100)}
                min={25}
                max={400}
                displayValue={`${selectedClip.speed.toFixed(2)}x`}
                onChange={(v) =>
                  onUpdateClip(selectedClip.id, (c) => ({ ...c, speed: v / 100 }))
                }
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 1, 1.5, 2].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (c) => ({ ...c, speed: sp }))
                    }
                    className={`py-1.5 rounded text-xs font-timecode border cursor-pointer ${
                      Math.abs(selectedClip.speed - sp) < 0.05
                        ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                        : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-[#24242b] flex items-center justify-between text-[11px]">
                <span className="text-zinc-300">{t.inspector.reverseClip}</span>
                <ToggleSwitch
                  checked={Boolean(selectedClip.reversed)}
                  label={t.inspector.reverseClip}
                  onChange={() =>
                    onUpdateClip(selectedClip.id, (c) => ({
                      ...c,
                      reversed: !c.reversed,
                    }))
                  }
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {SPEED_CURVE_PRESETS.map((sc) => {
                const active = (selectedClip.speedCurve ?? 'none') === sc.id;
                const pts = SPEED_CURVE_POINTS[sc.id];
                const pathD = pts
                  .map(([tx, vy], i) => {
                    const sx = 6 + tx * 88;
                    const sy = 34 - Math.min(3.2, Math.max(0.2, vy)) * 9;
                    return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() =>
                      onUpdateClip(selectedClip.id, (c) => ({
                        ...c,
                        speedCurve: sc.id as SpeedCurvePreset,
                      }))
                    }
                    className={`rounded-md border p-2 flex flex-col gap-1.5 text-left cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#24242e] border-[#00d5dc] text-[#00d5dc]'
                        : 'bg-[#1d1d23] border-[#2a2a33] text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <svg viewBox="0 0 100 38" className="w-full h-8 bg-[#121216] rounded">
                      <line x1="0" y1="25" x2="100" y2="25" stroke="#26262e" strokeDasharray="3 3" />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={active ? '#00d5dc' : '#a1a1aa'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[11px] font-medium truncate">{sc.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {videoTab === 'animation' && (
        <AnimationInspector
          clip={selectedClip}
          t={t}
          onUpdate={(anim) => onUpdateClip(selectedClip.id, (c) => ({ ...c, animation: anim }))}
        />
      )}

      {videoTab === 'adjustment' && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              {t.inspector.adjustment}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="inspector-auto-color-btn"
                onClick={() =>
                  updateAdj({
                    brightness: 4,
                    contrast: 12,
                    saturation: 14,
                    exposure: 5,
                    sharpen: 16,
                  })
                }
                className="px-2 py-0.5 rounded bg-[#00d5dc]/15 border border-[#00d5dc]/40 text-[10px] font-medium text-[#00d5dc] hover:bg-[#00d5dc]/25 cursor-pointer"
              >
                {t.inspector.autoColor}
              </button>
              <button
                type="button"
                onClick={() => updateAdj(createDefaultAdjustments())}
                className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
              >
                {t.inspector.reset}
              </button>
            </div>
          </div>
          <SliderField
            label={t.inspector.brightness}
            value={selectedClip.adjustments.brightness}
            min={-50}
            max={50}
            onChange={(v) => updateAdj({ brightness: v })}
          />
          <SliderField
            label={t.inspector.contrast}
            value={selectedClip.adjustments.contrast}
            min={-50}
            max={50}
            onChange={(v) => updateAdj({ contrast: v })}
          />
          <SliderField
            label={t.inspector.saturation}
            value={selectedClip.adjustments.saturation}
            min={-50}
            max={50}
            onChange={(v) => updateAdj({ saturation: v })}
          />
          <SliderField
            label={t.inspector.sharpen}
            value={selectedClip.adjustments.sharpen}
            min={0}
            max={50}
            onChange={(v) => updateAdj({ sharpen: v })}
          />
          <SliderField
            label={t.inspector.temperature}
            value={selectedClip.adjustments.temperature}
            min={-50}
            max={50}
            onChange={(v) => updateAdj({ temperature: v })}
          />
          <SliderField
            label={t.inspector.exposure}
            value={selectedClip.adjustments.exposure}
            min={-50}
            max={50}
            onChange={(v) => updateAdj({ exposure: v })}
          />
          <SliderField
            label={t.inspector.hue}
            value={selectedClip.adjustments.hue}
            min={-180}
            max={180}
            suffix="°"
            onChange={(v) => updateAdj({ hue: v })}
          />
        </div>
      )}
    </aside>
  );
};

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="flex items-center justify-between gap-3 py-1 border-b border-[#202026]">
    <span className="text-zinc-400">{label}:</span>
    <span className={`text-zinc-200 truncate ${mono ? 'font-timecode' : ''}`}>
      {value}
    </span>
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}> = ({ label, value, suffix, onChange }) => (
  <div className="flex items-center justify-between gap-2 bg-[#121216] border border-[#2a2a32] rounded px-2 py-1">
    <span className="text-[11px] text-zinc-400">{label}</span>
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        aria-label={label}
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-12 bg-transparent text-right text-xs font-timecode text-zinc-100 outline-none"
      />
      {suffix && <span className="text-[11px] text-zinc-500">{suffix}</span>}
    </div>
  </div>
);

const SliderField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  displayValue?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, suffix = '', displayValue, onChange }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-zinc-400">{label}</span>
      <span className="font-timecode text-zinc-200">
        {displayValue ?? `${value}${suffix}`}
      </span>
    </div>
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="cc-slider w-full"
    />
  </div>
);

const AnimationInspector: React.FC<{
  clip: TimelineClip;
  t: Translations;
  onUpdate: (anim: TimelineClip['animation']) => void;
}> = ({ clip, t, onUpdate }) => (
  <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-zinc-300">
        {t.inspector.inAnimation}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ANIMATION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onUpdate({ ...clip.animation, inPreset: opt.id })}
            className={`py-1.5 px-2 rounded text-[11px] border cursor-pointer ${
              clip.animation.inPreset === opt.id
                ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <SliderField
        label={t.inspector.durationSec}
        value={Math.round(clip.animation.inDuration * 10)}
        min={1}
        max={30}
        displayValue={`${clip.animation.inDuration.toFixed(1)}s`}
        onChange={(v) => onUpdate({ ...clip.animation, inDuration: v / 10 })}
      />
    </div>

    <div className="space-y-2 pt-3 border-t border-[#24242b]">
      <div className="text-[11px] font-semibold text-zinc-300">
        {t.inspector.outAnimation}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ANIMATION_OPTIONS.slice(0, 5).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onUpdate({ ...clip.animation, outPreset: opt.id })}
            className={`py-1.5 px-2 rounded text-[11px] border cursor-pointer ${
              clip.animation.outPreset === opt.id
                ? 'bg-[#26262f] border-[#00d5dc] text-[#00d5dc]'
                : 'bg-[#202026] border-[#2c2c34] text-zinc-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const ToggleSwitch: React.FC<{
  checked: boolean;
  label: string;
  onChange: () => void;
}> = ({ checked, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
      checked ? 'bg-[#00d5dc]' : 'bg-zinc-700'
    }`}
  >
    <span
      className={`block w-3 h-3 rounded-full bg-white transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);
