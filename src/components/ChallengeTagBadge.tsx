import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export type TagBadgeVariant = 'obsidian' | 'paper' | 'glass';
export type TagBadgeSize = 'compact' | 'standard' | 'display';

interface ChallengeTagBadgeProps {
  variant?: TagBadgeVariant;
  size?: TagBadgeSize;
  copyable?: boolean;
  label?: string;
  tagSuffix?: string;
  className?: string;
}

const VARIANT_STYLES: Record<
  TagBadgeVariant,
  {
    shell: string;
    hashCell: string;
    hashStroke: string;
    label: string;
    suffix: string;
    copyBtn: string;
    corner: string;
  }
> = {
  obsidian: {
    shell:
      'bg-[#111114] border border-white/15 shadow-[0_6px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] text-[#F4F4F0]',
    hashCell: 'bg-amber-500 text-[#09090B] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]',
    hashStroke: 'stroke-[#09090B]',
    label: 'text-[#F4F4F0]',
    suffix: 'text-amber-300/90 border-l border-white/12',
    copyBtn:
      'text-zinc-400 hover:text-amber-300 hover:bg-white/[0.06] border-l border-white/12',
    corner: 'text-amber-400/70',
  },
  paper: {
    shell:
      'bg-[#FAF9F6] border border-zinc-900/15 shadow-[0_6px_20px_rgba(12,12,14,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] text-zinc-900',
    hashCell: 'bg-zinc-900 text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
    hashStroke: 'stroke-amber-400',
    label: 'text-zinc-900',
    suffix: 'text-zinc-600 border-l border-zinc-900/12',
    copyBtn:
      'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-900/[0.05] border-l border-zinc-900/12',
    corner: 'text-zinc-900/40',
  },
  glass: {
    shell:
      'bg-[#0B0B0E]/82 backdrop-blur-md border border-white/20 shadow-[0_8px_28px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.14)] text-white',
    hashCell: 'bg-amber-400 text-[#09090B] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
    hashStroke: 'stroke-[#09090B]',
    label: 'text-white',
    suffix: 'text-amber-300 border-l border-white/15',
    copyBtn:
      'text-zinc-300 hover:text-white hover:bg-white/10 border-l border-white/15',
    corner: 'text-amber-300/80',
  },
};

const SIZE_STYLES: Record<
  TagBadgeSize,
  {
    shell: string;
    hashCell: string;
    hashIcon: string;
    label: string;
    suffix: string;
    copyBtn: string;
  }
> = {
  compact: {
    shell: 'h-7 rounded-[7px] p-[3px] gap-2',
    hashCell: 'w-[20px] h-[20px] rounded-[4px]',
    hashIcon: 'w-3 h-3',
    label: 'text-[11.5px] font-semibold tracking-[-0.01em] pr-1.5',
    suffix: 'text-[10px] px-2',
    copyBtn: 'h-[20px] px-1.5 text-[10px]',
  },
  standard: {
    shell: 'h-9 rounded-[9px] p-1 gap-2.5',
    hashCell: 'w-[26px] h-[26px] rounded-[5px]',
    hashIcon: 'w-3.5 h-3.5',
    label: 'text-[13px] font-semibold tracking-[-0.015em] pr-1',
    suffix: 'text-[11px] px-2.5',
    copyBtn: 'h-[26px] px-2 text-[11px]',
  },
  display: {
    shell: 'h-12 rounded-[11px] p-1.5 gap-3.5',
    hashCell: 'w-9 h-9 rounded-[7px]',
    hashIcon: 'w-[18px] h-[18px]',
    label: 'text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] pr-2',
    suffix: 'text-[12px] px-3',
    copyBtn: 'h-9 px-3 text-[12px]',
  },
};

function PixelHashMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.75 2.5L4.25 13.5M11.75 2.5L10.25 13.5M2.5 5.75H13.5M2.5 10.25H13.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function ChallengeTagBadge({
  variant = 'obsidian',
  size = 'standard',
  copyable = true,
  label = 'Video.js Skins Design Challenge',
  tagSuffix = 'v10',
  className = '',
}: ChallengeTagBadgeProps) {
  const [copied, setCopied] = useState(false);
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  const handleCopy = async () => {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(`#${label}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`group relative inline-flex items-center whitespace-nowrap shrink-0 select-none transition-colors duration-150 ${v.shell} ${s.shell} ${className}`}
    >
      {/* Optical registration ticks on corners for precision hardware feel */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t border-l border-current opacity-60 rounded-tl-[2px] ${v.corner}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b border-r border-current opacity-60 rounded-br-[2px] ${v.corner}`}
      />

      {/* Precision # Hash Anchor Cell */}
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center shrink-0 ${v.hashCell} ${s.hashCell}`}
      >
        <PixelHashMark className={s.hashIcon} />
      </span>

      {/* Challenge Title */}
      <span className={`leading-none whitespace-nowrap ${v.label} ${s.label}`}>
        <span className="sr-only">#</span>
        {label}
      </span>

      {/* Version Marker */}
      {tagSuffix && (
        <span
          className={`font-mono-tabular leading-none flex items-center h-full font-medium ${v.suffix} ${s.suffix}`}
        >
          {tagSuffix}
        </span>
      )}

      {/* Optional Interactive Copy Action */}
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Tag copied to clipboard' : `Copy #${label}`}
          className={`inline-flex items-center gap-1.5 rounded-r-[5px] font-mono-tabular font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2 ${v.copyBtn} ${s.copyBtn}`}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-amber-400" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
