import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BufferingIndicator,
  CaptionsRadioGroup,
  Container,
  Controls,
  FullscreenButton,
  Gesture,
  Hotkey,
  Menu,
  MuteButton,
  PlayButton,
  PlaybackRateRadioGroup,
  Popover,
  Poster,
  QualityRadioGroup,
  SeekButton,
  SeekIndicator,
  StatusAnnouncer,
  StatusIndicator,
  Time,
  TimeSlider,
  Tooltip,
  VolumeIndicator,
  VolumePopover,
  VolumeSlider,
  getGestureCoordinator,
  useOptionalContainer,
  useQualityOptions,
} from '@videojs/react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  AudioLines,
  BookmarkPlus,
  Captions,
  CaptionsOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FastForward,
  FileText,
  Gauge,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Palette,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Rewind,
  RotateCcw,
  RotateCw,
  Shield,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sun,
  SunDim,
  SunMedium,
  Tv,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import type { FlashGuardState } from '../hooks/useFlashGuard';
import {
  DEFAULT_SUBTITLE_STYLE,
  THEME_ACCENTS,
  type FlashGuardMode,
  type FrameBookmark,
  type KeymapConfig,
  type NightAudioMode,
  type PulseAccessibilityState,
  type PulseThemeId,
  type SubtitleEdgeStyle,
  type SubtitleStyleState,
} from '../types/pulse';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  cuesToVtt,
  formatTimecode,
  parseSubtitlesFile,
  type ReelSubtitleCue,
  type ReelSubtitleTrack,
  type VideoReel,
} from '../utils/synthVideo';

const QUALITY_TIERS = [
  'Auto',
  '4K (2160p)',
  '1440p (2K)',
  '1080p',
  '720p',
  '480p',
  '360p',
] as const;

const HIGH_RES_PROFILES = [
  { label: '4K (2160p)', height: 2160, badge: 'UHD' },
  { label: '1440p (2K)', height: 1440, badge: 'QHD' },
  { label: '1080p', height: 1080, badge: 'FHD' },
] as const;

const THEME_LABELS: Record<PulseThemeId, string> = {
  amber: 'Pulse Amber',
  oscilloscope: 'Oscilloscope',
  light: 'Light Paper',
  custom: 'Custom Accent',
};

interface CadenceVideoSkinProps {
  children: ReactNode;
  reel: VideoReel;
  title: string;
  poster?: string;
  muxPlaybackId?: string;
  theme: PulseThemeId;
  customAccent: string;
  onChangeTheme: (theme: PulseThemeId) => void;
  accessibility: PulseAccessibilityState;
  subtitleStyle: SubtitleStyleState;
  onUpdateSubtitleStyle?: (patch: Partial<SubtitleStyleState>) => void;
  customSubtitleTrack?: ReelSubtitleTrack | null;
  onUploadSubtitleTrack?: (track: ReelSubtitleTrack) => void;
  onSubtitleUserInteraction?: () => void;
  bookmarks: FrameBookmark[];
  resumeTime: number | null;
  currentTime: number;
  duration: number;
  bufferedPct?: number;
  playbackRate: number;
  volumePct: number;
  muted: boolean;
  isPlaying: boolean;
  selectedQuality: string;
  onSelectQuality: (quality: string) => void;
  onAddBookmark: () => void;
  onJumpToTime: (seconds: number) => void;
  onPrevReel: () => void;
  onNextReel: () => void;
  onDownload: () => void;
  keymap: KeymapConfig;
  forceControlsVisible?: boolean;
  showSignalBattery?: boolean;
  onToggleSignalBattery?: () => void;
  showTime?: boolean;
  onToggleTime?: () => void;
  nightAudioMode?: NightAudioMode;
  onChangeNightAudioMode?: (mode: NightAudioMode) => void;
  nightCompressionDb?: number;
  flashGuardMode?: FlashGuardMode;
  onChangeFlashGuardMode?: (mode: FlashGuardMode) => void;
  flashGuard?: FlashGuardState;
  isPip?: boolean;
  onTogglePip?: () => void;
  backdropMode?: 'video' | 'white' | 'black';
  ambientRgb?: string;
  className?: string;
}

function ControlTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactElement;
}) {
  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger render={children} />
      <Tooltip.Popup className="cadence-tooltip">
        <Tooltip.Label>{label}</Tooltip.Label>
        {shortcut && <Tooltip.Shortcut className="cadence-tooltip-kbd">{shortcut}</Tooltip.Shortcut>}
      </Tooltip.Popup>
    </Tooltip.Root>
  );
}

function hexToRgbString(hex: string): string {
  const raw = hex.replace('#', '').trim();
  const clean =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  if (clean.length !== 6) return '255, 107, 0';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '255, 107, 0';
  return `${r}, ${g}, ${b}`;
}

function hexToGlowRgba(hex: string, alpha = 0.45): string {
  return `rgba(${hexToRgbString(hex)}, ${alpha})`;
}

function relativeRgbLuminance(rgbStr: string): number {
  const parts = rgbStr.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0.3;
  const lin = (c: number) => {
    const s = Math.max(0, Math.min(255, c)) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(parts[0]) + 0.7152 * lin(parts[1]) + 0.0722 * lin(parts[2]);
}

function mixRgb(
  rgbStr: string,
  target: [number, number, number],
  targetWeight: number
): string {
  const parts = rgbStr.split(',').map((s) => Number(s.trim()));
  const base: [number, number, number] =
    parts.length === 3 && !parts.some((n) => Number.isNaN(n))
      ? [parts[0], parts[1], parts[2]]
      : [255, 107, 0];
  const w = Math.max(0, Math.min(1, targetWeight));
  const r = Math.round(base[0] * (1 - w) + target[0] * w);
  const g = Math.round(base[1] * (1 - w) + target[1] * w);
  const b = Math.round(base[2] * (1 - w) + target[2] * w);
  return `rgb(${r}, ${g}, ${b})`;
}

function contrastTextForRgb(rgbStr: string): string {
  return relativeRgbLuminance(rgbStr) > 0.42 ? '#09090b' : '#ffffff';
}

export function CadenceVideoSkin({
  children,
  reel,
  title,
  poster,
  muxPlaybackId,
  theme,
  customAccent,
  onChangeTheme,
  accessibility,
  subtitleStyle,
  onUpdateSubtitleStyle,
  customSubtitleTrack,
  onUploadSubtitleTrack,
  onSubtitleUserInteraction,
  bookmarks,
  resumeTime,
  currentTime,
  duration,
  playbackRate,
  volumePct,
  muted,
  isPlaying,
  selectedQuality,
  onSelectQuality,
  onAddBookmark,
  onJumpToTime,
  onPrevReel,
  onNextReel,
  onDownload,
  keymap,
  forceControlsVisible = false,
  showSignalBattery = false,
  onToggleSignalBattery,
  showTime = false,
  onToggleTime,
  nightAudioMode = 'off',
  onChangeNightAudioMode,
  nightCompressionDb = 0,
  flashGuardMode = 'off',
  onChangeFlashGuardMode,
  flashGuard,
  isPip = false,
  onTogglePip,
  backdropMode = 'video',
  ambientRgb = '255, 107, 0',
  className = '',
}: CadenceVideoSkinProps) {
  const [clockLabel, setClockLabel] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const [shortcutHint, setShortcutHint] = useState<{
    id: number;
    keyLabel: string;
    actionLabel: string;
    detail?: string;
    icon:
      | 'play'
      | 'pause'
      | 'mute'
      | 'unmute'
      | 'seek-back'
      | 'seek-fwd'
      | 'vol-up'
      | 'vol-down'
      | 'fullscreen'
      | 'captions'
      | 'pip'
      | 'bookmark'
      | 'jump'
      | 'night'
      | 'guard';
  } | null>(null);
  const shortcutTimerRef = useRef<number | null>(null);

  const playerContainer = useOptionalContainer();
  const [edgeRipple, setEdgeRipple] = useState<{
    side: 'left' | 'right';
    seconds: number;
    originX: number;
    originY: number;
    rippleKey: number;
  } | null>(null);
  const edgeRippleTimerRef = useRef<number | null>(null);

  const [brightnessPct, setBrightnessPct] = useState<number>(75);
  const brightnessRef = useRef<number>(75);
  brightnessRef.current = brightnessPct;
  const volumePctRef = useRef<number>(volumePct);
  volumePctRef.current = volumePct;

  const [swipeHud, setSwipeHud] = useState<{
    type: 'brightness' | 'volume';
    value: number;
  } | null>(null);
  const swipeHudTimerRef = useRef<number | null>(null);

  const [subtitlesOpen, setSubtitlesOpen] = useState<boolean>(false);
  const [subtitlesTab, setSubtitlesTab] = useState<'controls' | 'transcript'>('controls');
  const [transcriptCopied, setTranscriptCopied] = useState<boolean>(false);
  const [subtitleUploadMsg, setSubtitleUploadMsg] = useState<string | null>(null);
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);

  interface DiscoveredTrack {
    index: number;
    label: string;
    language: string;
    kind: string;
    mode: TextTrackMode;
  }
  const [discoveredTracks, setDiscoveredTracks] = useState<DiscoveredTrack[]>([]);
  const [lastActiveTrackIdx, setLastActiveTrackIdx] = useState<number>(0);
  const [preciseTime, setPreciseTime] = useState<number>(currentTime);
  const [nativeCuesSnapshot, setNativeCuesSnapshot] = useState<ReelSubtitleCue[]>([]);

  const showShortcutHint = useCallback(
    (
      hint: Omit<
        NonNullable<typeof shortcutHint>,
        'id'
      >
    ) => {
      if (shortcutTimerRef.current !== null) {
        window.clearTimeout(shortcutTimerRef.current);
      }
      setShortcutHint({ ...hint, id: Date.now() });
      shortcutTimerRef.current = window.setTimeout(() => {
        setShortcutHint(null);
        shortcutTimerRef.current = null;
      }, 1700);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (shortcutTimerRef.current !== null) {
        window.clearTimeout(shortcutTimerRef.current);
      }
      if (edgeRippleTimerRef.current !== null) {
        window.clearTimeout(edgeRippleTimerRef.current);
      }
      if (swipeHudTimerRef.current !== null) {
        window.clearTimeout(swipeHudTimerRef.current);
      }
    };
  }, []);

  // Subscribe to Video.js double-tap seekStep gestures for left/right edge ripple feedback
  useEffect(() => {
    if (!playerContainer) return;
    const coordinator = getGestureCoordinator(playerContainer);
    return coordinator.subscribe((activateEvent) => {
      if (activateEvent.action !== 'seekStep') return;
      const stepValue = typeof activateEvent.value === 'number' ? activateEvent.value : 0;
      if (stepValue === 0) return;

      const side: 'left' | 'right' = stepValue < 0 ? 'left' : 'right';
      const step = Math.abs(stepValue);
      const rect = playerContainer.getBoundingClientRect();
      const pointerEvt = activateEvent.event as PointerEvent | undefined;

      let originX = side === 'left' ? 38 : 62;
      let originY = 50;
      if (pointerEvt && rect.width > 0 && rect.height > 0) {
        const zoneWidth = rect.width * 0.44;
        const zoneLeft = side === 'left' ? rect.left : rect.right - zoneWidth;
        originX = Math.max(8, Math.min(92, ((pointerEvt.clientX - zoneLeft) / zoneWidth) * 100));
        originY = Math.max(12, Math.min(88, ((pointerEvt.clientY - rect.top) / rect.height) * 100));
      }

      setEdgeRipple((prev) => {
        const accumulated = prev && prev.side === side ? prev.seconds + step : step;
        return {
          side,
          seconds: accumulated,
          originX,
          originY,
          rippleKey: Date.now() + Math.random(),
        };
      });

      if (edgeRippleTimerRef.current !== null) {
        window.clearTimeout(edgeRippleTimerRef.current);
      }
      edgeRippleTimerRef.current = window.setTimeout(() => {
        setEdgeRipple(null);
        edgeRippleTimerRef.current = null;
      }, 850);
    });
  }, [playerContainer]);

  // Mobile touch vertical swipe: Left half -> Brightness, Right half -> Volume
  useEffect(() => {
    if (!playerContainer) return;

    let tracking = false;
    let locked = false;
    let side: 'brightness' | 'volume' = 'volume';
    let startX = 0;
    let startY = 0;
    let startValue = 100;
    let suppressNextTap = false;

    const scheduleSwipeHudHide = () => {
      if (swipeHudTimerRef.current !== null) {
        window.clearTimeout(swipeHudTimerRef.current);
      }
      swipeHudTimerRef.current = window.setTimeout(() => {
        setSwipeHud(null);
        swipeHudTimerRef.current = null;
      }, 700);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        locked = false;
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'button, a, input, select, textarea, [role="slider"], [role="menu"], [role="menuitem"], .cadence-dock, .cadence-top-bar, .cadence-center-stage, .cadence-menu-popup'
        )
      ) {
        tracking = false;
        locked = false;
        return;
      }

      const touch = e.touches[0];
      const rect = playerContainer.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      tracking = true;
      locked = false;
      suppressNextTap = false;
      startX = touch.clientX;
      startY = touch.clientY;
      side = touch.clientX - rect.left < rect.width * 0.5 ? 'brightness' : 'volume';

      if (side === 'brightness') {
        startValue = brightnessRef.current;
      } else {
        const video = playerContainer.querySelector('video');
        startValue = video
          ? video.muted
            ? 0
            : Math.round((video.volume ?? 1) * 100)
          : volumePctRef.current;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!locked) {
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.25) {
          locked = true;
          suppressNextTap = true;
          startY = touch.clientY;
          if (swipeHudTimerRef.current !== null) {
            window.clearTimeout(swipeHudTimerRef.current);
            swipeHudTimerRef.current = null;
          }
        } else {
          return;
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      const rect = playerContainer.getBoundingClientRect();
      const travel = Math.max(120, rect.height * 0.65);
      const deltaPct = Math.round(((startY - touch.clientY) / travel) * 100);
      const next = Math.max(0, Math.min(100, startValue + deltaPct));

      if (side === 'brightness') {
        setBrightnessPct(next);
        setSwipeHud({ type: 'brightness', value: next });
      } else {
        const video = playerContainer.querySelector('video');
        if (video) {
          video.volume = next / 100;
          video.muted = next === 0;
        }
        setSwipeHud({ type: 'volume', value: next });
      }
    };

    const onTouchEnd = () => {
      if (locked) {
        scheduleSwipeHudHide();
      }
      tracking = false;
      locked = false;
    };

    const onPointerUpCapture = (e: PointerEvent) => {
      if (suppressNextTap && e.pointerType === 'touch') {
        suppressNextTap = false;
        e.stopPropagation();
      }
    };

    playerContainer.addEventListener('touchstart', onTouchStart, { passive: true });
    playerContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    playerContainer.addEventListener('touchend', onTouchEnd, { passive: true });
    playerContainer.addEventListener('touchcancel', onTouchEnd, { passive: true });
    playerContainer.addEventListener('pointerup', onPointerUpCapture, { capture: true });

    return () => {
      playerContainer.removeEventListener('touchstart', onTouchStart);
      playerContainer.removeEventListener('touchmove', onTouchMove);
      playerContainer.removeEventListener('touchend', onTouchEnd);
      playerContainer.removeEventListener('touchcancel', onTouchEnd);
      playerContainer.removeEventListener('pointerup', onPointerUpCapture, { capture: true });
    };
  }, [playerContainer]);

  const qualityOptions = useQualityOptions();
  const hasHlsRenditions = Boolean(
    qualityOptions && !qualityOptions.hidden && qualityOptions.options.length > 1
  );

  const highestNativeHls = useMemo(() => {
    if (!qualityOptions || qualityOptions.options.length === 0) {
      return { value: '', maxHeight: 0 };
    }
    let bestValue = '';
    let maxHeight = 0;
    for (const opt of qualityOptions.options) {
      if (opt.value === 'auto') continue;
      const m = opt.label.match(/(\d{3,4})p/i);
      const h = m ? Number(m[1]) : 0;
      if (h >= maxHeight) {
        maxHeight = h;
        bestValue = opt.value;
      }
    }
    return { value: bestValue, maxHeight };
  }, [qualityOptions]);

  const extraHighResProfiles = useMemo(() => {
    if (!hasHlsRenditions) return [];
    return HIGH_RES_PROFILES.filter((p) => p.height > highestNativeHls.maxHeight);
  }, [hasHlsRenditions, highestNativeHls.maxHeight]);

  const handleSelectHighResProfile = useCallback(
    (label: string) => {
      if (hasHlsRenditions && highestNativeHls.value && qualityOptions) {
        qualityOptions.setValue(highestNativeHls.value);
      }
      onSelectQuality(label);
    },
    [hasHlsRenditions, highestNativeHls.value, qualityOptions, onSelectQuality]
  );

  useEffect(() => {
    const updateClock = () => {
      setClockLabel(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    const timer = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Sync discovered subtitle/caption tracks and precise time from underlying <video>
  const syncTextTracksFromDom = useCallback(() => {
    const video = playerContainer?.querySelector('video');
    if (!video || !video.textTracks) {
      setDiscoveredTracks([]);
      setNativeCuesSnapshot([]);
      return;
    }

    const list: DiscoveredTrack[] = [];
    let showingTrack: TextTrack | null = null;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      const tr = video.textTracks[i];
      if (tr.kind !== 'subtitles' && tr.kind !== 'captions') continue;
      const idx = list.length;
      list.push({
        index: idx,
        label: tr.label || (tr.language ? `Track (${tr.language.toUpperCase()})` : `Track ${idx + 1}`),
        language: tr.language || 'en',
        kind: tr.kind,
        mode: tr.mode,
      });
      if (tr.mode === 'showing') {
        showingTrack = tr;
        setLastActiveTrackIdx(idx);
      }
    }
    setDiscoveredTracks(list);

    if (showingTrack && showingTrack.cues && showingTrack.cues.length > 0) {
      const cues: ReelSubtitleCue[] = [];
      for (let i = 0; i < showingTrack.cues.length; i += 1) {
        const c = showingTrack.cues[i] as VTTCue;
        if (typeof c.startTime === 'number' && typeof c.endTime === 'number' && c.text) {
          cues.push({ start: c.startTime, end: c.endTime, text: c.text });
        }
      }
      setNativeCuesSnapshot(cues);
    } else {
      setNativeCuesSnapshot([]);
    }
  }, [playerContainer]);

  useEffect(() => {
    const video = playerContainer?.querySelector('video');
    if (!video) return;

    syncTextTracksFromDom();
    const onTrackChange = () => syncTextTracksFromDom();

    const tracks = video.textTracks;
    const hasTrackEvents = typeof tracks?.addEventListener === 'function';

    video.addEventListener('loadedmetadata', onTrackChange);
    if (hasTrackEvents) {
      tracks.addEventListener('change', onTrackChange);
      tracks.addEventListener('addtrack', onTrackChange);
      tracks.addEventListener('removetrack', onTrackChange);
    } else if (tracks) {
      tracks.onchange = onTrackChange;
    }

    return () => {
      video.removeEventListener('loadedmetadata', onTrackChange);
      if (hasTrackEvents) {
        tracks.removeEventListener('change', onTrackChange);
        tracks.removeEventListener('addtrack', onTrackChange);
        tracks.removeEventListener('removetrack', onTrackChange);
      } else if (tracks && tracks.onchange === onTrackChange) {
        tracks.onchange = null;
      }
    };
  }, [playerContainer, reel.id, customSubtitleTrack?.id, syncTextTracksFromDom]);

  const activeSubtitleTrack = useMemo(
    () => discoveredTracks.find((t) => t.mode === 'showing') ?? null,
    [discoveredTracks]
  );
  const subtitlesActive = activeSubtitleTrack !== null;

  useEffect(() => {
    if (!subtitlesActive && !subtitlesOpen) return;
    const video = playerContainer?.querySelector('video');
    if (!video) return;

    const onTime = () => setPreciseTime(video.currentTime || 0);
    onTime();
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
    };
  }, [playerContainer, subtitlesActive, subtitlesOpen, reel.id]);

  useEffect(() => {
    if (!subtitlesActive && !subtitlesOpen) return;
    setPreciseTime(currentTime);
  }, [currentTime, subtitlesActive, subtitlesOpen]);

  const setSubtitleTrackMode = useCallback(
    (targetIndex: number | null) => {
      onSubtitleUserInteraction?.();
      const video = playerContainer?.querySelector('video');
      if (!video || !video.textTracks) return;

      let subIdx = 0;
      for (let i = 0; i < video.textTracks.length; i += 1) {
        const tr = video.textTracks[i];
        if (tr.kind !== 'subtitles' && tr.kind !== 'captions') continue;
        tr.mode = targetIndex !== null && subIdx === targetIndex ? 'showing' : 'disabled';
        subIdx += 1;
      }
      if (targetIndex !== null) {
        setLastActiveTrackIdx(targetIndex);
      }
      syncTextTracksFromDom();
    },
    [onSubtitleUserInteraction, playerContainer, syncTextTracksFromDom]
  );

  const handleToggleSubtitlesMaster = useCallback(() => {
    if (subtitlesActive) {
      setSubtitleTrackMode(null);
    } else if (discoveredTracks.length > 0) {
      const target =
        lastActiveTrackIdx < discoveredTracks.length ? lastActiveTrackIdx : 0;
      setSubtitleTrackMode(target);
    }
  }, [subtitlesActive, discoveredTracks.length, lastActiveTrackIdx, setSubtitleTrackMode]);

  const activeTrackCues = useMemo<ReelSubtitleCue[]>(() => {
    if (nativeCuesSnapshot.length > 0) return nativeCuesSnapshot;
    const allTracks = customSubtitleTrack
      ? [...reel.subtitleTracks, customSubtitleTrack]
      : reel.subtitleTracks;
    if (activeSubtitleTrack) {
      const matched =
        allTracks.find(
          (t) =>
            t.label === activeSubtitleTrack.label ||
            t.lang === activeSubtitleTrack.language
        ) ?? allTracks[activeSubtitleTrack.index];
      if (matched) return matched.cues;
    }
    return allTracks[0]?.cues ?? [];
  }, [nativeCuesSnapshot, customSubtitleTrack, reel.subtitleTracks, activeSubtitleTrack]);

  const effectiveSubtitleTime = Math.max(
    0,
    preciseTime - (subtitleStyle.syncOffsetSec ?? 0)
  );

  const activeCueTexts = useMemo(() => {
    if (!subtitlesActive || activeTrackCues.length === 0) return [];
    return activeTrackCues
      .filter(
        (c) =>
          effectiveSubtitleTime >= c.start && effectiveSubtitleTime <= c.end
      )
      .map((c) => c.text);
  }, [subtitlesActive, activeTrackCues, effectiveSubtitleTime]);

  const handleCopyTranscript = async () => {
    if (activeTrackCues.length === 0) return;
    const text = activeTrackCues
      .map((c) => `[${formatTimecode(c.start)}] ${c.text}`)
      .join('\n');
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setTranscriptCopied(true);
      window.setTimeout(() => setTranscriptCopied(false), 1800);
    }
  };

  const handleDownloadVtt = () => {
    if (activeTrackCues.length === 0) return;
    const vtt = cuesToVtt(activeTrackCues);
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reel.id}-subtitles.vtt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSubtitleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text =
        typeof file.text === 'function'
          ? await file.text()
          : await new Response(file).text();
      const { vttBlobUrl, cues } = parseSubtitlesFile(text);
      const baseName = file.name.replace(/\.(vtt|srt)$/i, '').slice(0, 22);
      const customTrack: ReelSubtitleTrack = {
        id: `custom-${Date.now()}`,
        lang: 'en',
        label: `Custom · ${baseName}`,
        kind: 'subtitles',
        src: vttBlobUrl,
        cues,
      };
      onUploadSubtitleTrack?.(customTrack);
      setSubtitleUploadMsg(`Loaded ${cues.length} cues`);
      window.setTimeout(() => setSubtitleUploadMsg(null), 2400);
      window.setTimeout(() => {
        const video = playerContainer?.querySelector('video');
        if (!video?.textTracks) return;
        let lastSubIdx = -1;
        let count = 0;
        for (let i = 0; i < video.textTracks.length; i += 1) {
          const tr = video.textTracks[i];
          if (tr.kind === 'subtitles' || tr.kind === 'captions') {
            lastSubIdx = count;
            count += 1;
          }
        }
        if (lastSubIdx >= 0) {
          setSubtitleTrackMode(lastSubIdx);
        }
      }, 120);
    } catch {
      setSubtitleUploadMsg('Could not parse file');
      window.setTimeout(() => setSubtitleUploadMsg(null), 2200);
    }
  };

  const handleCueClick = () => {
    if (!subtitleStyle.pauseOnCueClick) return;
    const video = playerContainer?.querySelector('video');
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const activeAccent =
    theme === 'custom' ? customAccent : THEME_ACCENTS[theme];

  const isLightUi =
    !accessibility.highContrast &&
    (backdropMode === 'white' || (backdropMode === 'video' && theme === 'light'));
  const isWhiteTone =
    !isLightUi &&
    (accessibility.highContrast || backdropMode === 'black');

  const skinStyle = useMemo(() => {
    const cueSize =
      subtitleStyle.fontSize === 'sm'
        ? '0.85rem'
        : subtitleStyle.fontSize === 'lg'
          ? '1.25rem'
          : '1rem';
    const themeAccentRgb = hexToRgbString(activeAccent);
    const videoRgb =
      backdropMode === 'white'
        ? '17, 24, 39'
        : backdropMode === 'black'
          ? '248, 250, 252'
          : ambientRgb || themeAccentRgb;
    const videoLum = relativeRgbLuminance(videoRgb);
    const adaptiveBorder =
      videoLum < 0.16
        ? mixRgb(videoRgb, [255, 255, 255], 0.36)
        : `rgba(${videoRgb}, 0.78)`;
    const adaptiveHoverBorder =
      videoLum < 0.16
        ? mixRgb(videoRgb, [255, 255, 255], 0.28)
        : `rgb(${videoRgb})`;
    const adaptiveHoverFg = contrastTextForRgb(videoRgb);
    const adaptiveIconColor =
      videoLum >= 0.24
        ? `rgb(${videoRgb})`
        : mixRgb(videoRgb, [255, 255, 255], 0.32);
    const adaptiveActiveFg =
      videoLum >= 0.26
        ? `rgb(${videoRgb})`
        : mixRgb(videoRgb, [255, 255, 255], 0.36);
    const lightAdoptedBg =
      videoLum > 0.36
        ? mixRgb(videoRgb, [9, 9, 11], 0.22)
        : `rgb(${videoRgb})`;
    const lightAdoptedFg = contrastTextForRgb(
      videoLum > 0.36 ? '17, 24, 39' : videoRgb
    );

    const btnVars = isLightUi
      ? backdropMode === 'white'
        ? {
            '--pulse-btn-bg': 'rgba(255, 255, 255, 0.96)',
            '--pulse-btn-fg': '#09090b',
            '--pulse-btn-border': 'rgba(9, 9, 11, 0.88)',
            '--pulse-btn-shadow':
              '0 0 0 1px rgba(255, 255, 255, 0.96), 0 4px 12px rgba(0, 0, 0, 0.26)',
            '--pulse-btn-hover-bg': '#09090b',
            '--pulse-btn-hover-fg': '#ffffff',
            '--pulse-btn-hover-border': '#09090b',
            '--pulse-btn-hover-shadow':
              '0 0 0 2px rgba(255, 255, 255, 0.96), 0 6px 16px rgba(0, 0, 0, 0.36)',
            '--pulse-btn-active-bg': '#09090b',
            '--pulse-btn-active-fg': '#ffffff',
            '--pulse-btn-active-border': '#09090b',
            '--pulse-btn-active-shadow':
              '0 0 0 2px rgba(255, 255, 255, 0.96), 0 6px 18px rgba(0, 0, 0, 0.42)',
            '--pulse-center-bg': '#09090b',
            '--pulse-center-fg': '#ffffff',
            '--pulse-center-border': '#ffffff',
            '--pulse-center-shadow':
              '0 0 0 2px #09090b, 0 8px 24px rgba(0, 0, 0, 0.42)',
            '--pulse-center-hover-bg': '#18181b',
            '--pulse-center-hover-fg': '#ffffff',
            '--pulse-center-hover-border': '#ffffff',
            '--pulse-center-seek-bg': 'rgba(255, 255, 255, 0.96)',
            '--pulse-center-seek-fg': '#09090b',
            '--pulse-center-seek-border': '#09090b',
            '--pulse-dot-color': '#09090b',
            '--pulse-menu-surface-bg': 'rgba(250, 250, 249, 0.97)',
            '--pulse-menu-surface-fg': '#09090b',
            '--pulse-menu-surface-border': 'rgba(9, 9, 11, 0.78)',
            '--pulse-menu-hint': 'rgba(9, 9, 11, 0.68)',
            '--pulse-menu-sep': 'rgba(9, 9, 11, 0.14)',
            '--pulse-menu-hover-bg': 'rgba(9, 9, 11, 0.08)',
            '--pulse-menu-accent': '#09090b',
            '--pulse-menu-pill-bg': '#09090b',
            '--pulse-menu-pill-fg': '#ffffff',
            '--pulse-menu-item-active-bg': 'rgba(9, 9, 11, 0.1)',
            '--pulse-menu-item-active-fg': '#09090b',
            '--pulse-menu-icon': '#09090b',
            '--pulse-switch-off-bg': 'rgba(9, 9, 11, 0.18)',
            '--pulse-switch-off-border': 'rgba(9, 9, 11, 0.34)',
            '--pulse-switch-on-bg': '#09090b',
            '--pulse-switch-on-border': '#09090b',
            '--pulse-switch-thumb': '#ffffff',
          }
        : {
            '--pulse-btn-bg': 'rgba(250, 250, 249, 0.94)',
            '--pulse-btn-fg': '#09090b',
            '--pulse-btn-border': lightAdoptedBg,
            '--pulse-btn-shadow':
              `0 0 0 1px rgba(255, 255, 255, 0.92), 0 4px 12px rgba(0, 0, 0, 0.22)`,
            '--pulse-btn-hover-bg': lightAdoptedBg,
            '--pulse-btn-hover-fg': lightAdoptedFg,
            '--pulse-btn-hover-border': lightAdoptedBg,
            '--pulse-btn-hover-shadow':
              `0 0 0 2px rgba(255, 255, 255, 0.92), 0 6px 16px rgba(${videoRgb}, 0.34)`,
            '--pulse-btn-active-bg': lightAdoptedBg,
            '--pulse-btn-active-fg': lightAdoptedFg,
            '--pulse-btn-active-border': lightAdoptedBg,
            '--pulse-btn-active-shadow':
              `0 0 0 2px rgba(255, 255, 255, 0.94), 0 6px 18px rgba(${videoRgb}, 0.38)`,
            '--pulse-center-bg': lightAdoptedBg,
            '--pulse-center-fg': lightAdoptedFg,
            '--pulse-center-border': '#ffffff',
            '--pulse-center-shadow':
              '0 0 0 2px #09090b, 0 8px 24px rgba(0, 0, 0, 0.4)',
            '--pulse-center-hover-bg': '#09090b',
            '--pulse-center-hover-fg': '#ffffff',
            '--pulse-center-hover-border': lightAdoptedBg,
            '--pulse-center-seek-bg': 'rgba(250, 250, 249, 0.94)',
            '--pulse-center-seek-fg': '#09090b',
            '--pulse-center-seek-border': lightAdoptedBg,
            '--pulse-dot-color': lightAdoptedBg,
            '--pulse-menu-surface-bg': 'rgba(250, 250, 249, 0.97)',
            '--pulse-menu-surface-fg': '#09090b',
            '--pulse-menu-surface-border': lightAdoptedBg,
            '--pulse-menu-hint': 'rgba(9, 9, 11, 0.68)',
            '--pulse-menu-sep': `rgba(${videoRgb}, 0.18)`,
            '--pulse-menu-hover-bg': `rgba(${videoRgb}, 0.1)`,
            '--pulse-menu-accent': lightAdoptedBg,
            '--pulse-menu-pill-bg': lightAdoptedBg,
            '--pulse-menu-pill-fg': lightAdoptedFg,
            '--pulse-menu-item-active-bg': `rgba(${videoRgb}, 0.14)`,
            '--pulse-menu-item-active-fg': lightAdoptedBg,
            '--pulse-menu-icon': lightAdoptedBg,
            '--pulse-switch-off-bg': 'rgba(9, 9, 11, 0.18)',
            '--pulse-switch-off-border': 'rgba(9, 9, 11, 0.34)',
            '--pulse-switch-on-bg': lightAdoptedBg,
            '--pulse-switch-on-border': lightAdoptedBg,
            '--pulse-switch-thumb': '#ffffff',
          }
      : isWhiteTone
        ? {
            '--pulse-btn-bg': 'rgba(9, 10, 14, 0.94)',
            '--pulse-btn-fg': '#ffffff',
            '--pulse-btn-border': 'rgba(255, 255, 255, 0.88)',
            '--pulse-btn-shadow':
              '0 0 0 1px rgba(0, 0, 0, 0.92), 0 4px 12px rgba(0, 0, 0, 0.72)',
            '--pulse-btn-hover-bg': '#ffffff',
            '--pulse-btn-hover-fg': '#09090b',
            '--pulse-btn-hover-border': '#ffffff',
            '--pulse-btn-hover-shadow':
              '0 0 0 2px #09090b, 0 0 0 3.5px rgba(255, 255, 255, 0.78), 0 6px 18px rgba(0, 0, 0, 0.7)',
            '--pulse-btn-active-bg': '#ffffff',
            '--pulse-btn-active-fg': '#09090b',
            '--pulse-btn-active-border': '#ffffff',
            '--pulse-btn-active-shadow':
              '0 0 0 2px #09090b, 0 0 0 3.5px rgba(255, 255, 255, 0.84), 0 6px 18px rgba(0, 0, 0, 0.72)',
            '--pulse-center-bg': '#ffffff',
            '--pulse-center-fg': '#09090b',
            '--pulse-center-border': '#ffffff',
            '--pulse-center-shadow':
              '0 0 0 2px #09090b, 0 0 0 4px rgba(255, 255, 255, 0.72), 0 12px 28px rgba(0, 0, 0, 0.7)',
            '--pulse-center-hover-bg': '#f4f4f5',
            '--pulse-center-hover-fg': '#09090b',
            '--pulse-center-hover-border': '#ffffff',
            '--pulse-center-seek-bg': 'rgba(9, 10, 14, 0.94)',
            '--pulse-center-seek-fg': '#ffffff',
            '--pulse-center-seek-border': 'rgba(255, 255, 255, 0.9)',
            '--pulse-dot-color': '#ffffff',
            '--pulse-menu-surface-bg': 'rgba(9, 10, 14, 0.97)',
            '--pulse-menu-surface-fg': '#ffffff',
            '--pulse-menu-surface-border': 'rgba(255, 255, 255, 0.85)',
            '--pulse-menu-hint': 'rgba(255, 255, 255, 0.78)',
            '--pulse-menu-sep': 'rgba(255, 255, 255, 0.18)',
            '--pulse-menu-hover-bg': 'rgba(255, 255, 255, 0.14)',
            '--pulse-menu-accent': '#ffffff',
            '--pulse-menu-pill-bg': '#ffffff',
            '--pulse-menu-pill-fg': '#09090b',
            '--pulse-menu-item-active-bg': 'rgba(255, 255, 255, 0.18)',
            '--pulse-menu-item-active-fg': '#ffffff',
            '--pulse-menu-icon': '#ffffff',
            '--pulse-switch-off-bg': 'rgba(255, 255, 255, 0.14)',
            '--pulse-switch-off-border': 'rgba(255, 255, 255, 0.35)',
            '--pulse-switch-on-bg': '#ffffff',
            '--pulse-switch-on-border': '#ffffff',
            '--pulse-switch-thumb': '#09090b',
          }
        : {
            '--pulse-btn-bg': 'rgba(10, 12, 16, 0.84)',
            '--pulse-btn-fg': '#f8fafc',
            '--pulse-btn-border': adaptiveBorder,
            '--pulse-btn-shadow':
              '0 2px 8px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
            '--pulse-btn-hover-bg': `rgb(${videoRgb})`,
            '--pulse-btn-hover-fg': adaptiveHoverFg,
            '--pulse-btn-hover-border': adaptiveHoverBorder,
            '--pulse-btn-hover-shadow': `0 0 0 1px rgba(${videoRgb}, 0.35), 0 4px 12px rgba(0, 0, 0, 0.45)`,
            '--pulse-btn-active-bg': `rgba(${videoRgb}, 0.2)`,
            '--pulse-btn-active-fg': adaptiveActiveFg,
            '--pulse-btn-active-border': adaptiveHoverBorder,
            '--pulse-btn-active-shadow': `0 2px 8px rgba(0, 0, 0, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.14)`,
            '--pulse-center-bg': 'rgba(10, 12, 16, 0.86)',
            '--pulse-center-fg': '#ffffff',
            '--pulse-center-border': adaptiveBorder,
            '--pulse-center-shadow': '0 0 0 1px rgba(0, 0, 0, 0.52), 0 10px 24px rgba(0, 0, 0, 0.54), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
            '--pulse-center-hover-bg': `rgb(${videoRgb})`,
            '--pulse-center-hover-fg': adaptiveHoverFg,
            '--pulse-center-hover-border': adaptiveHoverBorder,
            '--pulse-center-seek-bg': 'rgba(10, 12, 16, 0.8)',
            '--pulse-center-seek-fg': '#ffffff',
            '--pulse-center-seek-border': adaptiveBorder,
            '--pulse-dot-color': adaptiveIconColor,
            '--pulse-menu-surface-bg': 'rgba(11, 13, 18, 0.95)',
            '--pulse-menu-surface-fg': '#f8fafc',
            '--pulse-menu-surface-border': adaptiveBorder,
            '--pulse-menu-hint': 'rgba(248, 250, 252, 0.72)',
            '--pulse-menu-sep': `rgba(${videoRgb}, 0.18)`,
            '--pulse-menu-hover-bg': `rgba(${videoRgb}, 0.14)`,
            '--pulse-menu-accent': adaptiveIconColor,
            '--pulse-menu-pill-bg': `rgb(${videoRgb})`,
            '--pulse-menu-pill-fg': adaptiveHoverFg,
            '--pulse-menu-item-active-bg': `rgba(${videoRgb}, 0.2)`,
            '--pulse-menu-item-active-fg': adaptiveActiveFg,
            '--pulse-menu-icon': adaptiveIconColor,
            '--pulse-switch-off-bg': 'rgba(255, 255, 255, 0.12)',
            '--pulse-switch-off-border': 'rgba(255, 255, 255, 0.24)',
            '--pulse-switch-on-bg': `rgba(${videoRgb}, 0.36)`,
            '--pulse-switch-on-border': adaptiveHoverBorder,
            '--pulse-switch-thumb': '#ffffff',
          };

    const videoBrightness =
      brightnessPct <= 75
        ? 0.25 + (brightnessPct / 75) * 0.75
        : 1 + ((brightnessPct - 75) / 25) * 0.3;
    const guardBrightness = flashGuard?.brightnessFactor ?? 1;
    const guardContrast = flashGuard?.contrastFactor ?? 1;
    const guardVeil = flashGuard?.veilOpacity ?? 0;
    const isUltraRes =
      selectedQuality.includes('2160p') || selectedQuality.includes('1440p');
    const isFullHd = selectedQuality.includes('1080p');
    return {
      '--pulse-accent': activeAccent,
      '--pulse-accent-glow': hexToGlowRgba(activeAccent, 0.45),
      '--pulse-video-rgb': videoRgb,
      '--pulse-video-color': `rgb(${videoRgb})`,
      '--pulse-video-glow': `rgba(${videoRgb}, 0.42)`,
      '--pulse-video-brightness': videoBrightness.toFixed(3),
      '--pulse-guard-brightness': guardBrightness.toFixed(3),
      '--pulse-guard-contrast': guardContrast.toFixed(3),
      '--pulse-guard-veil': guardVeil.toFixed(3),
      '--pulse-hires-contrast': isUltraRes ? '1.045' : isFullHd ? '1.02' : '1',
      '--pulse-hires-saturate': isUltraRes ? '1.05' : isFullHd ? '1.02' : '1',
      '--pulse-cue-size': cueSize,
      '--pulse-cue-color': subtitleStyle.color,
      '--pulse-cue-bg': `rgba(10, 10, 13, ${subtitleStyle.bgOpacity})`,
      ...btnVars,
    } as CSSProperties;
  }, [
    accessibility.highContrast,
    activeAccent,
    ambientRgb,
    backdropMode,
    brightnessPct,
    flashGuard,
    isLightUi,
    isWhiteTone,
    selectedQuality,
    subtitleStyle,
    theme,
  ]);

  const previewThumbUrl = muxPlaybackId
    ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=220`
    : poster;

  const introWindow = reel.introWindow;
  const showSkipIntro =
    Boolean(introWindow) &&
    currentTime >= (introWindow?.[0] ?? 0) &&
    currentTime <= (introWindow?.[1] ?? 0);

  const showResumePrompt =
    resumeTime !== null && resumeTime > 3 && currentTime < 2 && duration > 6;

  const showNextUp =
    duration > 14 && currentTime >= duration - 6 && currentTime < duration;

  const deviceStatus = useDeviceStatus();
  const signalBars = [1, 2, 3, 4].map(
    (level) => deviceStatus.online && deviceStatus.signalBars >= level
  );

  const handleBookmarkClick = () => {
    onAddBookmark();
    setBookmarkFeedback(`Pinned ${formatTimecode(currentTime)}`);
    window.setTimeout(() => setBookmarkFeedback(null), 1600);
  };

  const handleContainerKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    const rawKey = e.key;
    const lower = rawKey.toLowerCase();
    const isSpace = rawKey === ' ' || rawKey === 'Spacebar';
    const isButtonTarget = target?.tagName === 'BUTTON';

    if (lower === keymap.bookmark.toLowerCase()) {
      e.preventDefault();
      handleBookmarkClick();
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.bookmark),
        actionLabel: 'Bookmark Frame',
        detail: formatTimecode(currentTime),
        icon: 'bookmark',
      });
      return;
    }

    if (
      (isSpace && (!isButtonTarget || target?.getAttribute('aria-label')?.toLowerCase().includes('play') || target?.getAttribute('aria-label')?.toLowerCase().includes('pause'))) ||
      lower === keymap.playPause.toLowerCase()
    ) {
      showShortcutHint({
        keyLabel: isSpace ? 'SPACE' : formatShortcutUpper(keymap.playPause),
        actionLabel: isPlaying ? 'Pause' : 'Play',
        detail: formatTimecode(currentTime),
        icon: isPlaying ? 'pause' : 'play',
      });
      return;
    }

    if (lower === keymap.mute.toLowerCase()) {
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.mute),
        actionLabel: muted ? 'Unmuted' : 'Muted',
        detail: muted ? `${volumePct}%` : '0%',
        icon: muted ? 'unmute' : 'mute',
      });
      return;
    }

    if (lower === keymap.fullscreen.toLowerCase()) {
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.fullscreen),
        actionLabel: 'Toggle Fullscreen',
        icon: 'fullscreen',
      });
      return;
    }

    if (lower === keymap.captions.toLowerCase()) {
      onSubtitleUserInteraction?.();
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.captions),
        actionLabel: subtitlesActive ? 'Captions Off' : 'Captions On',
        icon: 'captions',
      });
      return;
    }

    if (lower === keymap.info.toLowerCase()) {
      e.preventDefault();
      onTogglePip?.();
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.info),
        actionLabel: isPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture',
        icon: 'pip',
      });
      return;
    }

    if (lower === 'n') {
      e.preventDefault();
      const nextMode: NightAudioMode = nightAudioMode === 'off' ? 'whisper' : 'off';
      onChangeNightAudioMode?.(nextMode);
      showShortcutHint({
        keyLabel: 'N',
        actionLabel: nextMode === 'off' ? 'Night Mode Off' : 'Whisper Night Mode',
        detail: nextMode === 'off' ? 'Bypass' : 'Voice + Compressor',
        icon: 'night',
      });
      return;
    }

    if (lower === 'g') {
      e.preventDefault();
      const nextGuard: FlashGuardMode = flashGuardMode === 'off' ? 'comfort' : 'off';
      onChangeFlashGuardMode?.(nextGuard);
      showShortcutHint({
        keyLabel: 'G',
        actionLabel: nextGuard === 'off' ? 'Flash Guard Off' : 'Flash Guard On',
        detail: nextGuard === 'off' ? 'Unfiltered' : 'Strobe & Glare Safe',
        icon: 'guard',
      });
      return;
    }

    if (rawKey === 'ArrowLeft' || lower === 'j') {
      showShortcutHint({
        keyLabel: rawKey === 'ArrowLeft' ? '←' : 'J',
        actionLabel: 'Seek -10s',
        detail: formatTimecode(Math.max(0, currentTime - 10)),
        icon: 'seek-back',
      });
      return;
    }

    if (rawKey === 'ArrowRight' || lower === 'l') {
      showShortcutHint({
        keyLabel: rawKey === 'ArrowRight' ? '→' : 'L',
        actionLabel: 'Seek +10s',
        detail: formatTimecode(duration > 0 ? Math.min(duration, currentTime + 10) : currentTime + 10),
        icon: 'seek-fwd',
      });
      return;
    }

    if (rawKey === 'ArrowUp') {
      const nextVol = Math.min(100, volumePct + 10);
      showShortcutHint({
        keyLabel: '↑',
        actionLabel: 'Volume Up',
        detail: `${nextVol}%`,
        icon: 'vol-up',
      });
      return;
    }

    if (rawKey === 'ArrowDown') {
      const nextVol = Math.max(0, volumePct - 10);
      showShortcutHint({
        keyLabel: '↓',
        actionLabel: 'Volume Down',
        detail: `${nextVol}%`,
        icon: 'vol-down',
      });
      return;
    }

    if (/^[0-9]$/.test(rawKey)) {
      const pct = Number(rawKey) * 10;
      showShortcutHint({
        keyLabel: rawKey,
        actionLabel: `Jump to ${pct}%`,
        detail: duration > 0 ? formatTimecode((duration * pct) / 100) : undefined,
        icon: 'jump',
      });
      return;
    }

    if (rawKey === 'Home' || rawKey === 'End') {
      showShortcutHint({
        keyLabel: rawKey.toUpperCase(),
        actionLabel: rawKey === 'Home' ? 'Jump to Start' : 'Jump to End',
        detail: rawKey === 'Home' ? '00:00' : formatTimecode(duration),
        icon: 'jump',
      });
    }
  };

  const formatShortcutUpper = (k: string) =>
    k === ' ' ? 'SPACE' : k.toUpperCase();

  return (
    <Container
      className={`cadence-skin ${className}`}
      style={skinStyle}
      data-pulse-theme={theme}
      data-theme-mode={isLightUi ? 'light' : isWhiteTone ? 'contrast' : 'adaptive'}
      data-backdrop={backdropMode}
      data-high-contrast={accessibility.highContrast ? 'true' : undefined}
      data-reduced-motion={accessibility.reducedMotion ? 'true' : undefined}
      data-reduced-transparency={accessibility.reducedTransparency ? 'true' : undefined}
      data-dyslexic={accessibility.dyslexicFont ? 'true' : undefined}
      data-large-text={accessibility.largeText ? 'true' : undefined}
      data-force-controls={forceControlsVisible ? 'true' : undefined}
      aria-label={`Video player: ${title}`}
      onKeyDownCapture={handleContainerKeyDownCapture}
    >
      {/* Underlying Video.js Media Element */}
      {children}

      {/* Poster Layer */}
      {poster && (
        <Poster.Root className="cadence-poster">
          <Poster.Image
            src={poster}
            alt={title}
            className="cadence-poster-img"
            referrerPolicy="no-referrer"
          />
        </Poster.Root>
      )}

      {/* Photosensitive Flash & Glare Protective Veil */}
      <div aria-hidden="true" className="cadence-flash-veil" />

      {/* Optional Worst-Case Luminance Test Backdrop (#FFF or #000) */}
      {backdropMode !== 'video' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-[8] ${
            backdropMode === 'white' ? 'bg-white' : 'bg-black'
          }`}
        />
      )}

      {/* Buffering Indicator */}
      <BufferingIndicator className="cadence-buffering">
        <div className="cadence-spinner" aria-hidden="true" />
      </BufferingIndicator>

      {/* Pulse Custom High-Contrast Subtitle Cue Stage */}
      {subtitlesActive && activeCueTexts.length > 0 && (
        <div
          className={`cadence-cue-stage ${
            subtitleStyle.position === 'top'
              ? 'cadence-cue-stage-top'
              : 'cadence-cue-stage-bottom'
          }`}
          aria-live="polite"
        >
          {activeCueTexts.map((line, i) => (
            <div
              key={`${i}-${line}`}
              onClick={subtitleStyle.pauseOnCueClick ? handleCueClick : undefined}
              title={subtitleStyle.pauseOnCueClick ? 'Click cue to pause / resume' : undefined}
              className={`cadence-cue-line cadence-cue-edge-${subtitleStyle.edgeStyle ?? 'box'} ${
                subtitleStyle.pauseOnCueClick ? 'cadence-cue-clickable' : ''
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Double-Tap Left / Right Edge Ripple Overlay */}
      {edgeRipple && (
        <div
          aria-hidden="true"
          className={`cadence-edge-ripple-zone ${
            edgeRipple.side === 'left'
              ? 'cadence-edge-ripple-left'
              : 'cadence-edge-ripple-right'
          }`}
        >
          <span
            key={edgeRipple.rippleKey}
            className="cadence-edge-ripple-wave"
            style={
              {
                '--ripple-x': `${edgeRipple.originX}%`,
                '--ripple-y': `${edgeRipple.originY}%`,
              } as CSSProperties
            }
          />
          <div className="cadence-edge-ripple-content">
            <div className="cadence-edge-chevrons">
              {edgeRipple.side === 'left' ? (
                <>
                  <ChevronLeft className="w-5 h-5 cadence-chevron cadence-chevron-3" />
                  <ChevronLeft className="w-5 h-5 cadence-chevron cadence-chevron-2" />
                  <ChevronLeft className="w-5 h-5 cadence-chevron cadence-chevron-1" />
                </>
              ) : (
                <>
                  <ChevronRight className="w-5 h-5 cadence-chevron cadence-chevron-1" />
                  <ChevronRight className="w-5 h-5 cadence-chevron cadence-chevron-2" />
                  <ChevronRight className="w-5 h-5 cadence-chevron cadence-chevron-3" />
                </>
              )}
            </div>
            <span className="cadence-edge-ripple-label">
              {edgeRipple.side === 'left'
                ? `-${edgeRipple.seconds}s`
                : `+${edgeRipple.seconds}s`}
            </span>
          </div>
        </div>
      )}

      {/* Mobile Swipe-Vertical Brightness / Volume Feedback HUD */}
      {swipeHud && (
        <div
          aria-hidden="true"
          className="cadence-swipe-hud"
        >
          <div className="cadence-swipe-hud-icon">
            {swipeHud.type === 'brightness' ? (
              swipeHud.value <= 25 ? (
                <SunDim className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
              ) : swipeHud.value <= 65 ? (
                <SunMedium className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
              ) : (
                <Sun className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
              )
            ) : swipeHud.value === 0 ? (
              <VolumeX className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
            ) : swipeHud.value <= 45 ? (
              <Volume1 className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
            ) : (
              <Volume2 className="w-5 h-5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} />
            )}
          </div>
          <div className="cadence-swipe-hud-meta">
            <span className="cadence-swipe-hud-title">
              {swipeHud.type === 'brightness' ? 'Brightness' : 'Volume'}
            </span>
            <div className="cadence-swipe-hud-track">
              <div
                className="cadence-swipe-hud-fill"
                style={{ width: `${swipeHud.value}%` }}
              />
            </div>
          </div>
          <span className="cadence-swipe-hud-pct">{swipeHud.value}%</span>
        </div>
      )}

      {/* Seek & Status Toast Indicators */}
      <div className="cadence-indicator-group">
        {!edgeRipple && (
          <SeekIndicator.Root className="cadence-toast-indicator cadence-seek-indicator">
            <RotateCcw
              className="cadence-seek-back-icon w-4 h-4"
              style={{ color: activeAccent }}
              aria-hidden="true"
            />
            <RotateCw
              className="cadence-seek-fwd-icon w-4 h-4"
              style={{ color: activeAccent }}
              aria-hidden="true"
            />
            <SeekIndicator.Value />
          </SeekIndicator.Root>
        )}

        <StatusIndicator.Root className="cadence-toast-indicator cadence-status-indicator">
          <StatusIndicator.Value />
        </StatusIndicator.Root>

        {!swipeHud && (
          <VolumeIndicator.Root className="cadence-toast-indicator cadence-status-indicator">
            <VolumeIndicator.Fill className="inline-flex items-center gap-2">
              <Volume2 className="w-4 h-4" style={{ color: activeAccent }} aria-hidden="true" />
              <VolumeIndicator.Value />
            </VolumeIndicator.Fill>
          </VolumeIndicator.Root>
        )}
      </div>

      {/* Floating Keyboard Shortcut Hint Tooltip near HUD Dock */}
      {shortcutHint && (
        <div
          key={shortcutHint.id}
          aria-hidden="true"
          className="cadence-kbd-hint-wrap"
        >
          <div className="cadence-kbd-hint">
            <kbd className="cadence-kbd-keycap">{shortcutHint.keyLabel}</kbd>
            <span className="inline-flex items-center gap-1.5">
              {shortcutHint.icon === 'play' && (
                <Play className="w-3.5 h-3.5 fill-current" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'pause' && (
                <Pause className="w-3.5 h-3.5 fill-current" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'mute' && (
                <VolumeX className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'unmute' && (
                <Volume2 className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'vol-up' && (
                <Volume2 className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'vol-down' && (
                <Volume1 className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'seek-back' && (
                <RotateCcw className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'seek-fwd' && (
                <RotateCw className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'fullscreen' && (
                <Maximize2 className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'captions' && (
                <Captions className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'pip' && (
                <PictureInPicture2 className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'bookmark' && (
                <BookmarkPlus className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'jump' && (
                <FastForward className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'night' && (
                <Moon className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              {shortcutHint.icon === 'guard' && (
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: activeAccent }} />
              )}
              <span>{shortcutHint.actionLabel}</span>
            </span>
            {shortcutHint.detail && (
              <span className="cadence-kbd-detail">{shortcutHint.detail}</span>
            )}
          </div>
          <div className="cadence-kbd-caret" />
        </div>
      )}

      {/* Screen Reader Status Announcer */}
      <StatusAnnouncer className="cadence-sr-only" />

      {/* Controls Overlay */}
      <Controls.Root>
        <Controls.Backdrop className="cadence-backdrop" />

        <Controls.Content className="cadence-controls-root">
          <Tooltip.Provider delay={200}>
            {/* Top Bar: Video Title (Left) + Real-Time Status Bar (Right) */}
            <div className="cadence-top-bar">
              <div className="cadence-telemetry-pill">
                <span className="cadence-telemetry-title">{title}</span>
              </div>

              {(showSignalBattery || showTime) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Pill 1: Live Network Signal & Device Battery Percentage */}
                  {showSignalBattery && (
                    <div
                      className="cadence-status-bar"
                      aria-label={`${deviceStatus.signalLabel}${deviceStatus.battery ? `, Battery ${deviceStatus.battery.levelPct}%${deviceStatus.battery.charging ? ' charging' : ''}` : ''}`}
                    >
                      {/* Live Network Signal Bars */}
                      <span
                        className="inline-flex items-end gap-[2px] h-3"
                        title={deviceStatus.signalLabel}
                      >
                        {signalBars.map((lit, i) => (
                          <span
                            key={i}
                            className="w-[2.5px] rounded-[1px]"
                            style={{
                              height: `${4 + i * 2.5}px`,
                              backgroundColor: !deviceStatus.online
                                ? 'rgba(239,68,68,0.45)'
                                : lit
                                  ? activeAccent
                                  : 'rgba(255,255,255,0.22)',
                            }}
                          />
                        ))}
                      </span>

                      {/* Real Device Battery Level (via Battery Status API) */}
                      {deviceStatus.battery && (
                        <span
                          className="inline-flex items-center gap-1"
                          title={`Battery: ${deviceStatus.battery.levelPct}%${deviceStatus.battery.charging ? ' (Charging)' : ''}`}
                        >
                          <span className="inline-flex items-center">
                            <span className="w-[18px] h-2.5 rounded-[2px] border border-white/50 p-[1px] inline-flex items-center">
                              <span
                                className="h-full rounded-[1px] transition-all duration-300"
                                style={{
                                  width: `${deviceStatus.battery.levelPct}%`,
                                  backgroundColor:
                                    deviceStatus.battery.charging ||
                                    deviceStatus.battery.levelPct > 35
                                      ? '#10B981'
                                      : deviceStatus.battery.levelPct > 20
                                        ? '#F59E0B'
                                        : '#EF4444',
                                }}
                              />
                            </span>
                            <span className="w-[1.5px] h-1 rounded-r-[1px] bg-white/55" />
                          </span>
                          {deviceStatus.battery.charging && (
                            <Zap
                              className="w-2.5 h-2.5 text-emerald-400 fill-current"
                              aria-hidden="true"
                            />
                          )}
                          <span>{deviceStatus.battery.levelPct}%</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pill 2: Live Time */}
                  {showTime && (
                    <div
                      className="cadence-status-bar"
                      aria-label={`Current time ${clockLabel}`}
                    >
                      <span>{clockLabel}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Center Reverse / Play / Forward Hero Triggers when paused */}
            <div className="cadence-center-stage">
              <SeekButton
                seconds={-10}
                render={(props) => (
                  <button
                    {...props}
                    className="cadence-center-seek"
                    aria-label="Reverse 10 seconds"
                  >
                    <Rewind className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                )}
              />

              <PlayButton
                render={(props, state) => (
                  <button
                    {...props}
                    className="cadence-center-play"
                    aria-label={
                      state.ended ? 'Replay video' : state.paused ? 'Play video' : 'Pause video'
                    }
                  >
                    {state.ended ? (
                      <RotateCcw className="w-6 h-6" style={{ color: activeAccent }} aria-hidden="true" />
                    ) : state.paused ? (
                      <Play className="w-6 h-6 fill-current ml-0.5" aria-hidden="true" />
                    ) : (
                      <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
                    )}
                  </button>
                )}
              />

              <SeekButton
                seconds={10}
                render={(props) => (
                  <button
                    {...props}
                    className="cadence-center-seek"
                    aria-label="Forward 10 seconds"
                  >
                    <FastForward className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                )}
              />
            </div>

            {/* Contextual Floating Actions (Skip Intro / Resume / Next Up / Bookmark Feedback) */}
            <div className="cadence-floating-actions relative z-[3] px-4 pb-2 flex flex-wrap items-center justify-end gap-2 pointer-events-none">
              {bookmarkFeedback && (
                <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[#0C0E12]/90 border border-white/20 px-3 py-1.5 text-xs font-mono-tabular text-emerald-300 shadow-lg">
                  <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{bookmarkFeedback}</span>
                </div>
              )}

              {showResumePrompt && resumeTime !== null && (
                <button
                  type="button"
                  onClick={() => onJumpToTime(resumeTime)}
                  className="cadence-pill-border pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[#0C0E12]/80 hover:bg-[#14171F]/90 px-3 py-2 text-xs font-medium text-white shadow-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" style={{ color: activeAccent }} aria-hidden="true" />
                  <span className="font-mono-tabular">
                    Resume {formatTimecode(resumeTime)}
                  </span>
                </button>
              )}

              {showSkipIntro && introWindow && (
                <button
                  type="button"
                  onClick={() => onJumpToTime(introWindow[1] + 0.4)}
                  className="cadence-pill-border pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[#0C0E12]/80 hover:bg-[#14171F]/90 px-3.5 py-2 text-xs font-semibold text-white shadow-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00]"
                >
                  <span>Skip Intro</span>
                  <FastForward className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
                </button>
              )}

              {showNextUp && (
                <button
                  type="button"
                  onClick={onNextReel}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg hover:opacity-95 px-3.5 py-2 text-xs font-semibold shadow-lg transition-transform active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
                  style={{
                    backgroundColor: 'var(--pulse-menu-pill-bg, #FF6B00)',
                    color: 'var(--pulse-menu-pill-fg, #09090b)',
                  }}
                >
                  <span>Next in Queue</span>
                  <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Bottom Floating Obsidian Glass HUD Dock */}
            <div className="cadence-bottom-wrap">
              <div className="cadence-dock">
                {/* Playback Metadata Row (only shown when speed, quality, night mode, flash guard, or bookmarks are active) */}
                {(playbackRate !== 1 ||
                  nightAudioMode !== 'off' ||
                  flashGuardMode !== 'off' ||
                  selectedQuality !== 'Auto' ||
                  bookmarks.length > 0) && (
                  <div className="cadence-dock-meta min-w-0 px-0.5 text-[11px] font-mono-tabular">
                    {playbackRate !== 1 && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                        style={{
                          backgroundColor: hexToGlowRgba(activeAccent, 0.2),
                          color: isLightUi ? '#09090b' : activeAccent,
                        }}
                      >
                        {playbackRate}x SPEED
                      </span>
                    )}
                    {nightAudioMode !== 'off' && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0"
                        style={{
                          backgroundColor: isLightUi
                            ? 'rgba(255, 255, 255, 0.9)'
                            : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.16)',
                          borderColor: isLightUi
                            ? 'rgba(9, 9, 11, 0.45)'
                            : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.5)',
                          color: isLightUi ? '#09090b' : '#ffffff',
                        }}
                      >
                        <Moon
                          className="w-2.5 h-2.5"
                          style={{ color: isLightUi ? '#09090b' : 'var(--pulse-menu-accent, rgb(var(--pulse-video-rgb, 255, 107, 0)))' }}
                          aria-hidden="true"
                        />
                        <span>
                          {nightAudioMode === 'whisper' ? 'WHISPER COMPRESSOR' : 'VOICE ISOLATED'}
                        </span>
                        {nightCompressionDb < 0 && (
                          <span className={isLightUi ? 'text-emerald-700' : 'text-emerald-300'}>
                            {nightCompressionDb.toFixed(1)}dB
                          </span>
                        )}
                      </span>
                    )}
                    {flashGuardMode !== 'off' && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0"
                        style={{
                          backgroundColor: flashGuard?.activeAlert
                            ? 'rgba(16, 185, 129, 0.22)'
                            : isLightUi
                              ? 'rgba(255, 255, 255, 0.9)'
                              : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.14)',
                          borderColor: flashGuard?.activeAlert
                            ? 'rgba(16, 185, 129, 0.65)'
                            : isLightUi
                              ? 'rgba(9, 9, 11, 0.45)'
                              : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.45)',
                          color: isLightUi ? '#09090b' : '#ffffff',
                        }}
                      >
                        <ShieldCheck
                          className={`w-2.5 h-2.5 ${
                            flashGuard?.activeAlert
                              ? isLightUi
                                ? 'text-emerald-700'
                                : 'text-emerald-300'
                              : ''
                          }`}
                          style={
                            flashGuard?.activeAlert
                              ? undefined
                              : { color: isLightUi ? '#09090b' : 'var(--pulse-menu-accent, rgb(var(--pulse-video-rgb, 255, 107, 0)))' }
                          }
                          aria-hidden="true"
                        />
                        <span>
                          {flashGuardMode === 'strict' ? 'FLASH GUARD · STRICT' : 'FLASH GUARD'}
                        </span>
                        {flashGuard && flashGuard.attenuationPct > 0 ? (
                          <span className={isLightUi ? 'text-emerald-700' : 'text-emerald-300'}>
                            -{flashGuard.attenuationPct}%
                          </span>
                        ) : flashGuard && flashGuard.dampenedCount > 0 ? (
                          <span className="opacity-75">
                            {flashGuard.dampenedCount} damped
                          </span>
                        ) : null}
                      </span>
                    )}
                    {selectedQuality !== 'Auto' && (
                      <span className="opacity-85 font-semibold">{selectedQuality}</span>
                    )}
                    {bookmarks.length > 0 && (
                      <span className="opacity-70 hidden md:inline">
                        {bookmarks.length} {bookmarks.length === 1 ? 'pin' : 'pins'}
                      </span>
                    )}
                  </div>
                )}

                {/* Controls Action Row (Menu Bar) */}
                <div className="cadence-controls-row">
                  {/* Left Group: Queue, Reverse, Play/Pause, Forward, Volume, Time */}
                  <div className="cadence-controls-group">
                    <ControlTooltip label="Previous Reel">
                      <button
                        type="button"
                        onClick={onPrevReel}
                        aria-label="Previous video in queue"
                        className="cadence-btn cadence-hide-md"
                      >
                        <SkipBack className="w-[16px] h-[16px]" strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </ControlTooltip>

                    <ControlTooltip label="Reverse 10s" shortcut="J">
                      <SeekButton
                        seconds={-10}
                        render={(props) => (
                          <button
                            {...props}
                            className="cadence-btn cadence-hide-xs"
                            aria-label="Reverse 10 seconds"
                          >
                            <Rewind className="w-[17px] h-[17px]" strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                      />
                    </ControlTooltip>

                    <ControlTooltip
                      label="Play / Pause"
                      shortcut={formatShortcutUpper(keymap.playPause)}
                    >
                      <PlayButton
                        render={(props, state) => (
                          <button
                            {...props}
                            className={`cadence-btn cadence-btn-primary ${
                              !state.paused && !state.ended ? 'cadence-play-glow' : ''
                            } ${!state.paused && playbackRate !== 1 ? 'cadence-speed-pulse' : ''}`}
                          >
                            {state.ended ? (
                              <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2.2} aria-hidden="true" />
                            ) : state.paused ? (
                              <Play className="w-[18px] h-[18px] fill-current ml-0.5" aria-hidden="true" />
                            ) : (
                              <Pause className="w-[18px] h-[18px] fill-current" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      />
                    </ControlTooltip>

                    <ControlTooltip label="Forward 10s" shortcut="L">
                      <SeekButton
                        seconds={10}
                        render={(props) => (
                          <button
                            {...props}
                            className="cadence-btn cadence-hide-xs"
                            aria-label="Forward 10 seconds"
                          >
                            <FastForward className="w-[17px] h-[17px]" strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                      />
                    </ControlTooltip>

                    <ControlTooltip label="Next Reel">
                      <button
                        type="button"
                        onClick={onNextReel}
                        aria-label="Next video in queue"
                        className="cadence-btn cadence-hide-md"
                      >
                        <SkipForward className="w-[16px] h-[16px]" strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </ControlTooltip>

                    <span className="cadence-divider cadence-hide-compact" aria-hidden="true" />

                    {/* Mute Toggle + Inline Horizontal Volume Slider (Desktop/Tablet) & Touch Popover */}
                    <div className="cadence-volume-unit">
                      <VolumePopover.Root openOnHover delay={150} closeDelay={150} side="top">
                        <VolumePopover.Trigger
                          render={
                            <MuteButton
                              render={(props, state) => (
                                <button
                                  {...props}
                                  className="cadence-btn"
                                  data-active={state.muted || state.volumeLevel === 'off' ? '' : undefined}
                                >
                                  {state.muted || state.volumeLevel === 'off' ? (
                                    <VolumeX
                                      className="w-[18px] h-[18px]"
                                      strokeWidth={2}
                                      aria-hidden="true"
                                    />
                                  ) : state.volumeLevel === 'low' ? (
                                    <Volume1 className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                                  ) : (
                                    <Volume2 className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                                  )}
                                </button>
                              )}
                            />
                          }
                        />
                        <VolumePopover.Popup className="cadence-volume-popup">
                          <VolumeSlider.Root
                            className="cadence-volume-slider"
                            orientation="vertical"
                            thumbAlignment="edge"
                          >
                            <VolumeSlider.Track className="cadence-volume-track">
                              <VolumeSlider.Fill className="cadence-volume-fill" />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className="cadence-volume-thumb" />
                          </VolumeSlider.Root>
                        </VolumePopover.Popup>
                      </VolumePopover.Root>

                      <VolumeSlider.Root
                        className="cadence-volume-inline cadence-hide-compact"
                        orientation="horizontal"
                        thumbAlignment="edge"
                        aria-label="Volume"
                      >
                        <VolumeSlider.Track className="cadence-volume-inline-track">
                          <VolumeSlider.Fill className="cadence-volume-inline-fill" />
                        </VolumeSlider.Track>
                        <VolumeSlider.Thumb className="cadence-volume-inline-thumb" />
                      </VolumeSlider.Root>
                    </div>
                  </div>

                  {/* Right Group: Flash Guard, Night Mode, Captions, Settings Menu, PiP, Fullscreen */}
                  <div className="cadence-controls-group">
                    <ControlTooltip
                      label={
                        flashGuardMode === 'off'
                          ? 'Photosensitive Flash Guard'
                          : flashGuardMode === 'strict'
                            ? 'Flash Guard (Strict 3Hz)'
                            : 'Flash Guard Active'
                      }
                      shortcut="G"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFlashGuardMode?.(
                            flashGuardMode === 'off' ? 'comfort' : 'off'
                          )
                        }
                        className="cadence-btn cadence-hide-md"
                        data-active={flashGuardMode !== 'off' ? '' : undefined}
                        aria-pressed={flashGuardMode !== 'off'}
                        aria-label={
                          flashGuardMode === 'off'
                            ? 'Enable Photosensitive Flash Guard'
                            : 'Disable Photosensitive Flash Guard'
                        }
                      >
                        {flashGuardMode !== 'off' ? (
                          <ShieldCheck className="w-[17px] h-[17px]" aria-hidden="true" />
                        ) : (
                          <Shield className="w-[17px] h-[17px]" aria-hidden="true" />
                        )}
                      </button>
                    </ControlTooltip>

                    <ControlTooltip
                      label={
                        nightAudioMode === 'off'
                          ? 'Voice-Isolated Night Mode'
                          : nightAudioMode === 'whisper'
                            ? 'Whisper Compressor Active'
                            : 'Voice Isolation Active'
                      }
                      shortcut="N"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onChangeNightAudioMode?.(
                            nightAudioMode === 'off' ? 'whisper' : 'off'
                          )
                        }
                        className="cadence-btn cadence-hide-md"
                        data-active={nightAudioMode !== 'off' ? '' : undefined}
                        aria-pressed={nightAudioMode !== 'off'}
                        aria-label={
                          nightAudioMode === 'off'
                            ? 'Enable Voice-Isolated Night Mode'
                            : 'Disable Voice-Isolated Night Mode'
                        }
                      >
                        <Moon className="w-[17px] h-[17px]" aria-hidden="true" />
                      </button>
                    </ControlTooltip>

                    {/* Subtitles & Captions Studio Button + Extra Functions Popover */}
                    <Popover.Root
                      open={subtitlesOpen}
                      onOpenChange={setSubtitlesOpen}
                      side="top"
                      align="end"
                    >
                      <ControlTooltip
                        label={subtitlesActive ? 'Subtitles On · Studio' : 'Subtitles & Studio'}
                        shortcut={formatShortcutUpper(keymap.captions)}
                      >
                        <Popover.Trigger
                          render={
                            <button
                              type="button"
                              className="cadence-btn"
                              data-active={subtitlesActive || subtitlesOpen ? '' : undefined}
                              aria-pressed={subtitlesActive}
                              aria-expanded={subtitlesOpen}
                              aria-label="Subtitles and caption studio"
                            >
                              {subtitlesActive ? (
                                <Captions className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                              ) : (
                                <CaptionsOff className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                              )}
                              {subtitlesActive && (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]"
                                />
                              )}
                            </button>
                          }
                        />
                      </ControlTooltip>

                      <Popover.Popup className="cadence-subtitles-popup">
                        <div className="cadence-subtitles-panel">
                          {/* Studio Header + One-Click Master Toggle */}
                          <div className="flex items-center justify-between gap-2 pb-2.5 cadence-sub-divider-b">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                <Captions
                                  className="w-3.5 h-3.5 shrink-0"
                                  style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }}
                                  aria-hidden="true"
                                />
                                <span>Subtitles Studio</span>
                              </div>
                              <p className="text-[10.5px] opacity-75 truncate mt-0.5 font-mono-tabular">
                                {subtitlesActive
                                  ? `${activeSubtitleTrack?.label}${subtitleStyle.syncOffsetSec !== 0 ? ` · ${subtitleStyle.syncOffsetSec > 0 ? '+' : ''}${subtitleStyle.syncOffsetSec.toFixed(2)}s` : ''}`
                                  : 'Off · Press C to toggle'}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleToggleSubtitlesMaster}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer shrink-0"
                              style={{
                                backgroundColor: subtitlesActive
                                  ? 'var(--pulse-menu-pill-bg, #FF6B00)'
                                  : 'rgba(128, 128, 128, 0.16)',
                                borderColor: subtitlesActive
                                  ? 'var(--pulse-menu-pill-bg, #FF6B00)'
                                  : 'rgba(128, 128, 128, 0.35)',
                                color: subtitlesActive
                                  ? 'var(--pulse-menu-pill-fg, #09090b)'
                                  : 'inherit',
                              }}
                            >
                              {subtitlesActive ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          {/* Mode Tabs: Controls vs Live Transcript */}
                          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl cadence-sub-well my-2.5">
                            <button
                              type="button"
                              onClick={() => setSubtitlesTab('controls')}
                              className={`py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                subtitlesTab === 'controls'
                                  ? 'cadence-sub-tab-active shadow-sm'
                                  : 'opacity-80 hover:opacity-100'
                              }`}
                            >
                              Track &amp; Style
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubtitlesTab('transcript')}
                              className={`inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                subtitlesTab === 'transcript'
                                  ? 'cadence-sub-tab-active shadow-sm'
                                  : 'opacity-80 hover:opacity-100'
                              }`}
                            >
                              <FileText className="w-3 h-3" aria-hidden="true" />
                              <span>Transcript ({activeTrackCues.length})</span>
                            </button>
                          </div>

                          {subtitlesTab === 'controls' ? (
                            <div className="space-y-3 text-[11px]">
                              {/* Language / Track Selector */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium opacity-80">Subtitle Track</span>
                                  <button
                                    type="button"
                                    onClick={() => subtitleFileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md cadence-sub-btn text-[10.5px] font-semibold cursor-pointer"
                                  >
                                    <Upload className="w-3 h-3" aria-hidden="true" />
                                    <span>{subtitleUploadMsg ?? 'Load .vtt/.srt'}</span>
                                  </button>
                                  <input
                                    ref={subtitleFileInputRef}
                                    type="file"
                                    accept=".vtt,.srt,text/vtt"
                                    onChange={handleSubtitleFileUpload}
                                    className="hidden"
                                  />
                                </div>

                                <div className="grid grid-cols-1 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setSubtitleTrackMode(null)}
                                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                                        !subtitlesActive
                                          ? 'cadence-sub-track-active font-semibold'
                                          : 'cadence-sub-track-idle opacity-80'
                                      }`}
                                    >
                                      <span>Off (Disabled)</span>
                                      {!subtitlesActive && (
                                        <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                      )}
                                    </button>
                                    {discoveredTracks.map((tr) => {
                                      const selected = tr.mode === 'showing';
                                      return (
                                        <button
                                          key={`${tr.index}-${tr.label}`}
                                          type="button"
                                          onClick={() => setSubtitleTrackMode(tr.index)}
                                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors ${
                                            selected
                                              ? 'cadence-sub-track-active font-semibold'
                                              : 'cadence-sub-track-idle opacity-85'
                                          }`}
                                        >
                                          <span className="truncate">{tr.label}</span>
                                          {selected && (
                                            <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                          )}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>

                              {/* Timing Sync Offset (-2.0s to +2.0s) */}
                              <div className="pt-2 cadence-sub-divider-t flex items-center justify-between gap-2">
                                <div>
                                  <span className="block font-medium">Timing Sync</span>
                                  <span className="text-[10px] opacity-70">Nudge early / late</span>
                                </div>
                                <div className="inline-flex items-center gap-1 rounded-lg cadence-sub-well p-0.5 font-mono-tabular">
                                  <button
                                    type="button"
                                    aria-label="Delay subtitles by 0.25 seconds"
                                    onClick={() =>
                                      onUpdateSubtitleStyle?.({
                                        syncOffsetSec: Math.max(
                                          -2,
                                          Math.round(((subtitleStyle.syncOffsetSec ?? 0) - 0.25) * 100) / 100
                                        ),
                                      })
                                    }
                                    className="p-1 rounded cadence-sub-icon-btn cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Click to reset sync offset to 0.00s"
                                    onClick={() => onUpdateSubtitleStyle?.({ syncOffsetSec: 0 })}
                                    className="px-1.5 text-[10.5px] font-semibold min-w-[48px] text-center cursor-pointer"
                                  >
                                    {(subtitleStyle.syncOffsetSec ?? 0) > 0 ? '+' : ''}
                                    {(subtitleStyle.syncOffsetSec ?? 0).toFixed(2)}s
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Advance subtitles by 0.25 seconds"
                                    onClick={() =>
                                      onUpdateSubtitleStyle?.({
                                        syncOffsetSec: Math.min(
                                          2,
                                          Math.round(((subtitleStyle.syncOffsetSec ?? 0) + 0.25) * 100) / 100
                                        ),
                                      })
                                    }
                                    className="p-1 rounded cadence-sub-icon-btn cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              {/* Position (Bottom / Top) & Font Size */}
                              <div className="grid grid-cols-2 gap-2 pt-2 cadence-sub-divider-t">
                                <div>
                                  <span className="block opacity-75 mb-1">Position</span>
                                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg cadence-sub-well">
                                    <button
                                      type="button"
                                      onClick={() => onUpdateSubtitleStyle?.({ position: 'bottom' })}
                                      className={`inline-flex items-center justify-center gap-1 py-1 rounded text-[10.5px] font-medium cursor-pointer ${
                                        (subtitleStyle.position ?? 'bottom') === 'bottom'
                                          ? 'cadence-sub-tab-active font-semibold shadow-xs'
                                          : 'opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      <ArrowDownToLine className="w-3 h-3" aria-hidden="true" />
                                      <span>Bottom</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onUpdateSubtitleStyle?.({ position: 'top' })}
                                      className={`inline-flex items-center justify-center gap-1 py-1 rounded text-[10.5px] font-medium cursor-pointer ${
                                        subtitleStyle.position === 'top'
                                          ? 'cadence-sub-tab-active font-semibold shadow-xs'
                                          : 'opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      <ArrowUpToLine className="w-3 h-3" aria-hidden="true" />
                                      <span>Top</span>
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <span className="block opacity-75 mb-1">Size</span>
                                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg cadence-sub-well">
                                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                                      <button
                                        key={sz}
                                        type="button"
                                        onClick={() => onUpdateSubtitleStyle?.({ fontSize: sz })}
                                        className={`py-1 rounded text-[10.5px] font-mono-tabular uppercase cursor-pointer ${
                                          subtitleStyle.fontSize === sz
                                            ? 'cadence-sub-tab-active font-semibold shadow-xs'
                                            : 'opacity-80 hover:opacity-100'
                                        }`}
                                      >
                                        {sz}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Edge Style */}
                              <div>
                                <span className="block opacity-75 mb-1">Edge Style</span>
                                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg cadence-sub-well">
                                  {(
                                    [
                                      { id: 'box', label: 'Box' },
                                      { id: 'outline', label: 'Outline' },
                                      { id: 'shadow', label: 'Shadow' },
                                      { id: 'clean', label: 'Clean' },
                                    ] as { id: SubtitleEdgeStyle; label: string }[]
                                  ).map((edge) => (
                                    <button
                                      key={edge.id}
                                      type="button"
                                      onClick={() => onUpdateSubtitleStyle?.({ edgeStyle: edge.id })}
                                      className={`py-1 rounded text-[10.5px] font-medium cursor-pointer ${
                                        (subtitleStyle.edgeStyle ?? 'box') === edge.id
                                          ? 'cadence-sub-tab-active font-semibold shadow-xs'
                                          : 'opacity-80 hover:opacity-100'
                                      }`}
                                    >
                                      {edge.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Color & Background Opacity */}
                              <div className="grid grid-cols-2 gap-2 items-center">
                                <div>
                                  <span className="block opacity-75 mb-1">Text Color</span>
                                  <div className="flex items-center gap-1.5">
                                    {(['#F8FAFC', '#FDE047', '#10F56E'] as const).map((c) => (
                                      <button
                                        key={c}
                                        type="button"
                                        aria-label={`Subtitle text color ${c}`}
                                        onClick={() => onUpdateSubtitleStyle?.({ color: c })}
                                        className={`w-6 h-6 rounded-md border cursor-pointer ${
                                          subtitleStyle.color === c
                                            ? 'border-zinc-950 ring-2 ring-current'
                                            : 'border-black/30 opacity-85'
                                        }`}
                                        style={{ backgroundColor: c }}
                                      />
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label
                                    htmlFor="hud-cue-opacity"
                                    className="flex items-center justify-between opacity-75 mb-1"
                                  >
                                    <span>Bg Opacity</span>
                                    <span className="font-mono-tabular">
                                      {Math.round(subtitleStyle.bgOpacity * 100)}%
                                    </span>
                                  </label>
                                  <input
                                    id="hud-cue-opacity"
                                    type="range"
                                    min={0.3}
                                    max={1}
                                    step={0.05}
                                    value={subtitleStyle.bgOpacity}
                                    onChange={(e) =>
                                      onUpdateSubtitleStyle?.({
                                        bgOpacity: parseFloat(e.target.value),
                                      })
                                    }
                                    style={{ accentColor: 'var(--pulse-menu-accent, #FF6B00)' }}
                                    className="w-full cursor-pointer"
                                  />
                                </div>
                              </div>

                              {/* Click Cue to Pause + Reset */}
                              <div className="pt-2 cadence-sub-divider-t flex items-center justify-between gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(subtitleStyle.pauseOnCueClick)}
                                    onChange={(e) =>
                                      onUpdateSubtitleStyle?.({
                                        pauseOnCueClick: e.target.checked,
                                      })
                                    }
                                    style={{ accentColor: 'var(--pulse-menu-accent, #FF6B00)' }}
                                    className="rounded cursor-pointer"
                                  />
                                  <span>Click cue to pause</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => onUpdateSubtitleStyle?.(DEFAULT_SUBTITLE_STYLE)}
                                  className="text-[10.5px] opacity-75 hover:opacity-100 underline cursor-pointer"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Tab 2: Interactive Timestamped Live Transcript */
                            <div className="space-y-2.5 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={handleCopyTranscript}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg cadence-sub-btn cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" aria-hidden="true" />
                                  <span>{transcriptCopied ? 'Copied!' : 'Copy All'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDownloadVtt}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg cadence-sub-btn cursor-pointer"
                                >
                                  <Download className="w-3 h-3" aria-hidden="true" />
                                  <span>Export .vtt</span>
                                </button>
                              </div>

                              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {activeTrackCues.length === 0 ? (
                                  <p className="py-6 text-center opacity-65">
                                    No cues available for this track.
                                  </p>
                                ) : (
                                  activeTrackCues.map((cue, idx) => {
                                    const isCurrent =
                                      effectiveSubtitleTime >= cue.start &&
                                      effectiveSubtitleTime <= cue.end;
                                    return (
                                      <button
                                        key={`${idx}-${cue.start}`}
                                        type="button"
                                        onClick={() => {
                                          onJumpToTime(cue.start);
                                          if (!subtitlesActive && discoveredTracks.length > 0) {
                                            setSubtitleTrackMode(0);
                                          }
                                        }}
                                        className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                                          isCurrent
                                            ? 'cadence-sub-track-active font-semibold'
                                            : 'cadence-sub-track-idle opacity-85'
                                        }`}
                                      >
                                        <span
                                          className="font-mono-tabular text-[10px] shrink-0 pt-0.5"
                                          style={{ color: isCurrent ? 'var(--pulse-menu-accent, var(--pulse-accent))' : undefined }}
                                        >
                                          {formatTimecode(cue.start)}
                                        </span>
                                        <span className="leading-snug">{cue.text}</span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Popover.Popup>
                    </Popover.Root>

                    {/* Settings Menu: Speed, Quality/Resolution, Captions, Theme */}
                    <Menu.Root side="top" align="end">
                      <ControlTooltip label="Settings">
                        <Menu.Trigger
                          render={
                            <button type="button" className="cadence-btn" aria-label="Settings menu">
                              <SlidersHorizontal className="w-[17px] h-[17px]" aria-hidden="true" />
                            </button>
                          }
                        />
                      </ControlTooltip>
                      <Menu.Popup keepMounted className="cadence-menu-popup">
                        <Menu.Content className="cadence-menu-content">
                          {/* Playback Speed Submenu */}
                          <Menu.Root>
                            <PlaybackRateRadioGroup.Root>
                              <Menu.Trigger className="cadence-menu-item">
                                <span className="inline-flex items-center gap-2">
                                  <Gauge className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                                  <span>Speed</span>
                                </span>
                                <span className="cadence-menu-hint">
                                  <PlaybackRateRadioGroup.Value />
                                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                              </Menu.Trigger>
                              <Menu.Content className="cadence-menu-content">
                                <Menu.Item className="cadence-menu-back-item">
                                  <span className="inline-flex items-center gap-1.5 font-semibold">
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                    <span>Playback Speed</span>
                                  </span>
                                </Menu.Item>
                                <Menu.Separator className="cadence-menu-sep" />
                                <PlaybackRateRadioGroup.Options
                                  renderItem={(props, item) => (
                                    <Menu.RadioItem {...props} className="cadence-menu-radio-item">
                                      <span>{item.label}</span>
                                      <Menu.ItemIndicator>
                                        <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                      </Menu.ItemIndicator>
                                    </Menu.RadioItem>
                                  )}
                                />
                              </Menu.Content>
                            </PlaybackRateRadioGroup.Root>
                          </Menu.Root>

                          {/* Quality / Resolution Submenu */}
                          {hasHlsRenditions ? (
                            <Menu.Root>
                              <QualityRadioGroup.Root>
                                <Menu.Trigger className="cadence-menu-item">
                                  <span className="inline-flex items-center gap-2">
                                    <Tv className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                                    <span>Quality</span>
                                  </span>
                                  <span className="cadence-menu-hint">
                                    {selectedQuality !== 'Auto' ? (
                                      <span>{selectedQuality}</span>
                                    ) : (
                                      <QualityRadioGroup.Value />
                                    )}
                                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                  </span>
                                </Menu.Trigger>
                                <Menu.Content className="cadence-menu-content">
                                  <Menu.Item className="cadence-menu-back-item">
                                    <span className="inline-flex items-center gap-1.5 font-semibold">
                                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                      <span>Stream Quality</span>
                                    </span>
                                  </Menu.Item>
                                  <Menu.Separator className="cadence-menu-sep" />
                                  {extraHighResProfiles.map((profile) => {
                                    const isActiveProfile = selectedQuality === profile.label;
                                    return (
                                      <Menu.Item
                                        key={profile.label}
                                        className="cadence-menu-radio-item"
                                        aria-checked={isActiveProfile}
                                        onClick={() => handleSelectHighResProfile(profile.label)}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span>{profile.label}</span>
                                          <span
                                            className="px-1.5 py-0.5 rounded text-[9.5px] font-mono-tabular font-bold border border-current/25 opacity-85"
                                            style={
                                              isActiveProfile
                                                ? {
                                                    color: 'var(--pulse-menu-accent, var(--pulse-accent))',
                                                    borderColor: 'var(--pulse-menu-accent, var(--pulse-accent))',
                                                  }
                                                : undefined
                                            }
                                          >
                                            {profile.badge}
                                          </span>
                                        </span>
                                        {isActiveProfile && (
                                          <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                        )}
                                      </Menu.Item>
                                    );
                                  })}
                                  {extraHighResProfiles.length > 0 && (
                                    <Menu.Separator className="cadence-menu-sep" />
                                  )}
                                  <QualityRadioGroup.Options
                                    renderItem={(props, item) => (
                                      <Menu.RadioItem
                                        {...props}
                                        onClick={(e) => {
                                          onSelectQuality('Auto');
                                          props.onClick?.(e);
                                        }}
                                        className="cadence-menu-radio-item"
                                      >
                                        <span>{item.label}</span>
                                        <Menu.ItemIndicator>
                                          <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                        </Menu.ItemIndicator>
                                      </Menu.RadioItem>
                                    )}
                                  />
                                </Menu.Content>
                              </QualityRadioGroup.Root>
                            </Menu.Root>
                          ) : (
                            <Menu.Root>
                              <Menu.RadioGroup
                                value={selectedQuality}
                                onValueChange={onSelectQuality}
                              >
                                <Menu.Trigger className="cadence-menu-item">
                                  <span className="inline-flex items-center gap-2">
                                    <Tv className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                                    <span>Quality</span>
                                  </span>
                                  <span className="cadence-menu-hint">
                                    <span>{selectedQuality}</span>
                                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                  </span>
                                </Menu.Trigger>
                                <Menu.Content className="cadence-menu-content">
                                  <Menu.Item className="cadence-menu-back-item">
                                    <span className="inline-flex items-center gap-1.5 font-semibold">
                                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                      <span>Resolution</span>
                                    </span>
                                  </Menu.Item>
                                  <Menu.Separator className="cadence-menu-sep" />
                                  {QUALITY_TIERS.map((q) => {
                                    const badge =
                                      q === '4K (2160p)'
                                        ? 'UHD'
                                        : q === '1440p (2K)'
                                          ? 'QHD'
                                          : q === '1080p'
                                            ? 'FHD'
                                            : null;
                                    return (
                                      <Menu.RadioItem
                                        key={q}
                                        value={q}
                                        className="cadence-menu-radio-item"
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <span>{q}</span>
                                          {badge && (
                                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono-tabular font-bold border border-current/25 opacity-80">
                                              {badge}
                                            </span>
                                          )}
                                        </span>
                                        <Menu.ItemIndicator>
                                          <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                        </Menu.ItemIndicator>
                                      </Menu.RadioItem>
                                    );
                                  })}
                                </Menu.Content>
                              </Menu.RadioGroup>
                            </Menu.Root>
                          )}

                          {/* Captions Submenu */}
                          <Menu.Root>
                            <CaptionsRadioGroup.Root>
                              <Menu.Trigger className="cadence-menu-item">
                                <span className="inline-flex items-center gap-2">
                                  <Captions className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                                  <span>Captions</span>
                                </span>
                                <span className="cadence-menu-hint">
                                  <CaptionsRadioGroup.Value />
                                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                              </Menu.Trigger>
                              <Menu.Content className="cadence-menu-content">
                                <Menu.Item className="cadence-menu-back-item">
                                  <span className="inline-flex items-center gap-1.5 font-semibold">
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                    <span>Captions</span>
                                  </span>
                                </Menu.Item>
                                <Menu.Separator className="cadence-menu-sep" />
                                <CaptionsRadioGroup.Options
                                  renderItem={(props, item) => (
                                    <Menu.RadioItem {...props} className="cadence-menu-radio-item">
                                      <span>{item.label}</span>
                                      <Menu.ItemIndicator>
                                        <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                      </Menu.ItemIndicator>
                                    </Menu.RadioItem>
                                  )}
                                />
                              </Menu.Content>
                            </CaptionsRadioGroup.Root>
                          </Menu.Root>

                          {/* Theme Quick Switch Submenu */}
                          <Menu.Root>
                            <Menu.RadioGroup
                              value={theme}
                              onValueChange={(val) => onChangeTheme(val as PulseThemeId)}
                            >
                              <Menu.Trigger className="cadence-menu-item">
                                <span className="inline-flex items-center gap-2">
                                  <Palette className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                                  <span>Theme</span>
                                </span>
                                <span className="cadence-menu-hint">
                                  <span>{THEME_LABELS[theme]}</span>
                                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                              </Menu.Trigger>
                              <Menu.Content className="cadence-menu-content">
                                <Menu.Item className="cadence-menu-back-item">
                                  <span className="inline-flex items-center gap-1.5 font-semibold">
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                    <span>Skin Theme</span>
                                  </span>
                                </Menu.Item>
                                <Menu.Separator className="cadence-menu-sep" />
                                {(['amber', 'oscilloscope', 'light', 'custom'] as const).map((t) => (
                                  <Menu.RadioItem
                                    key={t}
                                    value={t}
                                    className="cadence-menu-radio-item"
                                  >
                                    <span>{THEME_LABELS[t]}</span>
                                    <Menu.ItemIndicator>
                                      <Check className="w-3.5 h-3.5" style={{ color: 'var(--pulse-menu-accent, var(--pulse-accent))' }} aria-hidden="true" />
                                    </Menu.ItemIndicator>
                                  </Menu.RadioItem>
                                ))}
                              </Menu.Content>
                            </Menu.RadioGroup>
                          </Menu.Root>

                          <Menu.Separator className="cadence-menu-sep" />

                          {/* Voice-Isolated Night Mode (Whisper Compressor) */}
                          <Menu.CheckboxItem
                            className="cadence-menu-item"
                            checked={nightAudioMode !== 'off'}
                            onCheckedChange={() =>
                              onChangeNightAudioMode?.(
                                nightAudioMode === 'off' ? 'whisper' : 'off'
                              )
                            }
                          >
                            <span className="inline-flex items-center gap-2">
                              <Moon className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Night Whisper</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor:
                                  nightAudioMode !== 'off'
                                    ? 'var(--pulse-switch-on-bg)'
                                    : 'var(--pulse-switch-off-bg)',
                                borderColor:
                                  nightAudioMode !== 'off'
                                    ? 'var(--pulse-switch-on-border)'
                                    : 'var(--pulse-switch-off-border)',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 ${
                                  nightAudioMode !== 'off' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                                style={{
                                  backgroundColor:
                                    nightAudioMode !== 'off'
                                      ? 'var(--pulse-switch-thumb, #ffffff)'
                                      : '#ffffff',
                                }}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          {nightAudioMode !== 'off' && (
                            <div
                              className="px-2 py-1.5 rounded-xl border space-y-2"
                              style={{
                                backgroundColor: isLightUi
                                  ? 'rgba(9, 9, 11, 0.05)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                borderColor: 'var(--pulse-menu-sep)',
                              }}
                            >
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeNightAudioMode?.('voice');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer"
                                  style={
                                    nightAudioMode === 'voice'
                                      ? {
                                          backgroundColor: 'var(--pulse-menu-pill-bg)',
                                          color: 'var(--pulse-menu-pill-fg)',
                                          border: '1px solid var(--pulse-menu-pill-bg)',
                                        }
                                      : {
                                          border: '1px solid transparent',
                                          opacity: 0.78,
                                        }
                                  }
                                >
                                  Voice Isolate
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeNightAudioMode?.('whisper');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer"
                                  style={
                                    nightAudioMode === 'whisper'
                                      ? {
                                          backgroundColor: 'var(--pulse-menu-pill-bg)',
                                          color: 'var(--pulse-menu-pill-fg)',
                                          border: '1px solid var(--pulse-menu-pill-bg)',
                                        }
                                      : {
                                          border: '1px solid transparent',
                                          opacity: 0.78,
                                        }
                                  }
                                >
                                  Whisper Max
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular opacity-85">
                                <span className="inline-flex items-center gap-1">
                                  <AudioLines
                                    className={`w-3 h-3 ${isLightUi ? 'text-emerald-700' : 'text-emerald-400'}`}
                                    aria-hidden="true"
                                  />
                                  <span>Peak Taming</span>
                                </span>
                                <span
                                  className={`font-semibold ${
                                    isLightUi ? 'text-emerald-700' : 'text-emerald-300'
                                  }`}
                                >
                                  {nightCompressionDb < 0
                                    ? `${nightCompressionDb.toFixed(1)} dB`
                                    : 'Standby'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Photosensitive Flash Guard (Accessibility First) */}
                          <Menu.CheckboxItem
                            className="cadence-menu-item"
                            checked={flashGuardMode !== 'off'}
                            onCheckedChange={() =>
                              onChangeFlashGuardMode?.(
                                flashGuardMode === 'off' ? 'comfort' : 'off'
                              )
                            }
                          >
                            <span className="inline-flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Flash Guard</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor:
                                  flashGuardMode !== 'off'
                                    ? 'var(--pulse-switch-on-bg)'
                                    : 'var(--pulse-switch-off-bg)',
                                borderColor:
                                  flashGuardMode !== 'off'
                                    ? 'var(--pulse-switch-on-border)'
                                    : 'var(--pulse-switch-off-border)',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 ${
                                  flashGuardMode !== 'off' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                                style={{
                                  backgroundColor:
                                    flashGuardMode !== 'off'
                                      ? 'var(--pulse-switch-thumb, #ffffff)'
                                      : '#ffffff',
                                }}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          {flashGuardMode !== 'off' && (
                            <div
                              className="px-2 py-1.5 rounded-xl border space-y-2"
                              style={{
                                backgroundColor: isLightUi
                                  ? 'rgba(9, 9, 11, 0.05)'
                                  : 'rgba(255, 255, 255, 0.04)',
                                borderColor: 'var(--pulse-menu-sep)',
                              }}
                            >
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeFlashGuardMode?.('comfort');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer"
                                  style={
                                    flashGuardMode === 'comfort'
                                      ? {
                                          backgroundColor: 'var(--pulse-menu-pill-bg)',
                                          color: 'var(--pulse-menu-pill-fg)',
                                          border: '1px solid var(--pulse-menu-pill-bg)',
                                        }
                                      : {
                                          border: '1px solid transparent',
                                          opacity: 0.78,
                                        }
                                  }
                                >
                                  Balanced
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeFlashGuardMode?.('strict');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer"
                                  style={
                                    flashGuardMode === 'strict'
                                      ? {
                                          backgroundColor: 'var(--pulse-menu-pill-bg)',
                                          color: 'var(--pulse-menu-pill-fg)',
                                          border: '1px solid var(--pulse-menu-pill-bg)',
                                        }
                                      : {
                                          border: '1px solid transparent',
                                          opacity: 0.78,
                                        }
                                  }
                                >
                                  Strict (3Hz)
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular opacity-85">
                                <span className="inline-flex items-center gap-1">
                                  <ShieldCheck
                                    className={`w-3 h-3 ${isLightUi ? 'text-emerald-700' : 'text-emerald-400'}`}
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {flashGuard?.attenuationPct
                                      ? `Shield -${flashGuard.attenuationPct}%`
                                      : 'Monitoring'}
                                  </span>
                                </span>
                                <span
                                  className={`font-semibold ${
                                    isLightUi ? 'text-emerald-700' : 'text-emerald-300'
                                  }`}
                                >
                                  {flashGuard && !flashGuard.guardAvailable
                                    ? 'No CORS'
                                    : `${flashGuard?.dampenedCount ?? 0} damped`}
                                </span>
                              </div>
                            </div>
                          )}

                          <Menu.Separator className="cadence-menu-sep" />

                          {/* Toggle Switch 1: Signal & Battery (Hidden by default) */}
                          <Menu.CheckboxItem
                            className="cadence-menu-item"
                            checked={showSignalBattery}
                            onCheckedChange={() => onToggleSignalBattery?.()}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Wifi className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Signal &amp; Battery</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor: showSignalBattery
                                  ? 'var(--pulse-switch-on-bg)'
                                  : 'var(--pulse-switch-off-bg)',
                                borderColor: showSignalBattery
                                  ? 'var(--pulse-switch-on-border)'
                                  : 'var(--pulse-switch-off-border)',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 ${
                                  showSignalBattery ? 'translate-x-4' : 'translate-x-0'
                                }`}
                                style={{
                                  backgroundColor: showSignalBattery
                                    ? 'var(--pulse-switch-thumb, #ffffff)'
                                    : '#ffffff',
                                }}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          {/* Toggle Switch 2: Time (Hidden by default) */}
                          <Menu.CheckboxItem
                            className="cadence-menu-item"
                            checked={showTime}
                            onCheckedChange={() => onToggleTime?.()}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Clock className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Time</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor: showTime
                                  ? 'var(--pulse-switch-on-bg)'
                                  : 'var(--pulse-switch-off-bg)',
                                borderColor: showTime
                                  ? 'var(--pulse-switch-on-border)'
                                  : 'var(--pulse-switch-off-border)',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 ${
                                  showTime ? 'translate-x-4' : 'translate-x-0'
                                }`}
                                style={{
                                  backgroundColor: showTime
                                    ? 'var(--pulse-switch-thumb, #ffffff)'
                                    : '#ffffff',
                                }}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          <Menu.Separator className="cadence-menu-sep" />

                          {/* Bookmark Frame & Download Clip */}
                          <Menu.Item
                            className="cadence-menu-item"
                            onClick={handleBookmarkClick}
                          >
                            <span className="inline-flex items-center gap-2">
                              <BookmarkPlus className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Bookmark Frame</span>
                            </span>
                            <span className="cadence-menu-hint font-mono-tabular">
                              {formatShortcutUpper(keymap.bookmark)}
                            </span>
                          </Menu.Item>

                          <Menu.Item
                            className="cadence-menu-item"
                            onClick={onDownload}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Download className="w-4 h-4 cadence-menu-icon" aria-hidden="true" />
                              <span>Download Clip</span>
                            </span>
                          </Menu.Item>
                        </Menu.Content>
                      </Menu.Popup>
                    </Menu.Root>

                    <span className="cadence-divider cadence-hide-compact" aria-hidden="true" />

                    <ControlTooltip
                      label={isPip ? 'Exit Picture in Picture' : 'Picture in Picture'}
                      shortcut={formatShortcutUpper(keymap.info)}
                    >
                      <button
                        type="button"
                        onClick={onTogglePip}
                        className="cadence-btn"
                        data-active={isPip ? '' : undefined}
                        aria-pressed={isPip}
                        aria-label={isPip ? 'Exit Picture in Picture' : 'Picture in Picture'}
                      >
                        <PictureInPicture2 className="w-[17px] h-[17px]" aria-hidden="true" />
                      </button>
                    </ControlTooltip>

                    <ControlTooltip
                      label="Fullscreen"
                      shortcut={formatShortcutUpper(keymap.fullscreen)}
                    >
                      <FullscreenButton
                        render={(props, state) => (
                          <button {...props} className="cadence-btn">
                            {state.fullscreen ? (
                              <Minimize2 className="w-[18px] h-[18px]" aria-hidden="true" />
                            ) : (
                              <Maximize2 className="w-[18px] h-[18px]" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      />
                    </ControlTooltip>
                  </div>
                </div>

                {/* Laser Scrubber with Integrated Progress Timestamps, Preview Thumbnail & Bookmark Pins */}
                <Time.Group className="cadence-slider-row">
                  <Time.Value
                    className="cadence-progress-time cadence-progress-time-current"
                    type="current"
                    toggle
                    title="Click to toggle elapsed / remaining time"
                  />

                  <div className="cadence-slider-track-wrap">
                    <TimeSlider.Root className="cadence-time-slider" thumbAlignment="edge">
                      <TimeSlider.Chapters
                        className="cadence-time-chapters"
                        renderChapter={(props) => (
                          <div className="cadence-time-chapter" {...props}>
                            <TimeSlider.Track className="cadence-time-track">
                              <TimeSlider.Buffer className="cadence-time-buffer" />
                              <TimeSlider.Fill className="cadence-time-fill" />
                            </TimeSlider.Track>
                          </div>
                        )}
                      />
                      <TimeSlider.Thumb className="cadence-time-thumb" />
                      <TimeSlider.Preview className="cadence-time-preview">
                        {previewThumbUrl && (
                          <img
                            src={previewThumbUrl}
                            alt=""
                            className="w-28 h-16 object-cover rounded-md border border-white/15 bg-black"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <TimeSlider.Value className="cadence-time-preview-value" type="pointer" />
                        <TimeSlider.ChapterTitle className="cadence-time-chapter-title" />
                      </TimeSlider.Preview>
                    </TimeSlider.Root>

                    {/* Frame Bookmark Pins */}
                    {duration > 0 &&
                      bookmarks.map((bm) => {
                        const pct = Math.min(98, Math.max(2, (bm.time / duration) * 100));
                        return (
                          <button
                            key={bm.id}
                            type="button"
                            onClick={() => onJumpToTime(bm.time)}
                            title={`${formatTimecode(bm.time)} — ${bm.note}`}
                            aria-label={`Jump to bookmark at ${formatTimecode(bm.time)}: ${bm.note}`}
                            className="absolute top-0 -translate-x-1/2 w-2 h-2 rotate-45 rounded-[1.5px] border border-black/80 transition-transform duration-150 hover:scale-125 cursor-pointer z-[4]"
                            style={{
                              left: `${pct}%`,
                              backgroundColor: 'rgb(var(--pulse-video-rgb, 255, 107, 0))',
                              boxShadow: '0 0 8px rgba(var(--pulse-video-rgb, 255, 107, 0), 0.72)',
                            }}
                          />
                        );
                      })}
                  </div>

                  <Time.Value
                    className="cadence-progress-time cadence-progress-time-duration"
                    type="duration"
                  />
                </Time.Group>
              </div>
            </div>
          </Tooltip.Provider>
        </Controls.Content>
      </Controls.Root>

      {/* Remappable Keyboard Hotkeys */}
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys={keymap.playPause} action="togglePaused" />
      <Hotkey keys={keymap.mute} action="toggleMuted" />
      <Hotkey keys={keymap.fullscreen} action="toggleFullscreen" />
      <Hotkey keys={keymap.captions} action="toggleSubtitles" />
      <Hotkey keys="ArrowRight" action="seekStep" />
      <Hotkey keys="ArrowLeft" action="seekStep" />
      <Hotkey keys="l" action="seekStep" />
      <Hotkey keys="j" action="seekStep" />
      <Hotkey keys="ArrowUp" action="volumeStep" />
      <Hotkey keys="ArrowDown" action="volumeStep" />
      <Hotkey keys="0-9" action="seekToPercent" />
      <Hotkey keys="Home" action="seekToPercent" value={0} />
      <Hotkey keys="End" action="seekToPercent" value={100} />

      {/* Pointer & Touch Gestures */}
      <Gesture type="tap" action="togglePaused" pointer="mouse" region="center" />
      <Gesture type="tap" action="toggleControls" pointer="touch" />
      <Gesture type="doubletap" action="seekStep" region="left" />
      <Gesture type="doubletap" action="toggleFullscreen" region="center" />
      <Gesture type="doubletap" action="seekStep" region="right" />
    </Container>
  );
}
