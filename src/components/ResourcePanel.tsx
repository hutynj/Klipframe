import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Captions,
  ChevronsRight,
  Film,
  FolderOpen,
  Music,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sticker,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  AUDIO_LIBRARY,
  EFFECT_PRESETS,
  FILTER_PRESETS,
  SAMPLE_CAPTIONS,
  STICKER_PRESETS,
  TEXT_PRESETS,
  TRANSITION_PRESETS,
  type AudioLibraryItem,
} from '../data/presets';
import type {
  EffectPresetId,
  FilterPresetId,
  MediaAsset,
  ResourceTabId,
  TextPresetItem,
  TransitionType,
} from '../types/editor';
import { audioEngine } from '../utils/audioEngine';
import type { Translations } from '../utils/i18n';

interface ResourcePanelProps {
  activeTab: ResourceTabId;
  onChangeTab: (tab: ResourceTabId) => void;
  mediaAssets: MediaAsset[];
  savedTextPresets: TextPresetItem[];
  t: Translations;
  onImportFiles: (files: FileList) => void;
  onAddMediaToTimeline: (asset: MediaAsset) => void;
  onAddOverlayToTimeline: (asset: MediaAsset) => void;
  onAddAudioToTimeline: (item: AudioLibraryItem) => void;
  onAddTextToTimeline: (preset?: TextPresetItem) => void;
  onAddStickerToTimeline: (emoji: string, label: string) => void;
  onAddEffectToTimeline: (effectId: EffectPresetId, name: string) => void;
  onApplyTransition: (type: TransitionType, duration: number) => void;
  onAddFilterToTimeline: (filterId: FilterPresetId, name: string) => void;
  onGenerateAutoCaptions: () => void;
  onAddManualCaption: (text: string) => void;
  onImportSrt: (srtText: string) => void;
  onExportSrt: () => void;
  onApplyAdjustmentPreset: (presetName: string) => void;
}

const TAB_ITEMS: Array<{
  id: ResourceTabId;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'import', icon: FolderOpen },
  { id: 'audio', icon: Music },
  { id: 'text', icon: Type },
  { id: 'stickers', icon: Sticker },
  { id: 'effects', icon: Sparkles },
  { id: 'transitions', icon: ArrowLeftRight },
  { id: 'captions', icon: Captions },
  { id: 'filters', icon: Wand2 },
  { id: 'adjustment', icon: SlidersHorizontal },
];

export const ResourcePanel: React.FC<ResourcePanelProps> = ({
  activeTab,
  onChangeTab,
  mediaAssets,
  savedTextPresets,
  t,
  onImportFiles,
  onAddMediaToTimeline,
  onAddOverlayToTimeline,
  onAddAudioToTimeline,
  onAddTextToTimeline,
  onAddStickerToTimeline,
  onAddEffectToTimeline,
  onApplyTransition,
  onAddFilterToTimeline,
  onGenerateAutoCaptions,
  onAddManualCaption,
  onImportSrt,
  onExportSrt,
  onApplyAdjustmentPreset,
}) => {
  const [subCategory, setSubCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCaptionText, setManualCaptionText] = useState('');
  const [previewingAudioId, setPreviewingAudioId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);

  const subNavOptions = useMemo(() => {
    switch (activeTab) {
      case 'import':
        return [
          { id: 'all', label: 'Import' },
          { id: 'stock', label: 'Stock' },
          { id: 'device', label: 'Device' },
          { id: 'brand', label: 'Brand' },
        ];
      case 'audio':
        return [
          { id: 'all', label: 'All' },
          { id: 'music', label: 'Music' },
          { id: 'sfx', label: 'SFX' },
        ];
      case 'text':
        return [
          { id: 'all', label: 'All' },
          { id: 'basic', label: 'Add text' },
          { id: 'template', label: 'Templates' },
          { id: 'effect', label: 'Effects' },
        ];
      case 'stickers':
        return [
          { id: 'all', label: 'All' },
          { id: 'trending', label: 'Trending' },
          { id: 'vlog', label: 'Vlog' },
          { id: 'icons', label: 'Icons' },
        ];
      case 'effects':
        return [
          { id: 'all', label: 'Video' },
          { id: 'retro', label: 'Retro' },
          { id: 'light', label: 'Light' },
        ];
      case 'transitions':
        return [
          { id: 'all', label: 'All' },
          { id: 'basic', label: 'Basic' },
          { id: 'camera', label: 'Camera' },
          { id: 'light', label: 'Light' },
        ];
      case 'filters':
        return [
          { id: 'all', label: 'All' },
          { id: 'life', label: 'Life' },
          { id: 'movies', label: 'Movies' },
          { id: 'retro', label: 'Retro' },
          { id: 'mono', label: 'Mono' },
        ];
      case 'captions':
        return [
          { id: 'all', label: 'Auto' },
          { id: 'local', label: 'Local' },
        ];
      case 'adjustment':
        return [{ id: 'all', label: 'Presets' }];
      default:
        return [{ id: 'all', label: 'All' }];
    }
  }, [activeTab]);

  const handleTabSwitch = (tab: ResourceTabId) => {
    onChangeTab(tab);
    setSubCategory('all');
    setSearchQuery('');
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredAssets = mediaAssets.filter((a) => {
    const catOk = subCategory === 'all' || a.category === subCategory;
    const qOk = !q || a.name.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const filteredAudio = AUDIO_LIBRARY.filter((a) => {
    const catOk = subCategory === 'all' || a.category === subCategory;
    const qOk = !q || a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const allTextPresets = [...savedTextPresets, ...TEXT_PRESETS];
  const filteredText = allTextPresets.filter((item) => {
    const catOk = subCategory === 'all' || item.category === subCategory;
    const qOk = !q || item.label.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const filteredStickers = STICKER_PRESETS.filter((s) => {
    const catOk = subCategory === 'all' || s.category === subCategory;
    const qOk = !q || s.label.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const filteredEffects = EFFECT_PRESETS.filter((ef) => {
    const catOk = subCategory === 'all' || ef.category === subCategory;
    const qOk = !q || ef.name.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const filteredTransitions = TRANSITION_PRESETS.filter((tr) => {
    const catOk = subCategory === 'all' || tr.category === subCategory;
    const qOk = !q || tr.name.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const filteredFilters = FILTER_PRESETS.filter((fl) => {
    const catOk = subCategory === 'all' || fl.category === subCategory;
    const qOk = !q || fl.name.toLowerCase().includes(q);
    return catOk && qOk;
  });

  const toggleAudioPreview = (item: AudioLibraryItem) => {
    if (previewingAudioId === item.id) {
      audioEngine.stopPreview();
      setPreviewingAudioId(null);
    } else {
      setPreviewingAudioId(item.id);
      audioEngine.previewSynth(item.synthPreset, 2.2);
      window.setTimeout(() => {
        setPreviewingAudioId((cur) => (cur === item.id ? null : cur));
      }, 2200);
    }
  };

  return (
    <section
      aria-label="Media and Resource Library"
      className="flex flex-col bg-[#161619] border-r border-[#26262c] min-w-0 min-h-0 h-full overflow-hidden"
    >
      {/* Top Horizontal Icon Tabs */}
      <div className="relative flex items-center border-b border-[#26262c] shrink-0">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Resource categories"
          className="flex-1 flex items-center gap-0.5 px-2 pt-1.5 pb-1 overflow-x-auto no-scrollbar"
        >
          {TAB_ITEMS.map(({ id, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTabSwitch(id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md min-w-[48px] transition-colors shrink-0 cursor-pointer ${
                  active
                    ? 'text-[#00d5dc] bg-[#212126]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e23]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium whitespace-nowrap">
                  {t.tabs[id]}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="More resource tabs"
          onClick={() => {
            if (tabListRef.current) {
              const el = tabListRef.current;
              if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
                el.scrollTo({ left: 0, behavior: 'smooth' });
              } else {
                el.scrollBy({ left: 140, behavior: 'smooth' });
              }
            }
          }}
          className="px-1.5 h-full flex items-center justify-center text-zinc-400 hover:text-white bg-[#161619] border-l border-[#232329] shrink-0 cursor-pointer"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body: Left Sub-Category Rail + Main Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sub-category left sidebar */}
        <aside className="w-24 shrink-0 border-r border-[#232329] bg-[#141417] py-2 px-1.5 flex flex-col gap-0.5 overflow-y-auto">
          {subNavOptions.map((opt) => {
            const active = subCategory === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSubCategory(opt.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium truncate transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#222229] text-[#00d5dc]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1c1c21]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </aside>

        {/* Right Resource Content */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Search + Quick Import Bar */}
          <div className="p-2 border-b border-[#222228] flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="w-full bg-[#202025] border border-[#2c2c34] focus:border-[#00d5dc] rounded pl-7 pr-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
            </div>

            {activeTab === 'import' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,image/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onImportFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#0b1315] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>{t.importFilesBtn}</span>
                </button>
              </>
            )}

            {activeTab === 'text' && (
              <button
                type="button"
                onClick={() => onAddTextToTimeline()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#0b1315] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Texto</span>
              </button>
            )}
          </div>

          {/* Scrollable Resource Cards */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {activeTab === 'import' && (
              <div className="space-y-3">
                {/* Import dropzone box matching Screenshot 2 */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-[#34343e] hover:border-[#00d5dc] bg-[#1b1b20] hover:bg-[#202026] py-3.5 px-3 flex items-center justify-center gap-3 transition-colors cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-full bg-[#00d5dc] text-[#091214] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-zinc-100">
                      {t.importFilesBtn}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {t.importSubtitle}
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {filteredAssets.map((asset) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/x-klipframe-asset',
                          JSON.stringify({ type: 'media', assetId: asset.id }),
                        );
                      }}
                      className="group relative rounded-md overflow-hidden bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] transition-colors"
                    >
                      <div className="aspect-video w-full bg-[#121216] relative overflow-hidden">
                        {asset.thumbnail ? (
                          <img
                            src={asset.thumbnail}
                            alt={asset.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center ${
                              asset.proceduralKind === 'sunset'
                                ? 'bg-gradient-to-br from-indigo-900 via-rose-700 to-amber-500'
                                : asset.proceduralKind === 'neon'
                                  ? 'bg-gradient-to-br from-zinc-950 via-cyan-900 to-indigo-950'
                                  : asset.proceduralKind === 'spring'
                                    ? 'bg-gradient-to-br from-emerald-950 via-teal-700 to-amber-400'
                                    : 'bg-gradient-to-br from-slate-900 via-cyan-800 to-indigo-900'
                            }`}
                          >
                            <Film className="w-5 h-5 text-white/80" />
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-[10px] font-timecode text-zinc-200">
                          00:0{Math.round(asset.duration)}
                        </span>
                        <div className="absolute bottom-1 right-1 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {asset.kind !== 'audio' && (
                            <button
                              type="button"
                              onClick={() => onAddOverlayToTimeline(asset)}
                              aria-label={`Add ${asset.name} as PIP overlay`}
                              title="Add as Overlay / PIP"
                              className="px-1.5 h-6 rounded-full bg-[#1f1f26]/90 hover:bg-[#00d5dc] hover:text-[#091214] text-zinc-100 border border-white/15 text-[9px] font-bold shadow cursor-pointer"
                            >
                              PIP
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onAddMediaToTimeline(asset)}
                            aria-label={`Add ${asset.name} to timeline`}
                            className="w-6 h-6 rounded-full bg-[#00d5dc] text-[#091214] flex items-center justify-center shadow cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                      <div className="px-2 py-1.5 text-[11px] text-zinc-300 truncate">
                        {asset.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-1.5">
                {filteredAudio.map((item) => {
                  const isPrev = previewingAudioId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#1e1e24] hover:bg-[#25252d] border border-[#292931] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAudioPreview(item)}
                        aria-label={`Preview ${item.name}`}
                        className="w-7 h-7 rounded bg-[#2a2a33] hover:bg-[#34343f] flex items-center justify-center text-[#00d5dc] shrink-0 cursor-pointer"
                      >
                        {isPrev ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                          <span>{item.artist}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-timecode">{item.duration}s</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddAudioToTimeline(item)}
                        aria-label={`Add ${item.name} to timeline`}
                        className="w-6 h-6 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#091214] flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'text' && (
              <div className="grid grid-cols-2 gap-2">
                {filteredText.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onAddTextToTimeline(tpl)}
                    className="group relative rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] p-2.5 flex flex-col items-center justify-center h-20 transition-colors cursor-pointer"
                  >
                    <span
                      style={{
                        fontFamily: tpl.style.fontFamily || 'Plus Jakarta Sans',
                        color: tpl.style.color || '#ffffff',
                        fontWeight: tpl.style.fontWeight || 700,
                        fontStyle: tpl.style.italic ? 'italic' : 'normal',
                        backgroundColor:
                          (tpl.style.bgOpacity ?? 0) > 0
                            ? tpl.style.bgColor || '#000000'
                            : 'transparent',
                        padding: (tpl.style.bgOpacity ?? 0) > 0 ? '2px 8px' : '0px',
                        borderRadius: (tpl.style.bgOpacity ?? 0) > 0 ? '4px' : '0px',
                        textShadow: tpl.style.shadowColor
                          ? `0 2px 8px ${tpl.style.shadowColor}`
                          : undefined,
                      }}
                      className="text-sm text-center truncate max-w-full"
                    >
                      {tpl.label}
                    </span>
                    <span className="mt-1 text-[10px] text-zinc-500">
                      {tpl.category}
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-[#00d5dc] text-[#091214] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'stickers' && (
              <div className="grid grid-cols-3 gap-2">
                {filteredStickers.map((stk) => (
                  <button
                    key={stk.id}
                    type="button"
                    onClick={() => onAddStickerToTimeline(stk.emoji, stk.label)}
                    className="group rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] py-3 px-2 flex flex-col items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="text-2xl leading-none">{stk.emoji}</span>
                    <span className="text-[10px] text-zinc-400 truncate max-w-full">
                      {stk.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'effects' && (
              <div className="grid grid-cols-2 gap-2">
                {filteredEffects.map((ef) => (
                  <button
                    key={ef.id}
                    type="button"
                    onClick={() => onAddEffectToTimeline(ef.id, ef.name)}
                    className="group rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] p-2.5 flex flex-col items-start gap-2 transition-colors cursor-pointer text-left"
                  >
                    <div
                      className="w-full h-11 rounded flex items-center justify-center bg-[#141418] border border-white/5"
                      style={{
                        backgroundImage: `radial-gradient(circle at 30% 30%, ${ef.accent}33, transparent 70%)`,
                      }}
                    >
                      <Sparkles className="w-4 h-4" style={{ color: ef.accent }} />
                    </div>
                    <div className="w-full flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-zinc-200 truncate">
                        {ef.name}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-[#00d5dc] shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'transitions' && (
              <div className="grid grid-cols-2 gap-2">
                {filteredTransitions.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => onApplyTransition(tr.id, tr.defaultDuration)}
                    className="rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] p-2.5 flex flex-col items-start gap-2 transition-colors cursor-pointer text-left"
                  >
                    <div className="w-full h-10 rounded bg-[#141418] flex items-center justify-center gap-1.5">
                      <div className="w-5 h-5 rounded-sm bg-zinc-700" />
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#00d5dc]" />
                      <div className="w-5 h-5 rounded-sm bg-[#00d5dc]/40" />
                    </div>
                    <div className="w-full flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-zinc-200 truncate">
                        {tr.name}
                      </span>
                      <span className="text-[10px] font-timecode text-zinc-500">
                        {tr.defaultDuration}s
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'filters' && (
              <div className="grid grid-cols-2 gap-2">
                {filteredFilters.map((fl) => (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() => onAddFilterToTimeline(fl.id, fl.name)}
                    className="rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] p-2 flex flex-col gap-1.5 transition-colors cursor-pointer text-left"
                  >
                    <div
                      className={`w-full h-11 rounded bg-gradient-to-tr ${fl.swatch}`}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-zinc-200 truncate">
                        {fl.name}
                      </span>
                      <Plus className="w-3.5 h-3.5 text-[#00d5dc] shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'captions' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#1d1d23] border border-[#2a2a33] space-y-2.5">
                  <div className="text-xs font-semibold text-zinc-100">
                    Auto Captions / Subtítulos
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Genera pistas de subtítulos sincronizadas o importa/exporta archivos .SRT.
                  </p>
                  <button
                    type="button"
                    onClick={onGenerateAutoCaptions}
                    className="w-full py-2 px-3 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-[#091214] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Generar subtítulos ({SAMPLE_CAPTIONS.length})
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <input
                      ref={srtInputRef}
                      type="file"
                      accept=".srt,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        file.text().then((txt) => {
                          onImportSrt(txt);
                          e.target.value = '';
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => srtInputRef.current?.click()}
                      className="py-1.5 px-2 rounded bg-[#25252d] hover:bg-[#30303a] text-[11px] text-zinc-200 cursor-pointer"
                    >
                      {t.captions.importSrt}
                    </button>
                    <button
                      type="button"
                      onClick={onExportSrt}
                      className="py-1.5 px-2 rounded bg-[#25252d] hover:bg-[#30303a] text-[11px] text-zinc-200 cursor-pointer"
                    >
                      {t.captions.exportSrt}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#1a1a20] border border-[#272730] space-y-2">
                  <input
                    type="text"
                    value={manualCaptionText}
                    onChange={(e) => setManualCaptionText(e.target.value)}
                    placeholder="Escribe un subtítulo..."
                    aria-label="Manual caption text"
                    className="w-full bg-[#121216] border border-[#2c2c34] focus:border-[#00d5dc] rounded px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = manualCaptionText.trim() || 'Nuevo subtítulo';
                      onAddManualCaption(val);
                      setManualCaptionText('');
                    }}
                    className="w-full py-1.5 px-2.5 rounded bg-[#262630] hover:bg-[#32323e] text-[11px] font-medium text-[#00d5dc] cursor-pointer"
                  >
                    {t.captions.addManual}
                  </button>
                </div>

                <div className="space-y-1.5">
                  {SAMPLE_CAPTIONS.map((cap, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-2 rounded bg-[#1b1b20] border border-[#26262e] text-[11px] text-zinc-300 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{cap.text}</span>
                      <span className="text-[10px] font-timecode text-zinc-500 shrink-0">
                        {cap.start}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'adjustment' && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cinematic', name: 'Cinematic Contrast' },
                  { id: 'bright', name: 'Daylight Clean' },
                  { id: 'moody', name: 'Moody Shadows' },
                  { id: 'vivid', name: 'Vivid Travel' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyAdjustmentPreset(preset.id)}
                    className="rounded-md bg-[#202026] border border-[#2a2a32] hover:border-[#00d5dc] p-2.5 text-left transition-colors cursor-pointer space-y-1.5"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#00d5dc]" />
                    <div className="text-[11px] font-medium text-zinc-200">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
