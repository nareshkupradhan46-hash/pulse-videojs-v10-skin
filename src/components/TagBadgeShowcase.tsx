import { memo, useState } from 'react';
import { Check, Copy, Maximize, Sun, Moon, Layers } from 'lucide-react';
import { ChallengeTagBadge, type TagBadgeSize, type TagBadgeVariant } from './ChallengeTagBadge';

const SUFFIX_OPTIONS = ['v10', '2026', 'Apache-2.0', ''] as const;

export const TagBadgeShowcase = memo(function TagBadgeShowcase() {
  const [variant, setVariant] = useState<TagBadgeVariant>('obsidian');
  const [size, setSize] = useState<TagBadgeSize>('display');
  const [suffix, setSuffix] = useState<string>('v10');
  const [showGrid, setShowGrid] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const stageBg =
    variant === 'paper'
      ? 'bg-[#EAE8E2] text-zinc-900 border-zinc-900/10'
      : variant === 'glass'
        ? 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-white border-white/15'
        : 'bg-[#08080A] text-white border-white/12';

  const snippet = `<ChallengeTagBadge
  variant="${variant}"
  size="${size}"${suffix ? `\n  tagSuffix="${suffix}"` : '\n  tagSuffix=""'}
  label="Video.js Skins Design Challenge"
/>`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  };

  return (
    <section id="tag-badge" className="py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-mono-tabular text-amber-400 mb-3 tracking-wide">
              02. Challenge Tag Badge
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#F4F4F0] text-balance">
              Pixel-aligned hardware stamp for #Video.js Skins Design Challenge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
              Crafted on a strict 4px optical grid with 1px registration corners, an amber signal anchor cell holding a custom square-cap hash glyph, and balanced typography across dark, archival paper, and frosted video surfaces.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono-tabular shrink-0">
            <span>4px grid</span>
            <span aria-hidden="true">·</span>
            <span>1px hairline</span>
            <span aria-hidden="true">·</span>
            <span>WCAG AA contrast</span>
          </div>
        </div>

        {/* Interactive Badge Stage + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Live Badge Specimen Canvas */}
          <div
            className={`lg:col-span-7 relative rounded-2xl border p-8 sm:p-12 flex flex-col items-center justify-center min-h-[280px] overflow-hidden transition-colors duration-200 ${stageBg}`}
          >
            {/* Optional Precision Grid Overlay */}
            {showGrid && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    variant === 'paper'
                      ? 'linear-gradient(to right, rgba(24,24,27,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,24,27,0.14) 1px, transparent 1px)'
                      : 'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
            )}

            <div className="relative z-10 flex flex-col items-center gap-6">
              <ChallengeTagBadge
                variant={variant}
                size={size}
                tagSuffix={suffix}
                copyable
              />

              <div className="flex items-center gap-4 text-[11px] font-mono-tabular opacity-65">
                <span>Surface: {variant}</span>
                <span aria-hidden="true">·</span>
                <span>Scale: {size}</span>
                <span aria-hidden="true">·</span>
                <span>Height: {size === 'compact' ? '28px' : size === 'standard' ? '36px' : '48px'}</span>
              </div>
            </div>
          </div>

          {/* Specimen Inspector Controls */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#121215] p-6 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Surface Finish */}
              <div>
                <span className="block text-xs font-medium text-zinc-400 mb-2">
                  Surface Finish
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
                  {(
                    [
                      { id: 'obsidian', label: 'Obsidian', icon: Moon },
                      { id: 'paper', label: 'Paper', icon: Sun },
                      { id: 'glass', label: 'Overlay', icon: Layers },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = variant === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVariant(item.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          active
                            ? 'bg-amber-500 text-zinc-950 font-semibold'
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

              {/* Optical Size Scale */}
              <div>
                <span className="block text-xs font-medium text-zinc-400 mb-2">
                  Optical Size Scale
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
                  {(['compact', 'standard', 'display'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 ${
                        size === s
                          ? 'bg-white/15 text-white'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Index Suffix */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="block text-xs font-medium text-zinc-400 mb-2">
                    Index Suffix
                  </span>
                  <div className="flex items-center gap-1.5">
                    {SUFFIX_OPTIONS.map((opt) => (
                      <button
                        key={opt || 'none'}
                        type="button"
                        onClick={() => setSuffix(opt)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tabular transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                          suffix === opt
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
                        }`}
                      >
                        {opt || 'None'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-zinc-400 mb-2">
                    16px Grid
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGrid((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      showGrid
                        ? 'bg-white/12 text-white border-white/20'
                        : 'bg-transparent text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{showGrid ? 'Visible' : 'Hidden'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Component Usage Snippet */}
            <div className="rounded-xl bg-black/60 border border-white/10 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono-tabular text-zinc-400">
                  ChallengeTagBadge.tsx
                </span>
                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-amber-400 hover:text-amber-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 rounded px-1.5 py-0.5"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3 h-3" aria-hidden="true" />
                      <span>Copied JSX</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      <span>Copy JSX</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11.5px] font-mono-tabular text-zinc-300 overflow-x-auto leading-relaxed">
                <code>{snippet}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* All Three Variants Side-by-Side Comparison Strip */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-[#0B0B0D] p-5 flex flex-col items-start gap-3">
            <span className="text-xs font-medium text-zinc-400">Obsidian Signal (Dark UI)</span>
            <ChallengeTagBadge variant="obsidian" size="standard" copyable={false} />
          </div>
          <div className="rounded-xl border border-zinc-900/10 bg-[#F4F3EE] p-5 flex flex-col items-start gap-3">
            <span className="text-xs font-medium text-zinc-600">Archival Paper (Light UI)</span>
            <ChallengeTagBadge variant="paper" size="standard" copyable={false} />
          </div>
          <div className="rounded-xl border border-white/15 bg-gradient-to-r from-zinc-700/70 via-stone-600/60 to-zinc-800/80 p-5 flex flex-col items-start gap-3">
            <span className="text-xs font-medium text-zinc-200">Frosted Glass (Over Video)</span>
            <ChallengeTagBadge variant="glass" size="standard" copyable={false} />
          </div>
        </div>
      </div>
    </section>
  );
});
