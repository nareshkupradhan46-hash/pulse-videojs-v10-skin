import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  BufferingIndicator,
  CaptionsButton,
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
  AudioLines,
  BookmarkPlus,
  Captions,
  CaptionsOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FastForward,
  Gauge,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  Pause,
  PictureInPicture2,
  Play,
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
  Volume1,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';
import { ChallengeTagBadge } from './ChallengeTagBadge';
import { useDeviceStatus } from '../hooks/useDeviceStatus';
import type { FlashGuardState } from '../hooks/useFlashGuard';
import {
  THEME_ACCENTS,
  type FlashGuardMode,
  type FrameBookmark,
  type KeymapConfig,
  type NightAudioMode,
  type PulseAccessibilityState,
  type PulseThemeId,
  type SubtitleStyleState,
} from '../types/pulse';
import { formatTimecode, type VideoReel } from '../utils/synthVideo';

const QUALITY_TIERS = ['Auto', '1080p', '720p', '480p', '360p'] as const;

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
  showInPlayerBadge?: boolean;
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

function hexToGlowRgba(hex: string, alpha = 0.45): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return `rgba(255, 107, 0, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(255, 107, 0, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  showInPlayerBadge = true,
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

  useEffect(() => {
    const updateClock = () => {
      setClockLabel(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    const timer = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const activeAccent =
    theme === 'custom' ? customAccent : THEME_ACCENTS[theme];

  const skinStyle = useMemo(() => {
    const cueSize =
      subtitleStyle.fontSize === 'sm'
        ? '0.85rem'
        : subtitleStyle.fontSize === 'lg'
          ? '1.25rem'
          : '1rem';
    const videoRgb =
      backdropMode === 'white'
        ? '17, 24, 39'
        : backdropMode === 'black'
          ? '248, 250, 252'
          : ambientRgb;
    const videoBrightness =
      brightnessPct <= 75
        ? 0.25 + (brightnessPct / 75) * 0.75
        : 1 + ((brightnessPct - 75) / 25) * 0.3;
    const guardBrightness = flashGuard?.brightnessFactor ?? 1;
    const guardContrast = flashGuard?.contrastFactor ?? 1;
    const guardVeil = flashGuard?.veilOpacity ?? 0;
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
      '--pulse-cue-size': cueSize,
      '--pulse-cue-color': subtitleStyle.color,
      '--pulse-cue-bg': `rgba(10, 10, 13, ${subtitleStyle.bgOpacity})`,
    } as CSSProperties;
  }, [activeAccent, ambientRgb, backdropMode, brightnessPct, flashGuard, subtitleStyle]);

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
      showShortcutHint({
        keyLabel: formatShortcutUpper(keymap.captions),
        actionLabel: 'Toggle Captions',
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
      data-pulse-theme={theme === 'custom' ? 'amber' : theme}
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
            {/* Top Bar: Video Title (Left) + Real-Time Status Bar & Tag Badge (Right) */}
            <div className="cadence-top-bar">
              <div className="cadence-telemetry-pill">
                <span className="cadence-telemetry-title">{title}</span>
              </div>

              {(showSignalBattery || showTime || showInPlayerBadge) && (
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

                  {showInPlayerBadge && (
                    <div className="hidden md:block">
                      <ChallengeTagBadge
                        variant="glass"
                        size="compact"
                        copyable={false}
                        tagSuffix="v10"
                      />
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
            <div className="relative z-[3] px-4 pb-2 flex flex-wrap items-center justify-end gap-2 pointer-events-none">
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
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[#FF6B00] hover:opacity-95 px-3.5 py-2 text-xs font-semibold text-zinc-950 shadow-lg transition-transform active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
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
                  (selectedQuality !== 'Auto' && !hasHlsRenditions) ||
                  bookmarks.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 min-w-0 px-0.5 text-[11px] font-mono-tabular">
                    {playbackRate !== 1 && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          backgroundColor: hexToGlowRgba(activeAccent, 0.2),
                          color: activeAccent,
                        }}
                      >
                        {playbackRate}x SPEED
                      </span>
                    )}
                    {nightAudioMode !== 'off' && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.16)',
                          borderColor: 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.5)',
                          color: theme === 'light' ? '#111827' : '#ffffff',
                        }}
                      >
                        <Moon className="w-2.5 h-2.5" style={{ color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }} aria-hidden="true" />
                        <span>
                          {nightAudioMode === 'whisper' ? 'WHISPER COMPRESSOR' : 'VOICE ISOLATED'}
                        </span>
                        {nightCompressionDb < 0 && (
                          <span className={theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'}>
                            {nightCompressionDb.toFixed(1)}dB
                          </span>
                        )}
                      </span>
                    )}
                    {flashGuardMode !== 'off' && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                        style={{
                          backgroundColor: flashGuard?.activeAlert
                            ? 'rgba(16, 185, 129, 0.22)'
                            : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.14)',
                          borderColor: flashGuard?.activeAlert
                            ? 'rgba(16, 185, 129, 0.65)'
                            : 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.45)',
                          color: theme === 'light' ? '#111827' : '#ffffff',
                        }}
                      >
                        <ShieldCheck
                          className={`w-2.5 h-2.5 ${
                            flashGuard?.activeAlert
                              ? theme === 'light'
                                ? 'text-emerald-700'
                                : 'text-emerald-300'
                              : ''
                          }`}
                          style={
                            flashGuard?.activeAlert
                              ? undefined
                              : { color: 'rgb(var(--pulse-video-rgb, 255, 107, 0))' }
                          }
                          aria-hidden="true"
                        />
                        <span>
                          {flashGuardMode === 'strict' ? 'FLASH GUARD · STRICT' : 'FLASH GUARD'}
                        </span>
                        {flashGuard && flashGuard.attenuationPct > 0 ? (
                          <span className={theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'}>
                            -{flashGuard.attenuationPct}%
                          </span>
                        ) : flashGuard && flashGuard.dampenedCount > 0 ? (
                          <span className="opacity-75">
                            {flashGuard.dampenedCount} damped
                          </span>
                        ) : null}
                      </span>
                    )}
                    {selectedQuality !== 'Auto' && !hasHlsRenditions && (
                      <span className="opacity-75">{selectedQuality}</span>
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
                            className="cadence-btn"
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
                            className="cadence-btn"
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
                                <button {...props} className="cadence-btn">
                                  {state.muted || state.volumeLevel === 'off' ? (
                                    <VolumeX
                                      className="w-[18px] h-[18px]"
                                      style={{ color: activeAccent }}
                                      aria-hidden="true"
                                    />
                                  ) : state.volumeLevel === 'low' ? (
                                    <Volume1 className="w-[18px] h-[18px]" aria-hidden="true" />
                                  ) : (
                                    <Volume2 className="w-[18px] h-[18px]" aria-hidden="true" />
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

                    <ControlTooltip
                      label="Captions"
                      shortcut={formatShortcutUpper(keymap.captions)}
                    >
                      <CaptionsButton
                        render={(props, state) => (
                          <button
                            {...props}
                            className="cadence-btn cadence-hide-compact"
                            data-active={state.subtitlesShowing ? '' : undefined}
                          >
                            {state.subtitlesShowing ? (
                              <Captions className="w-[18px] h-[18px]" aria-hidden="true" />
                            ) : (
                              <CaptionsOff className="w-[18px] h-[18px] opacity-85" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      />
                    </ControlTooltip>

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
                                  <Gauge className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
                                        <Check className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
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
                                    <Tv className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                                    <span>Quality</span>
                                  </span>
                                  <span className="cadence-menu-hint">
                                    <QualityRadioGroup.Value />
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
                                  <QualityRadioGroup.Options
                                    renderItem={(props, item) => (
                                      <Menu.RadioItem {...props} className="cadence-menu-radio-item">
                                        <span>{item.label}</span>
                                        <Menu.ItemIndicator>
                                          <Check className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
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
                                    <Tv className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
                                  {QUALITY_TIERS.map((q) => (
                                    <Menu.RadioItem
                                      key={q}
                                      value={q}
                                      className="cadence-menu-radio-item"
                                    >
                                      <span>{q}</span>
                                      <Menu.ItemIndicator>
                                        <Check className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
                                      </Menu.ItemIndicator>
                                    </Menu.RadioItem>
                                  ))}
                                </Menu.Content>
                              </Menu.RadioGroup>
                            </Menu.Root>
                          )}

                          {/* Captions Submenu */}
                          <Menu.Root>
                            <CaptionsRadioGroup.Root>
                              <Menu.Trigger className="cadence-menu-item">
                                <span className="inline-flex items-center gap-2">
                                  <Captions className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
                                        <Check className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
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
                                  <Palette className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
                                      <Check className="w-3.5 h-3.5" style={{ color: activeAccent }} aria-hidden="true" />
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
                              <Moon className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                              <span>Night Whisper</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor:
                                  nightAudioMode !== 'off'
                                    ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.38)'
                                    : theme === 'light'
                                      ? 'rgba(17, 24, 39, 0.16)'
                                      : 'rgba(255, 255, 255, 0.12)',
                                borderColor:
                                  nightAudioMode !== 'off'
                                    ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.85)'
                                    : theme === 'light'
                                      ? 'rgba(17, 24, 39, 0.28)'
                                      : 'rgba(255, 255, 255, 0.22)',
                                boxShadow:
                                  nightAudioMode !== 'off'
                                    ? '0 0 10px rgba(var(--pulse-video-rgb, 255, 107, 0), 0.35)'
                                    : 'none',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                                  nightAudioMode !== 'off' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          {nightAudioMode !== 'off' && (
                            <div
                              className={`px-2 py-1.5 rounded-xl border space-y-2 ${
                                theme === 'light'
                                  ? 'bg-black/[0.05] border-black/10'
                                  : 'bg-white/[0.04] border-white/10'
                              }`}
                            >
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeNightAudioMode?.('voice');
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors cursor-pointer ${
                                    nightAudioMode === 'voice'
                                      ? theme === 'light'
                                        ? 'text-zinc-950 font-semibold'
                                        : 'text-white font-semibold'
                                      : theme === 'light'
                                        ? 'text-zinc-600 hover:text-zinc-950'
                                        : 'text-zinc-400 hover:text-white'
                                  }`}
                                  style={
                                    nightAudioMode === 'voice'
                                      ? {
                                          backgroundColor:
                                            'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.28)',
                                          border:
                                            '1px solid rgba(var(--pulse-video-rgb, 255, 107, 0), 0.75)',
                                        }
                                      : { border: '1px solid transparent' }
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
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors cursor-pointer ${
                                    nightAudioMode === 'whisper'
                                      ? theme === 'light'
                                        ? 'text-zinc-950 font-semibold'
                                        : 'text-white font-semibold'
                                      : theme === 'light'
                                        ? 'text-zinc-600 hover:text-zinc-950'
                                        : 'text-zinc-400 hover:text-white'
                                  }`}
                                  style={
                                    nightAudioMode === 'whisper'
                                      ? {
                                          backgroundColor:
                                            'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.28)',
                                          border:
                                            '1px solid rgba(var(--pulse-video-rgb, 255, 107, 0), 0.75)',
                                        }
                                      : { border: '1px solid transparent' }
                                  }
                                >
                                  Whisper Max
                                </button>
                              </div>
                              <div
                                className={`flex items-center justify-between gap-2 text-[10px] font-mono-tabular ${
                                  theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <AudioLines
                                    className={`w-3 h-3 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}
                                    aria-hidden="true"
                                  />
                                  <span>Peak Taming</span>
                                </span>
                                <span
                                  className={`font-semibold ${
                                    theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
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
                              <ShieldCheck className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                              <span>Flash Guard</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor:
                                  flashGuardMode !== 'off'
                                    ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.38)'
                                    : theme === 'light'
                                      ? 'rgba(17, 24, 39, 0.16)'
                                      : 'rgba(255, 255, 255, 0.12)',
                                borderColor:
                                  flashGuardMode !== 'off'
                                    ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.85)'
                                    : theme === 'light'
                                      ? 'rgba(17, 24, 39, 0.28)'
                                      : 'rgba(255, 255, 255, 0.22)',
                                boxShadow:
                                  flashGuardMode !== 'off'
                                    ? '0 0 10px rgba(var(--pulse-video-rgb, 255, 107, 0), 0.35)'
                                    : 'none',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                                  flashGuardMode !== 'off' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </span>
                          </Menu.CheckboxItem>

                          {flashGuardMode !== 'off' && (
                            <div
                              className={`px-2 py-1.5 rounded-xl border space-y-2 ${
                                theme === 'light'
                                  ? 'bg-black/[0.05] border-black/10'
                                  : 'bg-white/[0.04] border-white/10'
                              }`}
                            >
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeFlashGuardMode?.('comfort');
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors cursor-pointer ${
                                    flashGuardMode === 'comfort'
                                      ? theme === 'light'
                                        ? 'text-zinc-950 font-semibold'
                                        : 'text-white font-semibold'
                                      : theme === 'light'
                                        ? 'text-zinc-600 hover:text-zinc-950'
                                        : 'text-zinc-400 hover:text-white'
                                  }`}
                                  style={
                                    flashGuardMode === 'comfort'
                                      ? {
                                          backgroundColor:
                                            'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.28)',
                                          border:
                                            '1px solid rgba(var(--pulse-video-rgb, 255, 107, 0), 0.75)',
                                        }
                                      : { border: '1px solid transparent' }
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
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors cursor-pointer ${
                                    flashGuardMode === 'strict'
                                      ? theme === 'light'
                                        ? 'text-zinc-950 font-semibold'
                                        : 'text-white font-semibold'
                                      : theme === 'light'
                                        ? 'text-zinc-600 hover:text-zinc-950'
                                        : 'text-zinc-400 hover:text-white'
                                  }`}
                                  style={
                                    flashGuardMode === 'strict'
                                      ? {
                                          backgroundColor:
                                            'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.28)',
                                          border:
                                            '1px solid rgba(var(--pulse-video-rgb, 255, 107, 0), 0.75)',
                                        }
                                      : { border: '1px solid transparent' }
                                  }
                                >
                                  Strict (3Hz)
                                </button>
                              </div>
                              <div
                                className={`flex items-center justify-between gap-2 text-[10px] font-mono-tabular ${
                                  theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'
                                }`}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <ShieldCheck
                                    className={`w-3 h-3 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}
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
                                    theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
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
                              <Wifi className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                              <span>Signal &amp; Battery</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor: showSignalBattery
                                  ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.38)'
                                  : theme === 'light'
                                    ? 'rgba(17, 24, 39, 0.16)'
                                    : 'rgba(255, 255, 255, 0.12)',
                                borderColor: showSignalBattery
                                  ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.85)'
                                  : theme === 'light'
                                    ? 'rgba(17, 24, 39, 0.28)'
                                    : 'rgba(255, 255, 255, 0.22)',
                                boxShadow: showSignalBattery
                                  ? '0 0 10px rgba(var(--pulse-video-rgb, 255, 107, 0), 0.35)'
                                  : 'none',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                                  showSignalBattery ? 'translate-x-4' : 'translate-x-0'
                                }`}
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
                              <Clock className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                              <span>Time</span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-all duration-200 border shrink-0"
                              style={{
                                backgroundColor: showTime
                                  ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.38)'
                                  : theme === 'light'
                                    ? 'rgba(17, 24, 39, 0.16)'
                                    : 'rgba(255, 255, 255, 0.12)',
                                borderColor: showTime
                                  ? 'rgba(var(--pulse-video-rgb, 255, 107, 0), 0.85)'
                                  : theme === 'light'
                                    ? 'rgba(17, 24, 39, 0.28)'
                                    : 'rgba(255, 255, 255, 0.22)',
                                boxShadow: showTime
                                  ? '0 0 10px rgba(var(--pulse-video-rgb, 255, 107, 0), 0.35)'
                                  : 'none',
                              }}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                                  showTime ? 'translate-x-4' : 'translate-x-0'
                                }`}
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
                              <BookmarkPlus className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
                              <Download className="w-4 h-4 text-zinc-400" aria-hidden="true" />
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
