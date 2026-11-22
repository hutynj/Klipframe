import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FilePlus2,
  FolderUp,
  Keyboard,
  Languages,
  LayoutPanelTop,
  RotateCcw,
  Settings2,
  Share2,
  Trash2,
} from 'lucide-react';
import type { LanguageCode } from '../types/editor';
import type { Translations } from '../utils/i18n';

interface TopBarProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  lastSavedTime: string;
  lang: LanguageCode;
  t: Translations;
  onToggleLang: () => void;
  onNewEmptyProject: () => void;
  onClearTimeline: () => void;
  onRestoreDemo: () => void;
  onTriggerImport: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
  layoutMode: 'default' | 'timeline' | 'preview';
  onCycleLayout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  onRenameProject,
  lastSavedTime,
  t,
  onToggleLang,
  onNewEmptyProject,
  onClearTimeline,
  onRestoreDemo,
  onTriggerImport,
  onOpenSettings,
  onOpenShortcuts,
  onOpenShare,
  onOpenExport,
  layoutMode,
  onCycleLayout,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftName(projectName);
  }, [projectName]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const commitName = () => {
    setEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed) {
      onRenameProject(trimmed);
    } else {
      setDraftName(projectName);
    }
  };

  return (
    <header className="h-10 shrink-0 bg-[#141417] border-b border-[#26262c] px-3 flex items-center justify-between gap-4 select-none z-30">
      {/* Left zone: Logo + Menu + Auto saved */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Original KlipFrame geometric aperture/frame prism SVG */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect
              x="2.5"
              y="3.5"
              width="19"
              height="17"
              rx="3.5"
              stroke="#ffffff"
              strokeWidth="1.8"
            />
            <path d="M9.2 7.2L15.8 12L9.2 16.8V7.2Z" fill="#00d5dc" />
            <path d="M5.5 7.2H7.6V16.8H5.5V7.2Z" fill="#ffffff" />
            <circle cx="17.8" cy="7.2" r="1.2" fill="#00d5dc" />
          </svg>
          <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
            KlipFrame
          </span>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={t.menu}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#222227] hover:bg-[#2c2c33] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t.menu}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1.5 w-64 rounded-lg bg-[#1e1e23] border border-[#2f2f37] shadow-2xl py-1.5 z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNewEmptyProject();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.newProject}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTriggerImport();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <FolderUp className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.importMedia}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onRestoreDemo();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.loadDemo}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onClearTimeline();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.clearTimeline}</span>
              </button>
              <div className="my-1 border-t border-[#2c2c34]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.projectSettings}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenShortcuts();
                }}
                className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5 text-zinc-400" />
                <span>{t.menuItems.shortcuts}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleLang();
                }}
                className="w-full px-3 py-2 text-left text-xs text-[#00d5dc] hover:bg-[#2a2a32] flex items-center gap-2.5 cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{t.menuItems.language}</span>
              </button>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 font-timecode whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#00d5dc]" />
          <span>
            {t.autoSaved}: {lastSavedTime}
          </span>
        </div>
      </div>

      {/* Center zone: Editable project name */}
      <div className="flex items-center justify-center min-w-0">
        {editingName ? (
          <input
            type="text"
            aria-label={t.detailsFields.name}
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraftName(projectName);
                setEditingName(false);
              }
            }}
            className="bg-[#24242a] border border-[#00d5dc] rounded px-2 py-0.5 text-xs font-medium text-white text-center outline-none w-44"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            title="Click to rename project"
            className="px-2.5 py-0.5 rounded hover:bg-[#222227] text-xs font-medium text-zinc-200 truncate max-w-[200px] cursor-pointer transition-colors"
          >
            {projectName}
          </button>
        )}
      </div>

      {/* Right zone: Layout + Shortcuts + Share + Export */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCycleLayout}
          title={`Layout: ${layoutMode}`}
          aria-label="Switch workspace layout"
          className="p-1.5 rounded bg-[#202025] hover:bg-[#2a2a31] text-zinc-300 transition-colors cursor-pointer"
        >
          <LayoutPanelTop className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#202025] hover:bg-[#2a2a31] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Keyboard className="w-3.5 h-3.5 text-zinc-400" />
          <span>{t.shortcuts}</span>
        </button>

        <button
          type="button"
          onClick={onOpenShare}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#202025] hover:bg-[#2a2a31] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-zinc-400" />
          <span>{t.share}</span>
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#00d5dc] hover:bg-[#00bcc3] text-xs font-semibold text-[#0a1214] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t.exportBtn}</span>
        </button>
      </div>
    </header>
  );
};
