import { useEffect, useRef, useState } from 'react';
import type { FlashGuardMode } from '../types/pulse';

export interface FlashGuardState {
  brightnessFactor: number;
  contrastFactor: number;
  veilOpacity: number;
  attenuationPct: number;
  dampenedCount: number;
  activeAlert: boolean;
  guardAvailable: boolean;
}

const NEUTRAL_STATE: FlashGuardState = {
  brightnessFactor: 1,
  contrastFactor: 1,
  veilOpacity: 0,
  attenuationPct: 0,
  dampenedCount: 0,
  activeAlert: false,
  guardAvailable: true,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function useFlashGuard(
  videoEl: HTMLVideoElement | null,
  mode: FlashGuardMode,
  corsEnabled: boolean
): FlashGuardState {
  const [state, setState] = useState<FlashGuardState>(NEUTRAL_STATE);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!videoEl || mode === 'off') {
      setState(NEUTRAL_STATE);
      return;
    }

    if (!corsEnabled) {
      setState({ ...NEUTRAL_STATE, guardAvailable: false });
      return;
    }

    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 9;
      canvasRef.current = c;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // WCAG 2.3.1-inspired thresholds tuned by preset
    const jumpThreshold = mode === 'strict' ? 0.085 : 0.145;
    const redThreshold = mode === 'strict' ? 0.14 : 0.22;
    const glareCeiling = mode === 'strict' ? 0.72 : 0.84;
    const minBrightness = mode === 'strict' ? 0.36 : 0.5;
    const minContrast = mode === 'strict' ? 0.66 : 0.78;
    const maxVeil = mode === 'strict' ? 0.5 : 0.36;
    const strobeTriggerCount = mode === 'strict' ? 2 : 3;

    let rafId = 0;
    let cancelled = false;
    let lastSampleTime = 0;
    let lastUiSyncTime = 0;

    let prevLuma: number | null = null;
    let prevRedness: number | null = null;
    let prevDeltaSign = 0;
    const transitionTimestamps: number[] = [];

    let currentSuppression = 0; // 0 = neutral, 1 = max clamp
    let lastClampEventTime = 0;
    let dampenedCount = 0;
    let guardAvailable = true;

    const sampleFrame = (now: number) => {
      if (cancelled) return;
      rafId = requestAnimationFrame(sampleFrame);

      if (videoEl.readyState < 2) return;

      const dt = lastSampleTime > 0 ? now - lastSampleTime : 66;
      if (dt < 66) return;
      lastSampleTime = now;

      let luma = 0;
      let redness = 0;

      if (!videoEl.paused && !videoEl.ended) {
        try {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixelCount = data.length / 4;

          let lumaSum = 0;
          let redSum = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            // Perceptual BT.709 relative luminance
            lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            // Saturated red excess for WCAG red-flash detection
            redSum += Math.max(0, r - Math.max(g, b));
          }

          luma = lumaSum / pixelCount;
          redness = redSum / pixelCount;
          guardAvailable = true;
        } catch {
          guardAvailable = false;
        }
      }

      if (!guardAvailable) {
        if (now - lastUiSyncTime > 300) {
          lastUiSyncTime = now;
          setState((prev) =>
            prev.guardAvailable ? { ...NEUTRAL_STATE, guardAvailable: false } : prev
          );
        }
        return;
      }

      let targetSuppression = 0;

      if (!videoEl.paused && !videoEl.ended && prevLuma !== null && prevRedness !== null) {
        const deltaLuma = luma - prevLuma;
        const absDeltaLuma = Math.abs(deltaLuma);
        const deltaRed = Math.abs(redness - prevRedness);

        // Track opposing luminance transitions within a rolling 1s window
        if (absDeltaLuma >= jumpThreshold * 0.65) {
          const sign = deltaLuma > 0 ? 1 : -1;
          if (prevDeltaSign !== 0 && sign !== prevDeltaSign) {
            transitionTimestamps.push(now);
          }
          prevDeltaSign = sign;
        }

        while (transitionTimestamps.length > 0 && now - transitionTimestamps[0] > 1000) {
          transitionTimestamps.shift();
        }

        const isStrobeSequence = transitionTimestamps.length >= strobeTriggerCount;
        const isBrightSpike = deltaLuma >= jumpThreshold;
        const isDarkToBrightFlash = prevLuma < 0.26 && deltaLuma >= jumpThreshold * 0.78;
        const isRedFlash = deltaRed >= redThreshold && redness > 0.2;

        if (isStrobeSequence || isBrightSpike || isDarkToBrightFlash || isRedFlash) {
          const spikeStrength = clamp(
            Math.max(
              absDeltaLuma / (jumpThreshold * 2.2),
              isRedFlash ? deltaRed / (redThreshold * 1.8) : 0,
              isStrobeSequence ? 0.88 : 0
            ),
            0.42,
            1
          );
          targetSuppression = Math.max(targetSuppression, spikeStrength);

          if (now - lastClampEventTime > 420) {
            dampenedCount += 1;
            lastClampEventTime = now;
          }
        }

        // Sustained high-glare soft ceiling
        if (luma > glareCeiling) {
          const glareExcess = clamp((luma - glareCeiling) / (1 - glareCeiling), 0, 1);
          targetSuppression = Math.max(targetSuppression, glareExcess * 0.55);
        }
      }

      if (!videoEl.paused && !videoEl.ended) {
        prevLuma = luma;
        prevRedness = redness;
      } else {
        prevLuma = null;
        prevRedness = null;
      }

      // Fast attack (instant protection) + smooth exponential release (no jarring pump)
      if (targetSuppression > currentSuppression) {
        currentSuppression = currentSuppression + (targetSuppression - currentSuppression) * 0.85;
      } else {
        const decay = Math.exp(-dt / (mode === 'strict' ? 760 : 560));
        currentSuppression = targetSuppression + (currentSuppression - targetSuppression) * decay;
        if (currentSuppression < 0.015) currentSuppression = 0;
      }

      const brightnessFactor = 1 - (1 - minBrightness) * currentSuppression;
      const contrastFactor = 1 - (1 - minContrast) * currentSuppression;
      const veilOpacity = maxVeil * currentSuppression;

      const skinNode = videoEl.closest('.cadence-skin') as HTMLElement | null;
      if (skinNode) {
        skinNode.style.setProperty('--pulse-guard-brightness', brightnessFactor.toFixed(3));
        skinNode.style.setProperty('--pulse-guard-contrast', contrastFactor.toFixed(3));
        skinNode.style.setProperty('--pulse-guard-veil', veilOpacity.toFixed(3));
      }

      if (now - lastUiSyncTime >= 250) {
        lastUiSyncTime = now;
        const attenuationPct = Math.round((1 - brightnessFactor) * 100);
        const activeAlert = attenuationPct >= 5;

        setState((prev) => {
          if (
            prev.attenuationPct === attenuationPct &&
            prev.dampenedCount === dampenedCount &&
            prev.activeAlert === activeAlert &&
            prev.guardAvailable === guardAvailable
          ) {
            return prev;
          }
          return {
            brightnessFactor: Number(brightnessFactor.toFixed(3)),
            contrastFactor: Number(contrastFactor.toFixed(3)),
            veilOpacity: Number(veilOpacity.toFixed(3)),
            attenuationPct,
            dampenedCount,
            activeAlert,
            guardAvailable,
          };
        });
      }
    };

    rafId = requestAnimationFrame(sampleFrame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      const skinNode = videoEl.closest('.cadence-skin') as HTMLElement | null;
      if (skinNode) {
        skinNode.style.setProperty('--pulse-guard-brightness', '1');
        skinNode.style.setProperty('--pulse-guard-contrast', '1');
        skinNode.style.setProperty('--pulse-guard-veil', '0');
      }
    };
  }, [videoEl, mode, corsEnabled]);

  return state;
}
