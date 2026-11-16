import { useEffect, useRef, useState } from 'react';

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parseHexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [255, 107, 0];
}

function normalizeVibrantRgb(r: number, g: number, b: number): [number, number, number] {
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  let nr = r;
  let ng = g;
  let nb = b;

  if (lum > 0 && lum < 130) {
    const boost = Math.min(2.6, 130 / lum);
    nr = r * boost;
    ng = g * boost;
    nb = b * boost;
  } else if (lum <= 1) {
    return [226, 232, 240];
  }

  const avg = (nr + ng + nb) / 3;
  const satBoost = 1.24;
  nr = avg + (nr - avg) * satBoost;
  ng = avg + (ng - avg) * satBoost;
  nb = avg + (nb - avg) * satBoost;

  return [clampChannel(nr), clampChannel(ng), clampChannel(nb)];
}

export function useLiveColorSampling(
  videoElement: HTMLVideoElement | null,
  posterUrl: string | undefined,
  enabled: boolean,
  initialThemeHex = '#FF6B00',
  resetKey = ''
): string {
  const initialTuple = parseHexToRgbTuple(initialThemeHex);
  const [ambientRgb, setAmbientRgb] = useState<string>(
    `${initialTuple[0]}, ${initialTuple[1]}, ${initialTuple[2]}`
  );
  const displayRgbRef = useRef<[number, number, number]>(initialTuple);
  const targetRgbRef = useRef<[number, number, number]>(initialTuple);
  const hasVideoSampleRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Start immediately on the active theme color whenever theme, custom accent, or video changes
  useEffect(() => {
    const base = parseHexToRgbTuple(initialThemeHex);
    displayRgbRef.current = base;
    targetRgbRef.current = base;
    hasVideoSampleRef.current = false;
    setAmbientRgb(`${base[0]}, ${base[1]}, ${base[2]}`);
  }, [initialThemeHex, resetKey]);

  useEffect(() => {
    if (!enabled) return;

    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 5;
      canvasRef.current = c;
    }

    const stepBlendTowardTarget = (lerpFactor: number) => {
      if (!hasVideoSampleRef.current) return;
      const cur = displayRgbRef.current;
      const tgt = targetRgbRef.current;
      const next: [number, number, number] = [
        clampChannel(cur[0] + (tgt[0] - cur[0]) * lerpFactor),
        clampChannel(cur[1] + (tgt[1] - cur[1]) * lerpFactor),
        clampChannel(cur[2] + (tgt[2] - cur[2]) * lerpFactor),
      ];
      const delta =
        Math.abs(next[0] - cur[0]) +
        Math.abs(next[1] - cur[1]) +
        Math.abs(next[2] - cur[2]);
      if (delta >= 6) {
        displayRgbRef.current = next;
        setAmbientRgb(`${next[0]}, ${next[1]}, ${next[2]}`);
      }
    };

    const sampleElement = (
      source: HTMLVideoElement | HTMLImageElement,
      lerpFactor: number
    ): boolean => {
      if (source instanceof HTMLVideoElement) {
        if (source.videoWidth === 0 || source.videoHeight === 0) return false;
      } else if (source.naturalWidth === 0 || source.naturalHeight === 0) {
        return false;
      }

      const canvas = canvasRef.current;
      const ctx =
        canvas?.getContext('2d', { willReadFrequently: true }) ??
        canvas?.getContext('2d');
      if (!canvas || !ctx) return false;

      try {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          if (lum > 14 && lum < 246) {
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const chroma = maxC - minC;
            const weight = 1 + (chroma / 255) * 4.5;
            rSum += r * weight;
            gSum += g * weight;
            bSum += b * weight;
            weightSum += weight;
          }
        }

        if (weightSum > 0) {
          targetRgbRef.current = normalizeVibrantRgb(
            rSum / weightSum,
            gSum / weightSum,
            bSum / weightSum
          );
          hasVideoSampleRef.current = true;
          stepBlendTowardTarget(lerpFactor);
          return true;
        }
      } catch {
        // Cross-origin tainted canvas falls back to poster sampling
      }
      return false;
    };

    let posterImg: HTMLImageElement | null = null;
    if (posterUrl) {
      posterImg = new Image();
      posterImg.crossOrigin = 'anonymous';
      posterImg.src = posterUrl;
    }

    const sampleWhenPlayingOrSeeked = (lerpFactor: number) => {
      if (videoElement && videoElement.readyState >= 2) {
        if (!videoElement.paused || videoElement.currentTime > 0.35) {
          const ok = sampleElement(videoElement, lerpFactor);
          if (!ok && posterImg?.complete && posterImg.naturalWidth > 0) {
            sampleElement(posterImg, lerpFactor);
          }
        }
      }
    };

    const onPlay = () => sampleWhenPlayingOrSeeked(0.18);
    const onSeeked = () => sampleWhenPlayingOrSeeked(0.45);

    if (videoElement) {
      if (!videoElement.paused || videoElement.currentTime > 0.35) {
        sampleWhenPlayingOrSeeked(0.22);
      }
      videoElement.addEventListener('play', onPlay);
      videoElement.addEventListener('seeked', onSeeked);
    }

    const interval = window.setInterval(() => {
      if (videoElement && videoElement.readyState >= 2 && !videoElement.paused) {
        sampleWhenPlayingOrSeeked(0.28);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      if (videoElement) {
        videoElement.removeEventListener('play', onPlay);
        videoElement.removeEventListener('seeked', onSeeked);
      }
    };
  }, [videoElement, posterUrl, enabled, initialThemeHex, resetKey]);

  return ambientRgb;
}
