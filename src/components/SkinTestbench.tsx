import { useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Activity,
  BookmarkPlus,
  Columns2,
  Eye,
  Film,
  Keyboard,
  Maximize2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
} from 'lucide-react';
import { formatTimecode, type VideoReel } from '../utils/synthVideo';
import {
  LiveAuditPanel,
  type FocusedControlInfo,
  type PlayerBackdropMode,
} from './LiveAuditPanel';
import {
  DEFAULT_KEYMAP,
  type FlashGuardMode,
  type FrameBookmark,
  type KeymapConfig,
  type PulseAccessibilityState,
  type PulseThemeId,
  type SubtitleStyleState,
} from '../types/pulse';

export type ViewportPreset = 'desktop' | 'tablet' | 'mobile375' | 'mobile320';
type WorkbenchTab = 'audit' | 'theme' | 'queue';

interface SkinTestbenchProps {
  reels: VideoReel[];
  activeReelId: string;
  onSelectReel: (id: string) => void;
  onPrevReel: () => void;
  onNextReel: () => void;
  viewport: ViewportPreset;
  onSelectViewport: (vp: ViewportPreset) => void;
  theme: PulseThemeId;
  onSelectTheme: (t: PulseThemeId) => void;
  customAccent: string;
  onChangeCustomAccent: (hex: string) => void;
  accessibility: PulseAccessibilityState;
  onUpdateAccessibility: (patch: Partial<PulseAccessibilityState>) => void;
  flashGuardMode: FlashGuardMode;
  onChangeFlashGuardMode: (mode: FlashGuardMode) => void;
  subtitleStyle: SubtitleStyleState;
  onUpdateSubtitleStyle: (patch: Partial<SubtitleStyleState>) => void;
  keymap: KeymapConfig;
  onUpdateKeymap: (next: KeymapConfig) => void;
  bookmarks: FrameBookmark[];
  currentTime: number;
  resumeTime: number | null;
  onAddBookmark: (note?: string) => void;
  onDeleteBookmark: (id: string) => void;
  onJumpToTime: (seconds: number) => void;
  onClearWatchHistory: () => void;
  cinemaMode: boolean;
  onToggleCinemaMode: () => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
  forceControls: boolean;
  onToggleForceControls: () => void;
  showInPlayerBadge: boolean;
  onToggleInPlayerBadge: () => void;
  muxPlaybackId: string;
  onLoadMuxPlaybackId: (playbackId: string) => void;
  isUsingFallback: boolean;
  backdropMode: PlayerBackdropMode;
  onChangeBackdropMode: (mode: PlayerBackdropMode) => void;
  focusedControl: FocusedControlInfo | null;
  verifiedKeys: string[];
  lastKeyPressed: string | null;
  onFocusPlayer: () => void;
  onResetAudit: () => void;
}

const SHORTCUT_LABELS: { field: keyof KeymapConfig; label: string }[] = [
  { field: 'playPause', label: 'Play / Pause' },
  { field: 'mute', label: 'Mute Toggle' },
  { field: 'fullscreen', label: 'Fullscreen' },
  { field: 'captions', label: 'Captions' },
  { field: 'bookmark', label: 'Bookmark Frame' },
  { field: 'info', label: 'Picture-in-Picture' },
];

export function SkinTestbench({
  reels,
  activeReelId,
  onSelectReel,
  onPrevReel,
  onNextReel,
  viewport,
  onSelectViewport,
  theme,
  onSelectTheme,
  customAccent,
  onChangeCustomAccent,
  accessibility,
  onUpdateAccessibility,
  flashGuardMode,
  onChangeFlashGuardMode,
  subtitleStyle,
  onUpdateSubtitleStyle,
  keymap,
  onUpdateKeymap,
  bookmarks,
  currentTime,
  resumeTime,
  onAddBookmark,
  onDeleteBookmark,
  onJumpToTime,
  onClearWatchHistory,
  cinemaMode,
  onToggleCinemaMode,
  compareMode,
  onToggleCompareMode,
  forceControls,
  onToggleForceControls,
  showInPlayerBadge,
  onToggleInPlayerBadge,
  muxPlaybackId,
  onLoadMuxPlaybackId,
  isUsingFallback,
  backdropMode,
  onChangeBackdropMode,
  focusedControl,
  verifiedKeys,
  lastKeyPressed,
  onFocusPlayer,
  onResetAudit,
}: SkinTestbenchProps) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('audit');
  const [muxInput, setMuxInput] = useState(muxPlaybackId);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [capturingKey, setCapturingKey] = useState<keyof KeymapConfig | null>(null);

  const handleMuxSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = muxInput.trim();
    if (cleaned) {
      onLoadMuxPlaybackId(cleaned);
    }
  };

  const handleBookmarkSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddBookmark(bookmarkNote.trim() || undefined);
    setBookmarkNote('');
  };

  const handleRemapKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    field: keyof KeymapConfig
  ) => {
    if (capturingKey !== field) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setCapturingKey(null);
      return;
    }
    const normalized = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    onUpdateKeymap({ ...keymap, [field]: normalized });
    setCapturingKey(null);
  };

  return (
    <section id="accessibility" className="py-16 border-t border-white/10 no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header & Tab Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <p className="text-xs font-mono-tabular text-[#FF6B00] mb-2 tracking-wide">
              01. Pulse Instrument Workbench
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#F4F4F0] text-balance">
              Audit contrast, customize themes, and inspect queue telemetry
            </h2>
            {isUsingFallback && (
              <p className="mt-1.5 text-xs font-mono-tabular text-amber-300/90">
                Local synthetic WebM active (external CDN unreachable)
              </p>
            )}
          </div>

          {/* 3-Tab Instrument Selector */}
          <div
            role="tablist"
            aria-label="Workbench sections"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#121215] border border-white/10 shrink-0"
          >
            {(
              [
                { id: 'audit', label: 'Audit & Contrast', icon: ShieldCheck },
                { id: 'theme', label: 'Theme & A11y', icon: Palette },
                { id: 'queue', label: 'Queue & Bookmarks', icon: Film },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                    selected
                      ? 'bg-[#FF6B00] text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: AUDIT & CONTRAST */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Viewport Width Simulator (down to 320px) */}
              <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-[#F4F4F0]">
                    Responsive Container Size
                  </h3>
                  <span className="text-xs font-mono-tabular text-zinc-400">
                    @container media-root
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
                  {(
                    [
                      { id: 'desktop', label: 'Desktop', icon: Monitor },
                      { id: 'tablet', label: '640px', icon: Tablet },
                      { id: 'mobile375', label: '375px', icon: Smartphone },
                      { id: 'mobile320', label: '320px', icon: Smartphone },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = viewport === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectViewport(item.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                          active
                            ? 'bg-[#FF6B00] text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage Inspection Toggles: Cinema Mode, A/B Compare, Pin Controls, Badge */}
              <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-[#F4F4F0]">
                    Stage &amp; A/B Comparison Controls
                  </h3>
                  <span className="text-xs font-mono-tabular text-zinc-400">
                    v10 Comparison
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onToggleCompareMode}
                    aria-pressed={compareMode}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                      compareMode
                        ? 'bg-[#FF6B00]/18 border-[#FF6B00]/55 text-amber-200'
                        : 'bg-black/35 border-white/12 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>A/B vs Default v10</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleCinemaMode}
                    aria-pressed={cinemaMode}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                      cinemaMode
                        ? 'bg-[#FF6B00]/18 border-[#FF6B00]/55 text-amber-200'
                        : 'bg-black/35 border-white/12 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cinema Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleForceControls}
                    aria-pressed={forceControls}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                      forceControls
                        ? 'bg-[#FF6B00]/18 border-[#FF6B00]/55 text-amber-200'
                        : 'bg-black/35 border-white/12 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Pin HUD</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleInPlayerBadge}
                    aria-pressed={showInPlayerBadge}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                      showInPlayerBadge
                        ? 'bg-white/12 border-white/25 text-white'
                        : 'bg-black/35 border-white/12 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>In-Player Tag Badge</span>
                  </button>
                </div>
              </div>
            </div>

            <LiveAuditPanel
              backdropMode={backdropMode}
              onChangeBackdropMode={onChangeBackdropMode}
              focusedControl={focusedControl}
              verifiedKeys={verifiedKeys}
              lastKeyPressed={lastKeyPressed}
              onFocusPlayer={onFocusPlayer}
              onResetAudit={onResetAudit}
            />
          </div>
        )}

        {/* TAB 2: THEME & ACCESSIBILITY */}
        {activeTab === 'theme' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Theme Picker + Custom Accent */}
            <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#F4F4F0]">
                  Skin Theme &amp; Accent Picker
                </h3>
                <span className="text-xs font-mono-tabular text-zinc-400">
                  Saved to localStorage
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: 'amber',
                      label: 'Pulse Amber',
                      swatch: '#FF6B00',
                      desc: 'Obsidian glass + laser amber',
                    },
                    {
                      id: 'oscilloscope',
                      label: 'Oscilloscope',
                      swatch: '#10F56E',
                      desc: 'Phosphor green #10F56E',
                    },
                    {
                      id: 'light',
                      label: 'Light Paper',
                      swatch: '#EA580C',
                      desc: 'Daylight archival surface',
                    },
                    {
                      id: 'custom',
                      label: 'Custom Hex',
                      swatch: customAccent,
                      desc: 'User accent override',
                    },
                  ] as const
                ).map((preset) => {
                  const active = theme === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectTheme(preset.id)}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                        active
                          ? 'bg-white/10 border-[#FF6B00]/60 text-white'
                          : 'bg-black/35 border-white/10 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold">{preset.label}</span>
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/25"
                          style={{ backgroundColor: preset.swatch }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="text-[11px] text-zinc-400">{preset.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Input */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                <label htmlFor="custom-accent-color" className="text-xs text-zinc-300">
                  Custom Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-accent-color"
                    type="color"
                    value={customAccent}
                    onChange={(e) => {
                      onChangeCustomAccent(e.target.value);
                      onSelectTheme('custom');
                    }}
                    className="w-9 h-9 rounded-lg border border-white/15 bg-black cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customAccent}
                    aria-label="Custom accent hex code"
                    onChange={(e) => {
                      onChangeCustomAccent(e.target.value);
                      onSelectTheme('custom');
                    }}
                    className="w-24 rounded-lg bg-black/50 border border-white/12 px-2.5 py-1.5 text-xs font-mono-tabular text-white focus:border-[#FF6B00] focus:outline-none"
                  />
                </div>
              </div>

              {/* Accessibility Modes */}
              <div className="pt-3 border-t border-white/10 space-y-2.5">
                <span className="block text-xs font-medium text-zinc-400">
                  Accessibility Overrides
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: 'highContrast', label: 'High Contrast (>10:1)' },
                      { key: 'reducedMotion', label: 'Calm Motion' },
                      { key: 'reducedTransparency', label: 'Solid HUD (No Blur)' },
                      { key: 'dyslexicFont', label: 'Dyslexic Font' },
                      { key: 'largeText', label: 'Large Text' },
                    ] as const
                  ).map((item) => {
                    const active = accessibility[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          onUpdateAccessibility({ [item.key]: !active })
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                          active
                            ? 'bg-[#FF6B00]/18 border-[#FF6B00]/55 text-amber-200'
                            : 'bg-black/35 border-white/12 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    aria-pressed={flashGuardMode !== 'off'}
                    onClick={() =>
                      onChangeFlashGuardMode(flashGuardMode === 'off' ? 'comfort' : 'off')
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                      flashGuardMode !== 'off'
                        ? 'bg-emerald-500/18 border-emerald-400/55 text-emerald-200'
                        : 'bg-black/35 border-white/12 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Flash Guard ({flashGuardMode === 'off' ? 'Off' : flashGuardMode === 'strict' ? 'Strict 3Hz' : 'Balanced'})
                    </span>
                  </button>
                </div>

                {flashGuardMode !== 'off' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-zinc-400">
                    <span>Strobe &amp; glare sensitivity:</span>
                    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-black/50 border border-white/10">
                      <button
                        type="button"
                        onClick={() => onChangeFlashGuardMode('comfort')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          flashGuardMode === 'comfort'
                            ? 'bg-emerald-500 text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        Balanced
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeFlashGuardMode('strict')}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          flashGuardMode === 'strict'
                            ? 'bg-emerald-500 text-zinc-950 font-semibold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        Strict (3Hz)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Subtitle Styling + Remappable Keybindings */}
            <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 space-y-5">
              {/* Subtitle Cue Styling */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#F4F4F0]">
                    Caption Cue Styling
                  </h3>
                  <span className="text-xs font-mono-tabular text-zinc-400">
                    video::cue CSS vars
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Size</span>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/50 border border-white/10">
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => onUpdateSubtitleStyle({ fontSize: sz })}
                          className={`py-1 rounded text-[11px] font-mono-tabular uppercase cursor-pointer ${
                            subtitleStyle.fontSize === sz
                              ? 'bg-[#FF6B00] text-zinc-950 font-semibold'
                              : 'text-zinc-300 hover:text-white'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1.5">Cue Color</span>
                    <div className="flex items-center gap-2 h-8">
                      {(['#F8FAFC', '#FDE047', '#10F56E'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Set caption color ${c}`}
                          onClick={() => onUpdateSubtitleStyle({ color: c })}
                          className={`w-7 h-7 rounded-lg border cursor-pointer ${
                            subtitleStyle.color === c
                              ? 'border-white ring-2 ring-[#FF6B00]'
                              : 'border-white/20'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cue-bg-opacity"
                      className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5"
                    >
                      <span>Bg Opacity</span>
                      <span className="font-mono-tabular">
                        {Math.round(subtitleStyle.bgOpacity * 100)}%
                      </span>
                    </label>
                    <input
                      id="cue-bg-opacity"
                      type="range"
                      min={0.4}
                      max={1}
                      step={0.05}
                      value={subtitleStyle.bgOpacity}
                      onChange={(e) =>
                        onUpdateSubtitleStyle({ bgOpacity: parseFloat(e.target.value) })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Remappable Keyboard Shortcuts */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[#F4F4F0]">
                      Remappable Keybindings
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateKeymap(DEFAULT_KEYMAP);
                      setCapturingKey(null);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SHORTCUT_LABELS.map((item) => {
                    const isListening = capturingKey === item.field;
                    return (
                      <button
                        key={item.field}
                        type="button"
                        onClick={() =>
                          setCapturingKey(isListening ? null : item.field)
                        }
                        onKeyDown={(e) => handleRemapKeyDown(e, item.field)}
                        className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                          isListening
                            ? 'bg-[#FF6B00]/18 border-[#FF6B00] text-white'
                            : 'bg-black/35 border-white/10 text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <span className="text-[11px] text-zinc-400">{item.label}</span>
                        <kbd className="font-mono-tabular text-xs font-semibold text-[#FF6B00]">
                          {isListening ? 'Press a key…' : keymap[item.field].toUpperCase()}
                        </kbd>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QUEUE, MUX HLS & FRAME BOOKMARKS */}
        {activeTab === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Playlist / Queue + Mux Playback ID Loader */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#F4F4F0]">
                    Playlist Queue &amp; Luminance Reels
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Includes Mux MP4, bright/dark stress reels, and adaptive HLS
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onPrevReel}
                    aria-label="Previous reel"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextReel}
                    aria-label="Next reel"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {reels.map((reel) => {
                  const active = activeReelId === reel.id && !muxPlaybackId;
                  const Icon =
                    reel.id === 'bright'
                      ? Sun
                      : reel.id === 'dark'
                        ? Moon
                        : reel.isHls
                          ? Activity
                          : Film;
                  return (
                    <button
                      key={reel.id}
                      type="button"
                      onClick={() => onSelectReel(reel.id)}
                      className={`flex flex-col items-start gap-1.5 p-3.5 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] ${
                        active
                          ? 'bg-[#FF6B00]/14 border-[#FF6B00]/55 text-white'
                          : 'bg-black/35 border-white/10 text-zinc-300 hover:bg-white/[0.04] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon
                          className={`w-4 h-4 ${active ? 'text-[#FF6B00]' : 'text-zinc-400'}`}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-mono-tabular text-zinc-400">
                          {reel.luminanceNote}
                        </span>
                      </div>
                      <span className="text-xs font-semibold leading-snug line-clamp-1 mt-1">
                        {reel.title.split('—')[0].trim()}
                      </span>
                      <span className="text-[11px] text-zinc-500 line-clamp-1">
                        {reel.streamBadge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mux Playback ID Loader */}
              <form
                onSubmit={handleMuxSubmit}
                className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <label htmlFor="mux-playback-input" className="sr-only">
                  Mux Public Playback ID
                </label>
                <input
                  id="mux-playback-input"
                  type="text"
                  value={muxInput}
                  onChange={(e) => setMuxInput(e.target.value)}
                  placeholder="Paste Mux Playback ID (e.g. DS00Spx1CV902MCtPj5WknGlR102V5HFkDe)"
                  className="flex-1 min-w-0 rounded-lg bg-black/50 border border-white/12 px-3 py-2 text-xs font-mono-tabular text-white placeholder:text-zinc-500 focus:border-[#FF6B00] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00]"
                >
                  Load Mux HLS
                </button>
              </form>
            </div>

            {/* Frame Bookmarks & Watch History */}
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookmarkPlus className="w-4 h-4 text-[#FF6B00]" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[#F4F4F0]">
                      Frame Bookmarks ({bookmarks.length})
                    </h3>
                  </div>

                  {resumeTime !== null && resumeTime > 2 && (
                    <div className="flex items-center gap-2 text-[11px] font-mono-tabular">
                      <button
                        type="button"
                        onClick={() => onJumpToTime(resumeTime)}
                        className="text-emerald-400 hover:underline cursor-pointer"
                      >
                        Resume {formatTimecode(resumeTime)}
                      </button>
                      <button
                        type="button"
                        onClick={onClearWatchHistory}
                        className="text-zinc-500 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleBookmarkSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bookmarkNote}
                    onChange={(e) => setBookmarkNote(e.target.value)}
                    placeholder={`Note at ${formatTimecode(currentTime)}…`}
                    aria-label="Bookmark frame note"
                    className="flex-1 min-w-0 rounded-lg bg-black/50 border border-white/12 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-[#FF6B00] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-[#FF6B00] hover:opacity-95 text-xs font-semibold text-zinc-950 whitespace-nowrap cursor-pointer"
                  >
                    Pin {formatTimecode(currentTime)}
                  </button>
                </form>

                {/* Bookmarks List */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center border border-dashed border-white/10 rounded-xl">
                      Press <kbd className="font-mono-tabular text-zinc-300">{keymap.bookmark.toUpperCase()}</kbd> inside the player or pin above to save a timestamped frame.
                    </p>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToTime(bm.time)}
                          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:text-[#FF6B00]"
                        >
                          <span className="font-mono-tabular font-semibold text-[#FF6B00] shrink-0">
                            {formatTimecode(bm.time)}
                          </span>
                          <span className="text-zinc-200 truncate">{bm.note}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBookmark(bm.id)}
                          aria-label={`Remove bookmark at ${formatTimecode(bm.time)}`}
                          className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
