export type PulseThemeId = 'amber' | 'oscilloscope' | 'light' | 'custom';

export type NightAudioMode = 'off' | 'voice' | 'whisper';

export type FlashGuardMode = 'off' | 'comfort' | 'strict';

export interface PulseAccessibilityState {
  highContrast: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  dyslexicFont: boolean;
  largeText: boolean;
}

export interface SubtitleStyleState {
  fontSize: 'sm' | 'md' | 'lg';
  color: '#F8FAFC' | '#FDE047' | '#10F56E';
  bgOpacity: number;
}

export interface FrameBookmark {
  id: string;
  reelId: string;
  time: number;
  note: string;
  createdAt: number;
}

export interface KeymapConfig {
  playPause: string;
  mute: string;
  fullscreen: string;
  captions: string;
  bookmark: string;
  info: string;
}

export const DEFAULT_KEYMAP: KeymapConfig = {
  playPause: 'k',
  mute: 'm',
  fullscreen: 'f',
  captions: 'c',
  bookmark: 'b',
  info: 'i',
};

export const THEME_ACCENTS: Record<PulseThemeId, string> = {
  amber: '#FF6B00',
  oscilloscope: '#10F56E',
  light: '#EA580C',
  custom: '#FF6B00',
};
