import brightPoster from '../assets/images/poster_bright_daylight_1794564950680.jpg';
import darkPoster from '../assets/images/poster_dark_cinema_1794564951623.jpg';

export interface ReelSubtitleCue {
  start: number;
  end: number;
  text: string;
}

export interface ReelSubtitleTrack {
  id: string;
  lang: string;
  label: string;
  kind: 'subtitles' | 'captions';
  src: string;
  cues: ReelSubtitleCue[];
}

export interface VideoReel {
  id: string;
  title: string;
  subtitle: string;
  streamBadge: string;
  luminanceNote: string;
  src: string;
  muxPlaybackId?: string;
  isHls?: boolean;
  supportsCors?: boolean;
  poster: string;
  chaptersUrl: string;
  subtitleTracks: ReelSubtitleTrack[];
  introWindow?: [number, number];
}

function createBlobUrl(content: string, type: string): string {
  const blob = new Blob([content], { type });
  return URL.createObjectURL(blob);
}

function formatVttTimestamp(sec: number): string {
  const clamped = Math.max(0, sec);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function cuesToVtt(cues: ReelSubtitleCue[]): string {
  const blocks = cues.map(
    (c) => `${formatVttTimestamp(c.start)} --> ${formatVttTimestamp(c.end)}\n${c.text}`
  );
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

function parseTimestampSec(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function parseSubtitlesFile(rawText: string): {
  vttBlobUrl: string;
  cues: ReelSubtitleCue[];
} {
  const normalized = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  const vttText = normalized.trimStart().startsWith('WEBVTT')
    ? normalized
    : `WEBVTT\n\n${normalized}`;

  const cues: ReelSubtitleCue[] = [];
  const blocks = vttText.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [rawStart, rawEnd] = lines[timeIdx].split('-->');
    if (!rawStart || !rawEnd) continue;
    const start = parseTimestampSec(rawStart);
    const end = parseTimestampSec(rawEnd.trim().split(/\s+/)[0]);
    const text = lines
      .slice(timeIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text && end > start) {
      cues.push({ start, end, text });
    }
  }
  return {
    vttBlobUrl: createBlobUrl(vttText, 'text/vtt'),
    cues,
  };
}

function makeTracks(
  reelId: string,
  enCues: ReelSubtitleCue[],
  esCues: ReelSubtitleCue[]
): ReelSubtitleTrack[] {
  return [
    {
      id: `${reelId}-en`,
      lang: 'en',
      label: 'English (Scene CC)',
      kind: 'captions',
      src: createBlobUrl(cuesToVtt(enCues), 'text/vtt'),
      cues: enCues,
    },
    {
      id: `${reelId}-es`,
      lang: 'es',
      label: 'Español (CC)',
      kind: 'subtitles',
      src: createBlobUrl(cuesToVtt(esCues), 'text/vtt'),
      cues: esCues,
    },
  ];
}

const CHAPTERS_VTT = `WEBVTT

00:00.000 --> 00:06.000
01. Optical Frame & Telemetry

00:06.000 --> 00:14.000
02. Adaptive Color & Motion

00:14.000 --> 00:30.000
03. Precision Laser Scrubber
`;

export const VIDEO_REELS: VideoReel[] = [
  {
    id: 'oceans',
    title: 'Pacific Oceans — Coastal Aerial Reel',
    subtitle: 'Fast-Start MP4 · Deep Ocean Cyan & Sunlit Surf Luminance',
    streamBadge: 'v10 · NATURE MP4 · 01 / 04',
    luminanceNote: 'Coastal Aerial',
    src: 'https://vjs.zencdn.net/v/oceans.mp4',
    supportsCors: true,
    poster: brightPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    introWindow: [2, 8],
    subtitleTracks: makeTracks(
      'oceans',
      [
        { start: 0.4, end: 5.5, text: '[Gentle ocean swells rolling across deep Pacific water]' },
        { start: 6.0, end: 12.5, text: '[Seagulls gliding above sunlit whitewater surf]' },
        { start: 13.0, end: 21.0, text: '[Waves cresting along coastal rock formations]' },
        { start: 21.5, end: 32.0, text: '[Wide aerial pan over turquoise shoreline tide]' },
        { start: 32.5, end: 46.0, text: '[Ambient surf receding in golden afternoon light]' },
      ],
      [
        { start: 0.4, end: 5.5, text: '[Olas suaves avanzando sobre el Pacífico azul profundo]' },
        { start: 6.0, end: 12.5, text: '[Gaviotas planeando sobre la espuma iluminada por el sol]' },
        { start: 13.0, end: 21.0, text: '[Rompientes chocando contra los acantilados costeros]' },
        { start: 21.5, end: 32.0, text: '[Plano aéreo amplio sobre la marea turquesa]' },
        { start: 32.5, end: 46.0, text: '[Sonido ambiente del oleaje bajo la luz dorada]' },
      ]
    ),
  },
  {
    id: 'bright',
    title: 'Botanical Bloom — Macro Flora Reel',
    subtitle: '1.1 MB Instant-Play MP4 · Golden Petal & Emerald Palette',
    streamBadge: 'v10 · MACRO MP4 · 02 / 04',
    luminanceNote: 'High Chroma',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    supportsCors: true,
    poster: brightPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    subtitleTracks: makeTracks(
      'bright',
      [
        { start: 0.2, end: 2.8, text: '[Macro lens reveals vibrant golden petals unfolding]' },
        { start: 2.9, end: 5.5, text: '[Soft daylight breeze sways emerald foliage]' },
      ],
      [
        { start: 0.2, end: 2.8, text: '[Lente macro revela pétalos dorados abriéndose]' },
        { start: 2.9, end: 5.5, text: '[Brisa suave mueve el follaje verde esmeralda]' },
      ]
    ),
  },
  {
    id: 'dark',
    title: 'Big Buck Bunny — 3D Forest Animation',
    subtitle: 'Adaptive HLS (240p–1080p) · Dynamic Woodland & Twilight Tones',
    streamBadge: 'v10 · 3D HLS ABR · 03 / 04',
    luminanceNote: '3D Animation',
    src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isHls: true,
    supportsCors: true,
    poster: darkPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    introWindow: [2, 8],
    subtitleTracks: makeTracks(
      'dark',
      [
        { start: 0.5, end: 7.0, text: '[Birds chirping softly in a sunlit woodland clearing]' },
        { start: 7.5, end: 15.0, text: '[Morning mist lifting above green hillside grass]' },
        { start: 15.5, end: 26.0, text: '[Gentle orchestral flute melody enters]' },
        { start: 26.5, end: 40.0, text: '[Rabbit steps out from burrow into warm daylight]' },
      ],
      [
        { start: 0.5, end: 7.0, text: '[Pájaros cantando suavemente en un claro del bosque]' },
        { start: 7.5, end: 15.0, text: '[La niebla matinal se disipa sobre la colina verde]' },
        { start: 15.5, end: 26.0, text: '[Suave melodía orquestal de flauta]' },
        { start: 26.5, end: 40.0, text: '[El conejo sale de su madriguera hacia la luz del día]' },
      ]
    ),
  },
  {
    id: 'mux-skate',
    title: 'Concrete Flow — Urban Skate Cinema',
    subtitle: 'Fast-Buffer Mux VOD HLS · Warm Asphalt & Sunlit Action',
    streamBadge: 'v10 · ACTION HLS · 04 / 04',
    luminanceNote: 'Urban Action',
    src: 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM.m3u8',
    muxPlaybackId: 'BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM',
    isHls: true,
    supportsCors: true,
    poster: 'https://image.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/thumbnail.jpg?width=1280',
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    introWindow: [2, 8],
    subtitleTracks: makeTracks(
      'mux-skate',
      [
        { start: 0.4, end: 5.5, text: '[Urethane wheels rolling rhythmically across concrete plaza]' },
        { start: 6.0, end: 13.0, text: '[Low-angle chase camera tracks sunlit handrail grind]' },
        { start: 13.5, end: 22.0, text: '[Sharp wooden deck snap echoes off urban walls]' },
        { start: 22.5, end: 34.0, text: '[Clean landing and carve beneath warm dusk skyline]' },
      ],
      [
        { start: 0.4, end: 5.5, text: '[Ruedas de uretano rodando con ritmo sobre concreto]' },
        { start: 6.0, end: 13.0, text: '[Cámara baja sigue el deslizamiento sobre la baranda]' },
        { start: 13.5, end: 22.0, text: '[Golpe seco de la tabla resuena en la plaza urbana]' },
        { start: 22.5, end: 34.0, text: '[Aterrizaje limpio bajo el cielo cálido del atardecer]' },
      ]
    ),
  },
];

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function generateFallbackVideoBlob(
  posterUrl: string,
  mode: 'editorial' | 'bright' | 'dark'
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = posterUrl;
  });

  const candidateMimes = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ];
  const mimeType = candidateMimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

  if (!mimeType) return null;

  const captureCanvas = canvas as HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
    mozCaptureStream?: (frameRate?: number) => MediaStream;
  };
  const captureFn = captureCanvas.captureStream ?? captureCanvas.mozCaptureStream;
  if (typeof captureFn !== 'function') return null;

  const stream = captureFn.call(canvas, 30);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
  } catch {
    return null;
  }
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<string>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };
  });

  recorder.start(50);
  const totalFrames = 24;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames;
    ctx.fillStyle = mode === 'bright' ? '#f5f5f4' : '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (img.complete && img.naturalWidth > 0) {
      const scale = 1 + Math.sin(t * Math.PI * 2) * 0.015;
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }

    const sweepX = (t * (canvas.width + 240)) - 120;
    const grad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, mode === 'bright' ? 'rgba(255,255,255,0.35)' : 'rgba(255,107,0,0.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await new Promise((r) => setTimeout(r, 16));
  }

  recorder.stop();
  return done;
}
