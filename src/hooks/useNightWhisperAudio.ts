import { useEffect, useState } from 'react';
import type { NightAudioMode } from '../types/pulse';

interface AudioGraph {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  highpass: BiquadFilterNode;
  lowMidCut: BiquadFilterNode;
  vocalPresence: BiquadFilterNode;
  highSoften: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  mode: 'bypass' | 'dsp';
}

const elementGraphMap = new WeakMap<HTMLVideoElement, AudioGraph>();

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? win.webkitAudioContext ?? null;
}

function getOrCreateGraph(video: HTMLVideoElement): AudioGraph | null {
  const existing = elementGraphMap.get(video);
  if (existing) return existing;

  const AudioCtx = getAudioContextClass();
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(video);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.Q.value = 0.707;

    const lowMidCut = ctx.createBiquadFilter();
    lowMidCut.type = 'peaking';
    lowMidCut.frequency.value = 260;
    lowMidCut.Q.value = 1.0;

    const vocalPresence = ctx.createBiquadFilter();
    vocalPresence.type = 'peaking';
    vocalPresence.frequency.value = 2350;
    vocalPresence.Q.value = 0.9;

    const highSoften = ctx.createBiquadFilter();
    highSoften.type = 'highshelf';
    highSoften.frequency.value = 6800;

    const compressor = ctx.createDynamicsCompressor();
    const makeupGain = ctx.createGain();

    // Start in clean bypass until DSP parameters are applied
    source.connect(ctx.destination);

    const graph: AudioGraph = {
      ctx,
      source,
      highpass,
      lowMidCut,
      vocalPresence,
      highSoften,
      compressor,
      makeupGain,
      mode: 'bypass',
    };
    elementGraphMap.set(video, graph);
    return graph;
  } catch {
    return null;
  }
}

function applyNightModeParams(graph: AudioGraph, mode: NightAudioMode): void {
  const now = graph.ctx.currentTime;

  if (mode === 'off') {
    if (graph.mode !== 'bypass') {
      try {
        graph.source.disconnect();
        graph.makeupGain.disconnect();
      } catch {
        // Ignore disconnect errors if already detached
      }
      graph.source.connect(graph.ctx.destination);
      graph.mode = 'bypass';
    }
    return;
  }

  if (graph.mode !== 'dsp') {
    try {
      graph.source.disconnect();
    } catch {
      // Ignore
    }
    graph.source.connect(graph.highpass);
    graph.highpass.connect(graph.lowMidCut);
    graph.lowMidCut.connect(graph.vocalPresence);
    graph.vocalPresence.connect(graph.highSoften);
    graph.highSoften.connect(graph.compressor);
    graph.compressor.connect(graph.makeupGain);
    graph.makeupGain.connect(graph.ctx.destination);
    graph.mode = 'dsp';
  }

  if (mode === 'voice') {
    graph.highpass.frequency.setTargetAtTime(115, now, 0.03);
    graph.lowMidCut.gain.setTargetAtTime(-2.5, now, 0.03);
    graph.vocalPresence.gain.setTargetAtTime(4.5, now, 0.03);
    graph.highSoften.gain.setTargetAtTime(-1.5, now, 0.03);

    graph.compressor.threshold.setTargetAtTime(-20, now, 0.03);
    graph.compressor.knee.setTargetAtTime(14, now, 0.03);
    graph.compressor.ratio.setTargetAtTime(4.5, now, 0.03);
    graph.compressor.attack.setTargetAtTime(0.006, now, 0.03);
    graph.compressor.release.setTargetAtTime(0.2, now, 0.03);
    graph.makeupGain.gain.setTargetAtTime(1.22, now, 0.04);
  } else {
    // 'whisper' — Deep Voice-Isolated Night Mode (Whisper Compressor)
    graph.highpass.frequency.setTargetAtTime(155, now, 0.03);
    graph.lowMidCut.gain.setTargetAtTime(-4.2, now, 0.03);
    graph.vocalPresence.gain.setTargetAtTime(6.5, now, 0.03);
    graph.highSoften.gain.setTargetAtTime(-3.5, now, 0.03);

    graph.compressor.threshold.setTargetAtTime(-30, now, 0.03);
    graph.compressor.knee.setTargetAtTime(12, now, 0.03);
    graph.compressor.ratio.setTargetAtTime(10, now, 0.03);
    graph.compressor.attack.setTargetAtTime(0.003, now, 0.03);
    graph.compressor.release.setTargetAtTime(0.24, now, 0.03);
    graph.makeupGain.gain.setTargetAtTime(1.52, now, 0.04);
  }
}

export function useNightWhisperAudio(
  videoEl: HTMLVideoElement | null,
  mode: NightAudioMode,
  corsEnabled: boolean
): {
  compressionDb: number;
  dspAvailable: boolean;
} {
  const [compressionDb, setCompressionDb] = useState<number>(0);
  const [dspAvailable, setDspAvailable] = useState<boolean>(true);

  useEffect(() => {
    if (!videoEl) return;

    const existing = elementGraphMap.get(videoEl);

    if (mode === 'off') {
      if (existing) {
        applyNightModeParams(existing, 'off');
      }
      setCompressionDb(0);
      return;
    }

    if (!corsEnabled && !existing) {
      setDspAvailable(false);
      setCompressionDb(0);
      return;
    }

    const graph = getOrCreateGraph(videoEl);
    if (!graph) {
      setDspAvailable(false);
      return;
    }

    setDspAvailable(true);
    if (graph.ctx.state === 'suspended' && typeof graph.ctx.resume === 'function') {
      void graph.ctx.resume().catch(() => {});
    }
    applyNightModeParams(graph, mode);

    const onPlay = () => {
      if (graph.ctx.state === 'suspended' && typeof graph.ctx.resume === 'function') {
        void graph.ctx.resume().catch(() => {});
      }
    };
    videoEl.addEventListener('play', onPlay);

    const timer = window.setInterval(() => {
      if (videoEl.paused || videoEl.ended) {
        setCompressionDb((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const rawReduction = graph.compressor.reduction as unknown;
      const reductionVal =
        typeof rawReduction === 'number'
          ? rawReduction
          : typeof (rawReduction as { value?: unknown })?.value === 'number'
            ? (rawReduction as { value: number }).value
            : 0;
      const red = Math.round(reductionVal * 10) / 10;
      const next = Math.abs(red) < 0.1 ? 0 : red;
      setCompressionDb((prev) => (prev === next ? prev : next));
    }, 350);

    return () => {
      window.clearInterval(timer);
      videoEl.removeEventListener('play', onPlay);
    };
  }, [videoEl, mode, corsEnabled]);

  useEffect(() => {
    if (!videoEl) return;
    return () => {
      const target = videoEl;
      window.setTimeout(() => {
        if (target.isConnected) return;
        const graph = elementGraphMap.get(target);
        if (graph) {
          elementGraphMap.delete(target);
          if (graph.ctx.state !== 'closed' && typeof graph.ctx.close === 'function') {
            void graph.ctx.close().catch(() => {});
          }
        }
      }, 0);
    };
  }, [videoEl]);

  return { compressionDb, dspAvailable };
}
