import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { Video, VideoPlayer, VideoSkin } from '@videojs/react/video';
import '@videojs/react/video/skin.css';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import {
  BookOpen,
  Hash,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import { CadenceVideoSkin } from './components/CadenceVideoSkin';
import { ChallengeTagBadge } from './components/ChallengeTagBadge';
import { SkinTestbench, type ViewportPreset } from './components/SkinTestbench';
import { TagBadgeShowcase } from './components/TagBadgeShowcase';
import { DesignNotesSection } from './components/DesignNotesSection';
import {
  matchAuditKeyId,
  type FocusedControlInfo,
  type PlayerBackdropMode,
} from './components/LiveAuditPanel';
import { useLiveColorSampling } from './hooks/useLiveColorSampling';
import { useNightWhisperAudio } from './hooks/useNightWhisperAudio';
import { useFlashGuard } from './hooks/useFlashGuard';
import {
  DEFAULT_KEYMAP,
  type FlashGuardMode,
  type FrameBookmark,
  type KeymapConfig,
  type NightAudioMode,
  type PulseAccessibilityState,
  type PulseThemeId,
  type SubtitleStyleState,
} from './types/pulse';
import {
  VIDEO_REELS,
  formatTimecode,
  generateFallbackVideoBlob,
} from './utils/synthVideo';

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private browsing errors
  }
}

function describeFocusedElement(el: HTMLElement): FocusedControlInfo {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  const role =
    el.getAttribute('role') ||
    (el.tagName === 'BUTTON' ? 'button' : el.tagName.toLowerCase());
  const text = el.textContent?.trim();
  const label =
    ariaLabel ||
    text ||
    (role === 'region' ? 'Video Player Container' : 'Player Control');
  return { label, role };
}

function resolveVideoElement(node: unknown): HTMLVideoElement | null {
  if (!node || typeof window === 'undefined') return null;
  if (node instanceof HTMLVideoElement) return node;
  const candidate = node as {
    media?: unknown;
    querySelector?: (sel: string) => Element | null;
    shadowRoot?: ShadowRoot | null;
  };
  if (candidate.media instanceof HTMLVideoElement) {
    return candidate.media;
  }
  if (typeof candidate.querySelector === 'function') {
    const found = candidate.querySelector('video');
    if (found instanceof HTMLVideoElement) return found;
  }
  if (candidate.shadowRoot) {
    const shadowVideo = candidate.shadowRoot.querySelector('video');
    if (shadowVideo instanceof HTMLVideoElement) return shadowVideo;
  }
  return null;
}

export default function App() {
  const [activeReelId, setActiveReelId] = useState<string>(VIDEO_REELS[0].id);
  const [muxPlaybackId, setMuxPlaybackId] = useState<string>('');
  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [forceControls, setForceControls] = useState<boolean>(false);
  const [showInPlayerBadge, setShowInPlayerBadge] = useState<boolean>(true);
  const [showSignalBattery, setShowSignalBattery] = useState<boolean>(false);
  const [showTime, setShowTime] = useState<boolean>(false);
  const [backdropMode, setBackdropMode] = useState<PlayerBackdropMode>('video');
  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');
  const [nativePipActive, setNativePipActive] = useState<boolean>(false);
  const [floatingPipActive, setFloatingPipActive] = useState<boolean>(false);

  // Persisted Pulse Player Preferences
  const [theme, setTheme] = useState<PulseThemeId>(() =>
    readStorage<PulseThemeId>('pulse:theme', 'amber')
  );
  const [customAccent, setCustomAccent] = useState<string>(() =>
    readStorage<string>('pulse:customAccent', '#FF6B00')
  );
  const [accessibility, setAccessibility] = useState<PulseAccessibilityState>(() => {
    const stored = readStorage<PulseAccessibilityState>('pulse:accessibility', {
      highContrast: false,
      reducedMotion: false,
      reducedTransparency: false,
      dyslexicFont: false,
      largeText: false,
    });
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return { ...stored, reducedMotion: true };
    }
    return stored;
  });
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyleState>(() =>
    readStorage<SubtitleStyleState>('pulse:subtitleStyle', {
      fontSize: 'md',
      color: '#F8FAFC',
      bgOpacity: 0.88,
    })
  );
  const [keymap, setKeymap] = useState<KeymapConfig>(() =>
    readStorage<KeymapConfig>('pulse:keymap', DEFAULT_KEYMAP)
  );
  const [bookmarks, setBookmarks] = useState<FrameBookmark[]>(() =>
    readStorage<FrameBookmark[]>('pulse:bookmarks', [])
  );
  const [watchHistory, setWatchHistory] = useState<Record<string, number>>(() =>
    readStorage<Record<string, number>>('pulse:watchHistory', {})
  );
  const [nightAudioMode, setNightAudioMode] = useState<NightAudioMode>(() =>
    readStorage<NightAudioMode>('pulse:nightAudioMode', 'off')
  );
  const [flashGuardMode, setFlashGuardMode] = useState<FlashGuardMode>(() =>
    readStorage<FlashGuardMode>('pulse:flashGuardMode', 'off')
  );

  // Live Media Telemetry State
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPct, setBufferedPct] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [volumePct, setVolumePct] = useState<number>(100);
  const [muted, setMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Keyboard & Focus Audit State
  const [focusedControl, setFocusedControl] = useState<FocusedControlInfo | null>(null);
  const [verifiedKeys, setVerifiedKeys] = useState<string[]>([]);
  const [lastKeyPressed, setLastKeyPressed] = useState<string | null>(null);
  const [fallbackUrls, setFallbackUrls] = useState<Record<string, string>>({});

  const generatingRef = useRef<Record<string, boolean>>({});
  const lastHistorySaveRef = useRef<number>(0);
  const lastTimeSyncRef = useRef<number>(0);
  const playerSectionRef = useRef<HTMLDivElement>(null);
  const mediaAdapterCleanupRef = useRef<(() => void) | null>(null);

  const handleVideoRef = useCallback((node: unknown) => {
    const resolved = resolveVideoElement(node);
    setVideoEl((prev) => (prev === resolved ? prev : resolved));
  }, []);

  const activeReelIndex = Math.max(
    0,
    VIDEO_REELS.findIndex((r) => r.id === activeReelId)
  );
  const activeReel = VIDEO_REELS[activeReelIndex] ?? VIDEO_REELS[0];

  const trimmedMux = muxPlaybackId.trim();
  const isCustomMux = trimmedMux.length > 0;
  const isCustomUrl = /^https?:\/\//i.test(trimmedMux);
  const isCustomMp4 = /\.mp4($|\?)/i.test(trimmedMux);
  const activeMediaKey = isCustomMux ? `mux:${trimmedMux}` : activeReel.id;
  const activeSrc = isCustomMux
    ? fallbackUrls[activeMediaKey] ||
      (isCustomUrl
        ? trimmedMux
        : `https://stream.mux.com/${trimmedMux}.m3u8`)
    : fallbackUrls[activeReel.id] || activeReel.src;
  const useHlsAdapter =
    !fallbackUrls[activeMediaKey] &&
    ((isCustomMux && !isCustomMp4) ||
      Boolean(activeReel.isHls && !fallbackUrls[activeReel.id]));
  const isUsingFallback = Boolean(fallbackUrls[activeMediaKey] || fallbackUrls[activeReel.id]);

  const activePoster = isCustomMux
    ? isCustomUrl
      ? activeReel.poster
      : `https://image.mux.com/${trimmedMux}/thumbnail.jpg`
    : activeReel.poster;

  const activeTitle = isCustomMux
    ? `Mux Stream — ${trimmedMux}`
    : activeReel.title;

  const streamSupportsCors =
    isCustomMux ||
    isUsingFallback ||
    Boolean(activeReel.muxPlaybackId) ||
    Boolean(activeReel.supportsCors);

  // Persist Preferences
  useEffect(() => writeStorage('pulse:theme', theme), [theme]);
  useEffect(() => writeStorage('pulse:customAccent', customAccent), [customAccent]);
  useEffect(() => writeStorage('pulse:accessibility', accessibility), [accessibility]);
  useEffect(() => writeStorage('pulse:subtitleStyle', subtitleStyle), [subtitleStyle]);
  useEffect(() => writeStorage('pulse:keymap', keymap), [keymap]);
  useEffect(() => writeStorage('pulse:bookmarks', bookmarks), [bookmarks]);
  useEffect(() => writeStorage('pulse:watchHistory', watchHistory), [watchHistory]);
  useEffect(() => writeStorage('pulse:nightAudioMode', nightAudioMode), [nightAudioMode]);
  useEffect(() => writeStorage('pulse:flashGuardMode', flashGuardMode), [flashGuardMode]);

  // Escape key exits Cinema Mode
  useEffect(() => {
    if (!cinemaMode) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCinemaMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cinemaMode]);

  // Attach listeners to active <video> element for real-time telemetry, resume, & audio analysis
  useEffect(() => {
    if (!videoEl) return;

    const syncFromVideo = () => {
      setCurrentTime(videoEl.currentTime || 0);
      const dur = Number.isFinite(videoEl.duration) ? videoEl.duration : 0;
      setDuration(dur);
      setPlaybackRate(videoEl.playbackRate || 1);
      setVolumePct(Math.round((videoEl.volume ?? 1) * 100));
      setMuted(videoEl.muted);
      setIsPlaying(!videoEl.paused && !videoEl.ended);

      if (dur > 0 && videoEl.buffered.length > 0) {
        const end = videoEl.buffered.end(videoEl.buffered.length - 1);
        setBufferedPct(Math.min(100, Math.round((end / dur) * 100)));
      } else {
        setBufferedPct(0);
      }
    };

    const onTimeUpdate = () => {
      const ct = videoEl.currentTime || 0;
      const now = Date.now();
      if (now - lastTimeSyncRef.current >= 500 || videoEl.paused || videoEl.ended) {
        lastTimeSyncRef.current = now;
        setCurrentTime(ct);
      }
      if (ct > 2 && now - lastHistorySaveRef.current > 2500) {
        lastHistorySaveRef.current = now;
        setWatchHistory((prev) => ({ ...prev, [activeMediaKey]: Math.floor(ct) }));
      }
    };

    const onSeeked = () => {
      lastTimeSyncRef.current = Date.now();
      setCurrentTime(videoEl.currentTime || 0);
    };

    const onEnterPip = () => {
      setNativePipActive(true);
      setFloatingPipActive(false);
    };
    const onLeavePip = () => {
      setNativePipActive(false);
    };

    syncFromVideo();
    const events = [
      'loadedmetadata',
      'durationchange',
      'progress',
      'play',
      'pause',
      'ended',
      'ratechange',
      'volumechange',
    ] as const;

    events.forEach((evt) => videoEl.addEventListener(evt, syncFromVideo));
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.addEventListener('enterpictureinpicture', onEnterPip);
    videoEl.addEventListener('leavepictureinpicture', onLeavePip);

    return () => {
      events.forEach((evt) => videoEl.removeEventListener(evt, syncFromVideo));
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('seeked', onSeeked);
      videoEl.removeEventListener('enterpictureinpicture', onEnterPip);
      videoEl.removeEventListener('leavepictureinpicture', onLeavePip);
    };
  }, [videoEl, activeMediaKey]);

  const isPip = nativePipActive || floatingPipActive;

  const handleTogglePip = useCallback(async () => {
    try {
      if (typeof document !== 'undefined' && document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setNativePipActive(false);
        return;
      }
      const webkitVideo = videoEl as (HTMLVideoElement & {
        webkitPresentationMode?: string;
        webkitSetPresentationMode?: (mode: string) => void;
      }) | null;
      if (
        webkitVideo &&
        webkitVideo.webkitPresentationMode === 'picture-in-picture' &&
        typeof webkitVideo.webkitSetPresentationMode === 'function'
      ) {
        webkitVideo.webkitSetPresentationMode('inline');
        setNativePipActive(false);
        return;
      }
      if (floatingPipActive) {
        setFloatingPipActive(false);
        return;
      }
      if (
        videoEl &&
        typeof document !== 'undefined' &&
        document.pictureInPictureEnabled &&
        typeof videoEl.requestPictureInPicture === 'function' &&
        videoEl.readyState >= 1
      ) {
        await videoEl.requestPictureInPicture();
        setNativePipActive(true);
        return;
      }
      if (webkitVideo && typeof webkitVideo.webkitSetPresentationMode === 'function') {
        webkitVideo.webkitSetPresentationMode('picture-in-picture');
        setNativePipActive(true);
        return;
      }
    } catch {
      // Fallback to in-app floating PiP when browser/iframe blocks native PiP
    }
    setFloatingPipActive((prev) => !prev);
  }, [videoEl, floatingPipActive]);

  const ambientRgb = useLiveColorSampling(
    videoEl,
    activePoster,
    backdropMode === 'video' && !accessibility.highContrast
  );

  const { compressionDb: nightCompressionDb } = useNightWhisperAudio(
    videoEl,
    nightAudioMode,
    streamSupportsCors
  );

  const flashGuard = useFlashGuard(
    videoEl,
    flashGuardMode,
    streamSupportsCors
  );

  const handleVideoError = useCallback(async () => {
    const key = isCustomMux ? activeMediaKey : activeReel.id;
    if (fallbackUrls[key] || generatingRef.current[key]) return;

    generatingRef.current[key] = true;
    const mode =
      activeReel.id === 'bright'
        ? 'bright'
        : activeReel.id === 'dark'
          ? 'dark'
          : 'editorial';
    const blobUrl = await generateFallbackVideoBlob(activeReel.poster, mode);
    if (blobUrl) {
      setFallbackUrls((prev) => ({ ...prev, [key]: blobUrl }));
    }
  }, [isCustomMux, activeMediaKey, activeReel.id, activeReel.poster, fallbackUrls]);

  const handleVideoErrorRef = useRef(handleVideoError);
  handleVideoErrorRef.current = handleVideoError;

  const handleMediaAdapterRef = useCallback((adapter: EventTarget | null) => {
    if (mediaAdapterCleanupRef.current) {
      mediaAdapterCleanupRef.current();
      mediaAdapterCleanupRef.current = null;
    }
    if (adapter && typeof adapter.addEventListener === 'function') {
      const onErr = () => {
        void handleVideoErrorRef.current();
      };
      adapter.addEventListener('error', onErr);
      mediaAdapterCleanupRef.current = () => {
        adapter.removeEventListener('error', onErr);
      };
    }
  }, []);

  const handleSelectReel = (id: string) => {
    setMuxPlaybackId('');
    setBackdropMode('video');
    setActiveReelId(id);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPct(0);
    setIsPlaying(false);
  };

  const handlePrevReel = () => {
    const prevIdx = (activeReelIndex - 1 + VIDEO_REELS.length) % VIDEO_REELS.length;
    handleSelectReel(VIDEO_REELS[prevIdx].id);
  };

  const handleNextReel = () => {
    const nextIdx = (activeReelIndex + 1) % VIDEO_REELS.length;
    handleSelectReel(VIDEO_REELS[nextIdx].id);
  };

  const handleLoadMuxPlaybackId = (playbackId: string) => {
    setBackdropMode('video');
    setMuxPlaybackId(playbackId);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPct(0);
    setIsPlaying(false);
  };

  const handleChangeBackdropMode = (mode: PlayerBackdropMode) => {
    setBackdropMode(mode);
    if (mode !== 'video') {
      setForceControls(true);
    }
  };

  const handlePlayerFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      setFocusedControl(describeFocusedElement(target));
    }
  };

  const handlePlayerKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    const keyLabel = e.key === ' ' ? 'Space' : e.key;
    setLastKeyPressed(keyLabel);
    const matched = matchAuditKeyId(e.key);
    if (matched) {
      setVerifiedKeys((prev) => (prev.includes(matched) ? prev : [...prev, matched]));
    }
  };

  const focusPlayerContainer = () => {
    const stage = playerSectionRef.current;
    if (!stage) return;
    stage.scrollIntoView({
      behavior: accessibility.reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    const container = stage.querySelector<HTMLElement>('.cadence-skin');
    if (container) {
      container.focus();
      setFocusedControl(describeFocusedElement(container));
    }
  };

  const handleJumpToTime = useCallback(
    (seconds: number) => {
      if (!videoEl) return;
      const clamped = Math.max(0, Math.min(seconds, videoEl.duration || seconds));
      videoEl.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [videoEl]
  );

  const handleAddBookmark = useCallback(
    (customNote?: string) => {
      const t = Math.round((videoEl?.currentTime ?? currentTime) * 10) / 10;
      const item: FrameBookmark = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        reelId: activeMediaKey,
        time: t,
        note: customNote || `Frame marker @ ${formatTimecode(t)}`,
        createdAt: Date.now(),
      };
      setBookmarks((prev) =>
        [...prev, item].sort((a, b) => a.time - b.time)
      );
    },
    [videoEl, currentTime, activeMediaKey]
  );

  const handleDeleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleDownloadClip = () => {
    const a = document.createElement('a');
    a.href = activeSrc;
    a.download = `${activeReel.id}-pulse-v10.${useHlsAdapter ? 'm3u8' : 'mp4'}`;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const activeBookmarks = useMemo(
    () => bookmarks.filter((b) => b.reelId === activeMediaKey),
    [bookmarks, activeMediaKey]
  );

  const activeResumeTime = watchHistory[activeMediaKey] ?? null;

  const handleClearWatchHistory = () => {
    setWatchHistory((prev) => {
      const copy = { ...prev };
      delete copy[activeMediaKey];
      return copy;
    });
  };

  const handleResetAudit = () => {
    setVerifiedKeys([]);
    setLastKeyPressed(null);
    setFocusedControl(null);
  };

  const viewportWidthClass = compareMode
    ? 'max-w-full'
    : viewport === 'mobile320'
      ? 'max-w-[320px]'
      : viewport === 'mobile375'
        ? 'max-w-[375px]'
        : viewport === 'tablet'
          ? 'max-w-[640px]'
          : 'max-w-full';

  return (
    <div
      className="min-h-screen bg-[#0B0B0D] text-[#F4F4F0] flex flex-col"
      style={{ '--pulse-video-rgb': ambientRgb } as CSSProperties}
    >
      {/* Cinema Mode Backdrop Scrim */}
      {cinemaMode && (
        <div
          aria-hidden="true"
          onClick={() => setCinemaMode(false)}
          className="fixed inset-0 z-30 bg-black/92 backdrop-blur-sm transition-opacity"
        />
      )}

      {/* Sleek 3-Zone 100% Transparent Editorial Menu Bar */}
      <header className="sticky top-0 z-30 bg-transparent no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#player"
            className="font-display text-lg font-bold tracking-tight text-[#F4F4F0] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#FF6B00] focus-visible:outline-offset-4 rounded"
          >
            Pulse
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-[13px] font-medium text-zinc-300"
          >
            <a
              href="#player"
              className="group relative inline-flex items-center gap-2 py-1.5 bg-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:scale-x-0 hover:after:scale-x-100 after:bg-[#FF6B00] after:transition-transform after:origin-left focus-visible:outline-2 focus-visible:outline-[#FF6B00] rounded"
            >
              <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#FF6B00] transition-colors" strokeWidth={1.8} aria-hidden="true" />
              <span>Player</span>
            </a>
            <a
              href="#accessibility"
              className="group relative inline-flex items-center gap-2 py-1.5 bg-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:scale-x-0 hover:after:scale-x-100 after:bg-[#FF6B00] after:transition-transform after:origin-left focus-visible:outline-2 focus-visible:outline-[#FF6B00] rounded"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#FF6B00] transition-colors" strokeWidth={1.8} aria-hidden="true" />
              <span>Workbench</span>
            </a>
            <a
              href="#tag-badge"
              className="group relative inline-flex items-center gap-2 py-1.5 bg-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:scale-x-0 hover:after:scale-x-100 after:bg-[#FF6B00] after:transition-transform after:origin-left focus-visible:outline-2 focus-visible:outline-[#FF6B00] rounded"
            >
              <Hash className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#FF6B00] transition-colors" strokeWidth={1.8} aria-hidden="true" />
              <span>Tag Badge</span>
            </a>
            <a
              href="#design-notes"
              className="group relative inline-flex items-center gap-2 py-1.5 bg-transparent hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[1.5px] after:scale-x-0 hover:after:scale-x-100 after:bg-[#FF6B00] after:transition-transform after:origin-left focus-visible:outline-2 focus-visible:outline-[#FF6B00] rounded"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#FF6B00] transition-colors" strokeWidth={1.8} aria-hidden="true" />
              <span>Design Notes</span>
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCinemaMode((v) => !v)}
              className={`cadence-pill-border inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-transparent transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF6B00] focus-visible:outline-offset-2 ${
                cinemaMode
                  ? 'text-[#FF6B00] shadow-[0_0_20px_rgba(255,107,0,0.3)]'
                  : 'text-[#F4F4F0] hover:text-white'
              }`}
              data-active={cinemaMode ? '' : undefined}
            >
              {cinemaMode ? (
                <Minimize2 className="w-3.5 h-3.5 text-[#FF6B00]" strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-[#FF6B00]" strokeWidth={1.9} aria-hidden="true" />
              )}
              <span>{cinemaMode ? 'Exit Cinema' : 'Cinema Mode'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero & Live Video.js v10 Player Showcase */}
        <section id="player" className="pt-10 sm:pt-14 pb-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            {/* Editorial Header with Pixel-Perfect Challenge Tag Badge */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 no-print">
              <div className="space-y-4 max-w-2xl">
                <ChallengeTagBadge
                  variant="obsidian"
                  size="standard"
                  tagSuffix="v10"
                  copyable
                />
                <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-[#F4F4F0] leading-[1.08] text-balance">
                  Pulse Player UI for Video.js v10
                </h1>
                <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
                  An obsidian glass instrument skin built on @videojs/react v10 with live frame color sampling, Voice-Isolated Night Mode, Photosensitive Flash Guard, precision laser scrubber, and WCAG-verified contrast.
                </p>
              </div>

              {/* Clean Unboxed Metadata */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono-tabular text-zinc-400 shrink-0">
                <span>@videojs/react 10.4</span>
                <span aria-hidden="true">·</span>
                <span>Apache-2.0</span>
                <span aria-hidden="true">·</span>
                <span>44px Touch Targets</span>
              </div>
            </div>

            {/* Live Video.js v10 Player Stage */}
            <div
              id="player-stage"
              ref={playerSectionRef}
              onFocusCapture={handlePlayerFocusCapture}
              onKeyDownCapture={handlePlayerKeyDownCapture}
              className={`w-full flex flex-col items-center relative ${
                cinemaMode ? 'z-40' : ''
              }`}
            >
              {/* Cinema Mode Exit Pill */}
              {cinemaMode && (
                <div className="w-full flex items-center justify-between mb-3">
                  <span className="text-xs font-mono-tabular text-zinc-400">
                    Cinema Theater Mode · Press Esc to exit
                  </span>
                  <button
                    type="button"
                    onClick={() => setCinemaMode(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white cursor-pointer"
                  >
                    <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Exit Cinema</span>
                  </button>
                </div>
              )}

              {/* Live Color Sampling Ambient Glow + Player Frame */}
              <div className={`w-full ${viewportWidthClass} relative transition-all duration-200`}>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-4 rounded-3xl blur-2xl opacity-55 transition-colors duration-500"
                  style={{
                    background: `radial-gradient(60% 60% at 50% 50%, rgba(${ambientRgb}, 0.34), transparent 75%)`,
                  }}
                />

                <div
                  className={`relative grid gap-6 ${
                    compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {/* Placeholder when in-app Floating Picture-in-Picture is active */}
                  {floatingPipActive && (
                    <div className="w-full aspect-video rounded-2xl border border-dashed border-white/20 bg-[#0E0F14] flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <PictureInPicture2
                        className="w-8 h-8"
                        style={{ color: `rgb(${ambientRgb})` }}
                        aria-hidden="true"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                          Playing in Picture-in-Picture
                        </p>
                        <p className="text-xs text-zinc-400">
                          Floating mini-player is active in the bottom-right corner
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFloatingPipActive(false)}
                        className="cadence-pill-border mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                      >
                        <span>Return to Theater Stage</span>
                      </button>
                    </div>
                  )}

                  {/* Primary: Pulse Player UI Skin */}
                  <div
                    className={
                      floatingPipActive
                        ? 'fixed bottom-4 right-4 z-50 w-[300px] sm:w-[370px] rounded-2xl border border-white/25 bg-black shadow-[0_24px_64px_rgba(0,0,0,0.88)] overflow-hidden transition-all duration-300'
                        : 'w-full rounded-2xl border border-white/15 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.7)] overflow-hidden'
                    }
                  >
                    {floatingPipActive && (
                      <div className="px-3 py-1.5 border-b border-white/12 bg-[#101218] flex items-center justify-between text-[11px] font-mono-tabular">
                        <span className="inline-flex items-center gap-1.5 text-zinc-200 font-semibold truncate">
                          <PictureInPicture2
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: `rgb(${ambientRgb})` }}
                            aria-hidden="true"
                          />
                          <span className="truncate">PiP · {activeTitle}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setFloatingPipActive(false)}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-medium shrink-0 cursor-pointer"
                        >
                          Exit PiP
                        </button>
                      </div>
                    )}
                    {compareMode && !floatingPipActive && (
                      <div className="px-3.5 py-2 border-b border-white/10 bg-[#121215] flex items-center justify-between text-xs font-mono-tabular">
                        <span className="text-[#FF6B00] font-semibold">
                          A · Pulse Player UI
                        </span>
                        <span className="text-zinc-400">Custom Skin</span>
                      </div>
                    )}
                    <div className="aspect-video w-full relative">
                      <VideoPlayer
                        key={`${activeReel.id}-${muxPlaybackId}-${isUsingFallback ? 'fb' : 'cdn'}`}
                      >
                        <CadenceVideoSkin
                          reel={activeReel}
                          title={activeTitle}
                          poster={activePoster}
                          muxPlaybackId={
                            isCustomMux
                              ? muxPlaybackId.trim()
                              : activeReel.muxPlaybackId
                          }
                          theme={theme}
                          customAccent={customAccent}
                          onChangeTheme={setTheme}
                          accessibility={accessibility}
                          subtitleStyle={subtitleStyle}
                          bookmarks={activeBookmarks}
                          resumeTime={activeResumeTime}
                          currentTime={currentTime}
                          duration={duration}
                          bufferedPct={bufferedPct}
                          playbackRate={playbackRate}
                          volumePct={volumePct}
                          muted={muted}
                          isPlaying={isPlaying}
                          selectedQuality={selectedQuality}
                          onSelectQuality={setSelectedQuality}
                          onAddBookmark={() => handleAddBookmark()}
                          onJumpToTime={handleJumpToTime}
                          onPrevReel={handlePrevReel}
                          onNextReel={handleNextReel}
                          onDownload={handleDownloadClip}
                          keymap={keymap}
                          forceControlsVisible={forceControls}
                          showInPlayerBadge={showInPlayerBadge}
                          showSignalBattery={showSignalBattery}
                          onToggleSignalBattery={() => setShowSignalBattery((v) => !v)}
                          showTime={showTime}
                          onToggleTime={() => setShowTime((v) => !v)}
                          nightAudioMode={nightAudioMode}
                          onChangeNightAudioMode={setNightAudioMode}
                          nightCompressionDb={nightCompressionDb}
                          flashGuardMode={flashGuardMode}
                          onChangeFlashGuardMode={setFlashGuardMode}
                          flashGuard={flashGuard}
                          isPip={isPip}
                          onTogglePip={handleTogglePip}
                          backdropMode={backdropMode}
                          ambientRgb={ambientRgb}
                        >
                          {useHlsAdapter ? (
                            <HlsJsVideo
                              ref={handleVideoRef}
                              mediaRef={handleMediaAdapterRef}
                              src={activeSrc}
                              playsInline
                              crossOrigin="anonymous"
                              preload="auto"
                              onError={handleVideoError}
                            >
                              <track
                                kind="chapters"
                                src={activeReel.chaptersUrl}
                                srcLang="en"
                                label="Chapters"
                                default
                              />
                              <track
                                kind="captions"
                                src={activeReel.captionsUrl}
                                srcLang="en"
                                label="English"
                              />
                            </HlsJsVideo>
                          ) : (
                            <Video
                              ref={handleVideoRef}
                              src={activeSrc}
                              playsInline
                              crossOrigin={streamSupportsCors ? 'anonymous' : undefined}
                              preload="auto"
                              onError={handleVideoError}
                            >
                              <track
                                kind="chapters"
                                src={activeReel.chaptersUrl}
                                srcLang="en"
                                label="Chapters"
                                default
                              />
                              <track
                                kind="captions"
                                src={activeReel.captionsUrl}
                                srcLang="en"
                                label="English"
                              />
                            </Video>
                          )}
                        </CadenceVideoSkin>
                      </VideoPlayer>
                    </div>
                  </div>

                  {/* Secondary (A/B Compare Mode): Default Video.js v10 VideoSkin */}
                  {compareMode && (
                    <div className="w-full rounded-2xl border border-white/15 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.7)] overflow-hidden">
                      <div className="px-3.5 py-2 border-b border-white/10 bg-[#121215] flex items-center justify-between text-xs font-mono-tabular">
                        <span className="text-zinc-200 font-semibold">
                          B · Video.js v10 Default
                        </span>
                        <span className="text-zinc-400">@videojs/react/video</span>
                      </div>
                      <div className="aspect-video w-full relative">
                        <VideoPlayer
                          key={`compare-${activeReel.id}-${muxPlaybackId}-${isUsingFallback ? 'fb' : 'cdn'}`}
                        >
                          <VideoSkin>
                            {useHlsAdapter ? (
                              <HlsJsVideo
                                src={activeSrc}
                                poster={activePoster}
                                playsInline
                                crossOrigin="anonymous"
                                preload="metadata"
                              />
                            ) : (
                              <Video
                                src={activeSrc}
                                poster={activePoster}
                                playsInline
                                crossOrigin={streamSupportsCors ? 'anonymous' : undefined}
                                preload="metadata"
                              />
                            )}
                          </VideoSkin>
                        </VideoPlayer>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Reel Caption & Viewport Indicator */}
              <div className="w-full mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400 no-print">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-zinc-200 truncate">{activeTitle}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">
                    {backdropMode !== 'video'
                      ? `Contrast Test Backdrop: ${backdropMode === 'white' ? 'Pure #FFFFFF' : 'Pure #000000'}`
                      : isCustomMux
                        ? 'Mux HLS Stream via @videojs/react/media/hlsjs-video'
                        : activeReel.subtitle}
                  </span>
                </div>
                <div className="font-mono-tabular text-zinc-400 shrink-0">
                  Viewport:{' '}
                  {compareMode
                    ? 'A/B Side-by-Side'
                    : viewport === 'desktop'
                      ? 'Responsive 100%'
                      : viewport === 'tablet'
                        ? '640px Container'
                        : viewport === 'mobile375'
                          ? '375px Mobile'
                          : '320px Ultra-Compact'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Pulse Instrument Workbench */}
        <SkinTestbench
          reels={VIDEO_REELS}
          activeReelId={activeReelId}
          onSelectReel={handleSelectReel}
          onPrevReel={handlePrevReel}
          onNextReel={handleNextReel}
          viewport={viewport}
          onSelectViewport={setViewport}
          theme={theme}
          onSelectTheme={setTheme}
          customAccent={customAccent}
          onChangeCustomAccent={setCustomAccent}
          accessibility={accessibility}
          onUpdateAccessibility={(patch) =>
            setAccessibility((prev) => ({ ...prev, ...patch }))
          }
          flashGuardMode={flashGuardMode}
          onChangeFlashGuardMode={setFlashGuardMode}
          subtitleStyle={subtitleStyle}
          onUpdateSubtitleStyle={(patch) =>
            setSubtitleStyle((prev) => ({ ...prev, ...patch }))
          }
          keymap={keymap}
          onUpdateKeymap={setKeymap}
          bookmarks={activeBookmarks}
          currentTime={currentTime}
          resumeTime={activeResumeTime}
          onAddBookmark={handleAddBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onJumpToTime={handleJumpToTime}
          onClearWatchHistory={handleClearWatchHistory}
          cinemaMode={cinemaMode}
          onToggleCinemaMode={() => setCinemaMode((v) => !v)}
          compareMode={compareMode}
          onToggleCompareMode={() => setCompareMode((v) => !v)}
          forceControls={forceControls}
          onToggleForceControls={() => setForceControls((v) => !v)}
          showInPlayerBadge={showInPlayerBadge}
          onToggleInPlayerBadge={() => setShowInPlayerBadge((v) => !v)}
          muxPlaybackId={muxPlaybackId}
          onLoadMuxPlaybackId={handleLoadMuxPlaybackId}
          isUsingFallback={isUsingFallback}
          backdropMode={backdropMode}
          onChangeBackdropMode={handleChangeBackdropMode}
          focusedControl={focusedControl}
          verifiedKeys={verifiedKeys}
          lastKeyPressed={lastKeyPressed}
          onFocusPlayer={focusPlayerContainer}
          onResetAudit={handleResetAudit}
        />

        {/* Pixel-Perfect Tag Badge Studio */}
        <TagBadgeShowcase />

        {/* Design Thinking & Challenge Submission Notes */}
        <DesignNotesSection />
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/10 py-8 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <span>Pulse Player UI · Built with Video.js v10 (@videojs/react)</span>
          <span>Licensed under Apache License, Version 2.0 · #Video.js Skins Design Challenge</span>
        </div>
      </footer>
    </div>
  );
}
