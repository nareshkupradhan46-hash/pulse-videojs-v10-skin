import brightPoster from '../assets/images/poster_bright_daylight_1794564950680.jpg';
import darkPoster from '../assets/images/poster_dark_cinema_1794564951623.jpg';

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
  captionsUrl: string;
  introWindow?: [number, number];
}

function createBlobUrl(content: string, type: string): string {
  const blob = new Blob([content], { type });
  return URL.createObjectURL(blob);
}

const CHAPTERS_VTT = `WEBVTT

00:00.000 --> 00:06.000
01. Optical Frame & Telemetry

00:06.000 --> 00:14.000
02. Adaptive Color & Motion

00:14.000 --> 00:30.000
03. Precision Laser Scrubber
`;

const CAPTIONS_VTT = `WEBVTT

00:00.200 --> 00:04.200
Pulse Player UI — @videojs/react v10 Skin Showcase

00:04.300 --> 00:08.500
Adaptive luminance sampling · Voice Night Mode · Flash Guard

00:08.600 --> 00:13.500
Press C to toggle captions or style cues in Theme & A11y

00:13.600 --> 00:20.000
Precision laser scrubber with frame bookmarks & chapter pins
`;

const SHARED_CAPTIONS_URL = createBlobUrl(CAPTIONS_VTT, 'text/vtt');

export const VIDEO_REELS: VideoReel[] = [
  {
    id: 'oceans',
    title: 'Pacific Oceans — Coastal Aerial Reel',
    subtitle: 'Fast-Start MP4 · Deep Ocean Cyan & Sunlit Surf Luminance',
    streamBadge: 'v10 · FAST MP4 · OCEAN BLUE',
    luminanceNote: 'Vibrant Cyan',
    src: 'https://vjs.zencdn.net/v/oceans.mp4',
    supportsCors: true,
    poster: brightPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    captionsUrl: SHARED_CAPTIONS_URL,
    introWindow: [2, 8],
  },
  {
    id: 'mux-hls',
    title: 'Kinetic Cinema — Mux Adaptive HLS',
    subtitle: 'Fast-Buffer ABR HLS (270p–1080p) via @videojs/react/media/hlsjs-video',
    streamBadge: 'v10 · HLS ABR · MUX LIVE',
    luminanceNote: 'Adaptive HLS',
    src: 'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe.m3u8',
    muxPlaybackId: 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe',
    isHls: true,
    supportsCors: true,
    poster: 'https://image.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe/thumbnail.jpg?width=1280',
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    captionsUrl: SHARED_CAPTIONS_URL,
    introWindow: [2, 8],
  },
  {
    id: 'bright',
    title: 'Botanical Bloom — Instant High-Chroma Reel',
    subtitle: '1.1 MB Instant-Play MP4 · Golden Petal & Emerald Palette',
    streamBadge: 'v10 · INSTANT · 1.1 MB MP4',
    luminanceNote: 'High Chroma',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    supportsCors: true,
    poster: brightPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    captionsUrl: SHARED_CAPTIONS_URL,
  },
  {
    id: 'dark',
    title: 'Big Buck Bunny — Multi-Bitrate HLS',
    subtitle: 'Fast-Buffer HLS (240p–1080p) · Dynamic Forest & Twilight Tones',
    streamBadge: 'v10 · HLS ABR · 240p–1080p',
    luminanceNote: 'Dynamic Color',
    src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isHls: true,
    supportsCors: true,
    poster: darkPoster,
    chaptersUrl: createBlobUrl(CHAPTERS_VTT, 'text/vtt'),
    captionsUrl: SHARED_CAPTIONS_URL,
    introWindow: [2, 8],
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

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_500_000 });
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
