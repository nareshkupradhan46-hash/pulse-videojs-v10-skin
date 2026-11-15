import { useMemo } from 'react';
import { CheckCircle2, Keyboard, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  computeDockContrastAudit,
  type BackdropSample,
} from '../utils/contrastAudit';

export type PlayerBackdropMode = 'video' | 'white' | 'black';

export interface FocusedControlInfo {
  label: string;
  role: string;
}

interface LiveAuditPanelProps {
  backdropMode: PlayerBackdropMode;
  onChangeBackdropMode: (mode: PlayerBackdropMode) => void;
  focusedControl: FocusedControlInfo | null;
  verifiedKeys: string[];
  lastKeyPressed: string | null;
  onFocusPlayer: () => void;
  onResetAudit: () => void;
}

const KEY_ITEMS = [
  { id: 'Space/K', label: 'Play / Pause', match: [' ', 'k', 'K'] },
  { id: 'J/L/Arrows', label: 'Seek ±10s', match: ['j', 'J', 'l', 'L', 'ArrowLeft', 'ArrowRight'] },
  { id: 'M', label: 'Mute Toggle', match: ['m', 'M'] },
  { id: 'Up/Down', label: 'Volume Step', match: ['ArrowUp', 'ArrowDown'] },
  { id: 'C', label: 'Captions', match: ['c', 'C'] },
  { id: 'F', label: 'Fullscreen', match: ['f', 'F'] },
  { id: 'I', label: 'Pic-in-Pic', match: ['i', 'I'] },
  { id: 'Tab/Esc', label: 'Focus & Exit', match: ['Tab', 'Escape'] },
];

export function matchAuditKeyId(key: string): string | null {
  const found = KEY_ITEMS.find((item) => item.match.includes(key));
  return found ? found.id : null;
}

export function LiveAuditPanel({
  backdropMode,
  onChangeBackdropMode,
  focusedControl,
  verifiedKeys,
  lastKeyPressed,
  onFocusPlayer,
  onResetAudit,
}: LiveAuditPanelProps) {
  const contrastSample: BackdropSample =
    backdropMode === 'white'
      ? 'white'
      : backdropMode === 'black'
        ? 'black'
        : 'white'; // Audit worst-case pure white glare by default when on video

  const contrastRows = useMemo(
    () => computeDockContrastAudit(contrastSample),
    [contrastSample]
  );

  const verifiedCount = verifiedKeys.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Live WCAG Contrast & Worst-Case Luminance Check */}
      <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#F4F4F0]">
                Live WCAG Contrast Audit
              </h3>
            </div>

            <div
              role="group"
              aria-label="Player backdrop luminance test"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-black/50 border border-white/10"
            >
              {(
                [
                  { id: 'video', label: 'Live Video' },
                  { id: 'white', label: 'Pure #FFF' },
                  { id: 'black', label: 'Pure #000' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeBackdropMode(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    backdropMode === opt.id
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Real-time sRGB relative luminance compositing the obsidian glass HUD (<span className="font-mono-tabular text-zinc-300">rgba(9,9,11,0.88)</span> + <span className="font-mono-tabular text-zinc-300">#09090B</span> contrast ring) over the 72% bottom scrim and{' '}
            <span className="font-mono-tabular text-zinc-200">
              {contrastSample === 'white' ? '#FFFFFF (worst-case bright glare)' : '#000000 (pitch black frame)'}
            </span>
            . Toggle Pure #FFF / Pure #000 above to inspect the live player directly.
          </p>

          <div className="divide-y divide-white/8 rounded-xl border border-white/10 bg-black/35 overflow-hidden">
            {contrastRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-zinc-200 truncate">{row.label}</div>
                  <div className="font-mono-tabular text-[11px] text-zinc-500">
                    {row.foregroundHex}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 font-mono-tabular">
                  <span className="text-sm font-semibold text-white">
                    {row.ratio.toFixed(1)}:1
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      row.grade === 'AAA'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    }`}
                  >
                    {row.grade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Live Keyboard Focus & Hotkey Walkthrough */}
      <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#F4F4F0]">
                Interactive Keyboard Walkthrough
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onFocusPlayer}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-[#FF6B00] border border-white/15 hover:border-[#FF6B00] text-[#F4F4F0] hover:text-zinc-950 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#FF6B00]"
              >
                Focus Player
              </button>
              <button
                type="button"
                onClick={onResetAudit}
                aria-label="Reset keyboard audit checklist"
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00]"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Live Focus Readout Bar */}
          <div className="rounded-xl border border-white/10 bg-black/45 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-400 shrink-0">Active Focus:</span>
              {focusedControl ? (
                <span className="font-mono-tabular text-amber-300 font-medium truncate">
                  {focusedControl.label}{' '}
                  <span className="text-zinc-500">({focusedControl.role})</span>
                </span>
              ) : (
                <span className="text-zinc-500">
                  Click Focus Player and press Tab or hotkeys
                </span>
              )}
            </div>
            <div className="font-mono-tabular text-[11px] text-zinc-400 shrink-0">
              {lastKeyPressed ? `Key: ${lastKeyPressed}` : `${verifiedCount}/${KEY_ITEMS.length} tested`}
            </div>
          </div>

          {/* Live Hotkey Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {KEY_ITEMS.map((item) => {
              const tested = verifiedKeys.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border px-3 py-2.5 transition-colors ${
                    tested
                      ? 'bg-amber-500/15 border-amber-500/45 text-white'
                      : 'bg-black/35 border-white/8 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <kbd className="font-mono-tabular text-[11px] font-semibold text-amber-300">
                      {item.id}
                    </kbd>
                    {tested && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-amber-400 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">{item.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
