import { useEffect, useRef } from 'react';
import type { AudioBandsData } from '../hooks/useAudioVisualizer';
import type { PulseThemeId } from '../types/pulse';

interface PulseAudioCanvasProps {
  data: AudioBandsData;
  theme: PulseThemeId;
  accentColor: string;
  reducedMotion: boolean;
}

export function PulseAudioCanvas({
  data,
  theme,
  accentColor,
  reducedMotion,
}: PulseAudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 180;
    const height = 28;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const bassColor = theme === 'oscilloscope' ? '#10F56E' : accentColor;
    const midColor = theme === 'oscilloscope' ? '#38BDF8' : '#10B981';
    const trebleColor = theme === 'oscilloscope' ? '#A7F3D0' : '#FBBF24';

    const drawBand = (values: number[], color: string, yOffset: number, amp: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.35;
      const step = width / Math.max(1, values.length - 1);
      values.forEach((v, idx) => {
        const x = idx * step;
        const y = height - yOffset - (reducedMotion ? 2 : v * amp);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // Grid baseline
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 3);
    ctx.lineTo(width, height - 3);
    ctx.stroke();

    drawBand(data.bass, bassColor, 3, 21);
    drawBand(data.mid, midColor, 3, 17);
    drawBand(data.treble, trebleColor, 3, 13);

    ctx.restore();
  }, [data, theme, accentColor, reducedMotion]);

  const ampPct = Math.round((reducedMotion ? 0.15 : data.amplitude) * 100);

  return (
    <div
      className="hidden sm:inline-flex items-center gap-2.5 px-2.5 py-1 rounded-lg bg-transparent border border-white/12 shrink-0"
      aria-label="Audio frequency spectrum: Bass, Mid, Treble"
    >
      <div className="flex flex-col leading-none gap-0.5 text-[9px] font-mono-tabular">
        <span style={{ color: theme === 'oscilloscope' ? '#10F56E' : accentColor }}>
          BASS
        </span>
        <span className="text-emerald-400">MID</span>
        <span className="text-amber-300">HI</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-[140px] md:w-[180px] h-[28px] block"
      />

      {/* Live Vertical Audio Amplitude Meter */}
      <div
        className="w-1.5 h-6 rounded-full bg-white/10 overflow-hidden flex items-end"
        title={`Amplitude: ${ampPct}%`}
      >
        <div
          className="w-full rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(12, ampPct)}%`,
            backgroundColor: theme === 'oscilloscope' ? '#10F56E' : accentColor,
            boxShadow: `0 0 8px ${theme === 'oscilloscope' ? '#10F56E' : accentColor}`,
          }}
        />
      </div>
    </div>
  );
}
