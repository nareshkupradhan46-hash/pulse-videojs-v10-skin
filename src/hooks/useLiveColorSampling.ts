import { useEffect, useRef, useState } from 'react';

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
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
  enabled: boolean
): string {
  const [ambientRgb, setAmbientRgb] = useState<string>('255, 107, 0');
  const lastRgbRef = useRef<[number, number, number]>([255, 107, 0]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 8;
      c.height = 5;
      canvasRef.current = c;
    }

    const commitRgb = (next: [number, number, number]) => {
      const prev = lastRgbRef.current;
      const delta =
        Math.abs(next[0] - prev[0]) +
        Math.abs(next[1] - prev[1]) +
        Math.abs(next[2] - prev[2]);
      if (delta >= 12) {
        lastRgbRef.current = next;
        setAmbientRgb(`${next[0]}, ${next[1]}, ${next[2]}`);
      }
    };

    const sampleElement = (source: HTMLVideoElement | HTMLImageElement): boolean => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
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
          commitRgb(
            normalizeVibrantRgb(
              rSum / weightSum,
              gSum / weightSum,
              bSum / weightSum
            )
          );
          return true;
        }
      } catch {
        // Cross-origin tainted canvas falls back to poster sampling
      }
      return false;
    };

    if (posterUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!videoElement || videoElement.readyState < 2) {
          sampleElement(img);
        }
      };
      img.src = posterUrl;
    }

    const sampleVideoIfReady = () => {
      if (videoElement && videoElement.readyState >= 2) {
        sampleElement(videoElement);
      }
    };

    if (videoElement) {
      sampleVideoIfReady();
      videoElement.addEventListener('loadeddata', sampleVideoIfReady);
      videoElement.addEventListener('canplay', sampleVideoIfReady);
      videoElement.addEventListener('seeked', sampleVideoIfReady);
      videoElement.addEventListener('play', sampleVideoIfReady);
    }

    const interval = window.setInterval(() => {
      if (videoElement && videoElement.readyState >= 2 && !videoElement.paused) {
        sampleElement(videoElement);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      if (videoElement) {
        videoElement.removeEventListener('loadeddata', sampleVideoIfReady);
        videoElement.removeEventListener('canplay', sampleVideoIfReady);
        videoElement.removeEventListener('seeked', sampleVideoIfReady);
        videoElement.removeEventListener('play', sampleVideoIfReady);
      }
    };
  }, [videoElement, posterUrl, enabled]);

  return ambientRgb;
}
