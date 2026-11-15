import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

const DESIGN_THINKING_COPY = `Pulse (Cadence) is a custom Video.js v10 skin built on @videojs/react 10.4.0 pairing cinema-monitor ergonomics with an adaptive obsidian glass HUD. Live frame color sampling harmonizes accent glows and the laser scrubber with the active footage, while a dual-edge gradient scrim and 1px hairline framing maintain crisp legibility across pure #FFFFFF glare and #000000 cinema scenes. Beyond standard transport, speed, quality, WebVTT captions/chapters, and resilient native-or-floating Picture-in-Picture, the skin introduces two accessibility-first Web engines: Voice-Isolated Night Mode (a 6-stage Web Audio vocal EQ and Whisper Compressor with live dB peak-taming telemetry) and Photosensitive Flash Guard (real-time BT.709 luminance, red-flash, and 3 Hz strobe clamping). Mobile touch adds double-tap edge ripples (±10s) and vertical-swipe Brightness/Volume HUD controls, backed by @container scaling down to 320px, remappable hotkeys, frame bookmarks, and reduced-motion/high-contrast overrides.`;

export function DesignNotesSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DESIGN_THINKING_COPY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="design-notes" className="py-20 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Design Thinking */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-mono-tabular text-amber-400 mb-3 tracking-wide">
                03. Design Thinking
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#F4F4F0] text-balance">
                Engineered for contrast, acoustic clarity, and photosensitive safety
              </h2>
            </div>

            <div className="space-y-4 text-sm sm:text-base text-zinc-300 leading-relaxed">
              <p>
                Video interfaces break most visibly at luminance extremes: unbacked white glyphs vanish over bright skies and snow, while flat black bars disappear into dark cinema frames. Pulse anchors every control with measured dual-stop gradient scrims, subtle hairline framing, and real-time frame color sampling verified directly against pure <code className="font-mono-tabular text-xs text-amber-300 bg-white/8 px-1.5 py-0.5 rounded">#FFFFFF</code> and <code className="font-mono-tabular text-xs text-amber-300 bg-white/8 px-1.5 py-0.5 rounded">#000000</code> test backdrops.
              </p>
              <p>
                Built natively on <code className="font-mono-tabular text-xs text-amber-300 bg-white/8 px-1.5 py-0.5 rounded">@videojs/react</code> v10 primitives, every menu, slider, popover, and hotkey preserves full ARIA semantics, Escape-to-close behavior, and <code className="font-mono-tabular text-xs text-amber-300 bg-white/8 px-1.5 py-0.5 rounded">tabular-nums</code> timecodes. Sliding toggle switches in Settings cleanly expose Signal &amp; Battery, Live Time, Night Whisper, and Flash Guard without crowding the player canvas.
              </p>
              <p>
                For real-world viewing comfort, two client-side protection pipelines run directly in the browser: <strong className="text-[#F4F4F0] font-medium">Voice-Isolated Night Mode</strong> lifts whispered dialogue via Web Audio vocal EQ and dynamic peak compression, while <strong className="text-[#F4F4F0] font-medium">Photosensitive Flash Guard</strong> intercepts sudden luminance spikes, red flashes, and 3 Hz strobes with instant optical attenuation—paired with mobile double-tap edge ripples and vertical-swipe brightness and volume gestures.
              </p>
            </div>

            {/* Copy-ready Challenge Description Box */}
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-5 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-[#F4F4F0]">
                  Submission Description Copy
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-mono-tabular text-amber-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy Summary</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {DESIGN_THINKING_COPY}
              </p>
            </div>
          </div>

          {/* Right Column: Challenge Checklist Verification */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-6 space-y-5">
              <h3 className="font-display text-lg font-semibold text-[#F4F4F0]">
                Challenge Readiness Audit
              </h3>
              <ul className="divide-y divide-white/8 text-sm">
                {[
                  {
                    title: 'Video.js v10 & Resilient Media',
                    detail: '@videojs/react 10.4.0, HlsJsVideo Mux ABR streams, WebVTT chapters & captions, and silent synthetic WebM fallback',
                  },
                  {
                    title: 'Transport, PiP & Laser Scrubber',
                    detail: 'Play/pause, ±10s seek, thumbnail + chapter preview, speed & quality menus, frame bookmarks, resume history, and native + floating PiP',
                  },
                  {
                    title: 'Voice-Isolated Night Mode (N)',
                    detail: '6-stage Web Audio vocal EQ & Whisper Compressor (up to 10:1 ratio) with live dB peak-taming telemetry',
                  },
                  {
                    title: 'Photosensitive Flash Guard (G)',
                    detail: 'Real-time BT.709 luminance spike, red-flash, and 3 Hz strobe clamping via Balanced & Strict optical curves',
                  },
                  {
                    title: 'Touch Gestures & Container Scaling',
                    detail: 'Double-tap left/right edge ripples, vertical-swipe Brightness/Volume HUD, and 44px touch targets down to 320px',
                  },
                  {
                    title: 'WCAG Contrast, Keyboard & A11y',
                    detail: 'Live #FFF/#000 contrast audit, remappable keybindings, High Contrast (>10:1), Calm Motion, Solid HUD, Dyslexic Font, and cue styling',
                  },
                ].map((item) => (
                  <li key={item.title} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="font-medium text-[#F4F4F0]">{item.title}</div>
                    <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {item.detail}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
