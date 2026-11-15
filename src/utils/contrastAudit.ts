export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function alphaComposite(
  fg: RgbColor,
  alpha: number,
  bg: RgbColor
): RgbColor {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function linearizeChannel(channel8Bit: number): number {
  const s = channel8Bit / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: RgbColor): number {
  const r = linearizeChannel(rgb.r);
  const g = linearizeChannel(rgb.g);
  const b = linearizeChannel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagGrade = 'AAA' | 'AA' | 'AA Large' | 'AA UI' | 'Fail';

export function getWcagGrade(ratio: number, isUiComponent = false): WcagGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return isUiComponent ? 'AA UI' : 'AA Large';
  return 'Fail';
}

export type BackdropSample = 'white' | 'mid' | 'black';

export interface ContrastAuditRow {
  id: string;
  label: string;
  foregroundHex: string;
  ratio: number;
  grade: WcagGrade;
}

const BACKDROP_RGB: Record<BackdropSample, RgbColor> = {
  white: { r: 255, g: 255, b: 255 },
  mid: { r: 120, g: 120, b: 128 },
  black: { r: 0, g: 0, b: 0 },
};

const SCRIM_BASE: RgbColor = { r: 6, g: 7, b: 10 };
const SCRIM_ALPHA = 0.72;
const OBSIDIAN_HUD_BASE: RgbColor = { r: 9, g: 9, b: 11 };
const OBSIDIAN_HUD_ALPHA = 0.88;

export function computeDockContrastAudit(sample: BackdropSample): ContrastAuditRow[] {
  const backdrop = BACKDROP_RGB[sample];
  const scrimmedBackdrop = alphaComposite(SCRIM_BASE, SCRIM_ALPHA, backdrop);
  const obsidianHudSurface = alphaComposite(
    OBSIDIAN_HUD_BASE,
    OBSIDIAN_HUD_ALPHA,
    scrimmedBackdrop
  );

  const primaryInk = hexToRgb('#F8FAFC');
  const amberAccent = hexToRgb('#FF6B00');
  const mutedInk = alphaComposite(primaryInk, 0.72, obsidianHudSurface);
  const badgeDarkInk = hexToRgb('#09090B');
  const badgeAmberBg = hexToRgb('#F59E0B');

  const rows: Array<{
    id: string;
    label: string;
    fg: RgbColor;
    bg: RgbColor;
    hex: string;
    isUiComponent?: boolean;
  }> = [
    {
      id: 'dock-ink',
      label: 'Control Icons & Timecode',
      fg: primaryInk,
      bg: scrimmedBackdrop,
      hex: '#F8FAFC',
    },
    {
      id: 'dock-amber',
      label: 'Pulse Laser Amber & Focus Ring',
      fg: amberAccent,
      bg: obsidianHudSurface,
      hex: '#FF6B00 · #09090B Ring',
      isUiComponent: true,
    },
    {
      id: 'dock-muted',
      label: 'Duration & Secondary Labels',
      fg: mutedInk,
      bg: obsidianHudSurface,
      hex: '72% Ink',
    },
    {
      id: 'badge-hash',
      label: 'Tag Badge # Anchor Cell',
      fg: badgeDarkInk,
      bg: badgeAmberBg,
      hex: '#09090B / #F59E0B',
    },
  ];

  return rows.map((row) => {
    const ratio = contrastRatio(row.fg, row.bg);
    return {
      id: row.id,
      label: row.label,
      foregroundHex: row.hex,
      ratio,
      grade: getWcagGrade(ratio, row.isUiComponent),
    };
  });
}
