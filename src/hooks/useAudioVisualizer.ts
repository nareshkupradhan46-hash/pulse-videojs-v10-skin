import { useEffect, useRef, useState } from 'react';

export interface AudioBandsData {
  bass: number[];
  mid: number[];
  treble: number[];
  amplitude: number;
  usingRealAnalyser: boolean;
}

const BAND_POINTS = 28;

export function useAudioVisualizer(
  videoElement: HTMLVideoElement | null,
  active: boolean,
  reducedMotion: boolean
): AudioBandsData {
  const [data, setData] = useState<AudioBandsData>(() => ({
    bass: Array(BAND_POINTS).fill(0.08),
    mid: Array(BAND_POINTS).fill(0.08),
    treble: Array(BAND_POINTS).fill(0.08),
    amplitude: 0,
    usingRealAnalyser: false,
  }));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceMapRef = useRef<WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>>(
    new WeakMap()
  );

  useEffect(() => {
    if (
      !videoElement ||
      !(videoElement instanceof HTMLMediaElement) ||
      !active ||
      reducedMotion
    ) {
      if (!active) {
        setData({
          bass: Array(BAND_POINTS).fill(0.06),
          mid: Array(BAND_POINTS).fill(0.06),
          treble: Array(BAND_POINTS).fill(0.06),
          amplitude: 0,
          usingRealAnalyser: false,
        });
      }
      return;
    }

    let rafId = 0;
    let cancelled = false;
    let analyserConnected = false;

    const tryAttachAnalyser = () => {
      try {
        const srcUrl = videoElement.currentSrc || videoElement.src || '';
        const isCorsSafe =
          Boolean(videoElement.crossOrigin) ||
          srcUrl.startsWith('blob:') ||
          srcUrl.startsWith(window.location.origin);

        if (!isCorsSafe) {
          return false;
        }

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return false;

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }

        if (!analyserRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.82;
          analyserRef.current = analyser;
        }

        let source = sourceMapRef.current.get(videoElement);
        if (!source) {
          source = ctx.createMediaElementSource(videoElement);
          sourceMapRef.current.set(videoElement, source);
          source.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        }
        return true;
      } catch {
        return false;
      }
    };

    analyserConnected = tryAttachAnalyser();
    const bufferLength = analyserRef.current?.frequencyBinCount ?? 64;
    const freqData = new Uint8Array(bufferLength);

    let lastTick = 0;
    const tick = (now: number) => {
      if (cancelled) return;

      if (now - lastTick >= 40) {
        lastTick = now;

        let hasLiveSignal = false;
        if (analyserConnected && analyserRef.current) {
          analyserRef.current.getByteFrequencyData(freqData);
          const sum = freqData.reduce((acc, v) => acc + v, 0);
          hasLiveSignal = sum > 16;
        }

        if (hasLiveSignal) {
          const bassSlice = freqData.slice(0, 8);
          const midSlice = freqData.slice(8, 28);
          const trebleSlice = freqData.slice(28, 56);

          const sampleBand = (slice: Uint8Array) =>
            Array.from({ length: BAND_POINTS }, (_, i) => {
              const idx = Math.floor((i / BAND_POINTS) * slice.length);
              return Math.max(0.06, Math.min(1, (slice[idx] ?? 0) / 255));
            });

          const totalAvg =
            freqData.reduce((acc, v) => acc + v, 0) / (freqData.length * 255);

          setData({
            bass: sampleBand(bassSlice),
            mid: sampleBand(midSlice),
            treble: sampleBand(trebleSlice),
            amplitude: Math.min(1, totalAvg * 1.8),
            usingRealAnalyser: true,
          });
        } else if (!videoElement.paused && !videoElement.ended) {
          // Graceful procedural frequency envelope when cross-origin audio track is silent/isolated
          const phase = now * 0.004;
          const makeWave = (offset: number, scale: number) =>
            Array.from({ length: BAND_POINTS }, (_, i) => {
              const v =
                0.28 +
                0.26 * Math.sin(phase + i * 0.45 + offset) +
                0.18 * Math.cos(phase * 1.7 - i * 0.3 + offset);
              return Math.max(0.08, Math.min(0.95, v * scale));
            });
          const amp = videoElement.muted ? 0.14 : 0.48 + 0.2 * Math.sin(phase * 1.3);
          setData({
            bass: makeWave(0, 1.0),
            mid: makeWave(2.1, 0.85),
            treble: makeWave(4.2, 0.72),
            amplitude: Math.max(0.08, Math.min(1, amp)),
            usingRealAnalyser: false,
          });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [videoElement, active, reducedMotion]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return data;
}
