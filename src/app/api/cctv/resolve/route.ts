import { NextResponse } from 'next/server';
import { safeFetch } from '@/lib/ssrf-guard';
import { isSkylineUrl, parseSkylinePage } from '@/lib/skyline';
import { extractYouTubeId, isYouTubeUrl, parseYouTubeUrl, youtubeEmbedUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Resolves a camera's external link to something the viewer can embed.
 *
 * Two providers need a lookup:
 *
 *   SkylineWebcams pages — mostly a wrapper around a public YouTube livestream
 *     from the camera's actual operator. See src/lib/skyline.ts for the
 *     breakdown, and for why the HLS-backed ones are left alone.
 *
 *   YouTube channel "/live" links — these name a channel, not a broadcast, so
 *     only the page can say what is on air right now.
 *
 * A link that already names a video never reaches here: the viewer builds that
 * embed itself (see localEmbed), because asking a server to repeat what the URL
 * already says would add a round-trip and a failure mode for nothing.
 *
 * Nothing is baked into the camera data. These are long-running livestreams,
 * and one that restarts comes back under a new id — a baked id would work until
 * it silently didn't, and would fail looking like a broken camera.
 */

// Three different lifetimes, because these are three different facts.
const OK_TTL_MS = 120 * 60_000;        // a resolved stream id is stable for 2 hours
const NO_FEED_TTL_MS = 10 * 60_000;    // 'this page has no embeddable feed' is good to reuse
const UNREACHABLE_TTL_MS = 15_000;     // a network failure is retried sooner

const MAX_ENTRIES = 1000;

type Resolution =
  | { embeddable: true; kind: 'youtube'; videoId: string; embedUrl: string }
  | { embeddable: true; kind: 'hls'; streamUrl: string }
  | { embeddable: true; kind: 'snapshot'; feedUrl: string }
  | { embeddable: false; kind: 'hls' | 'offline' | 'missing' | 'unknown' | 'unreachable' };

const cache = new Map<string, { at: number; ttl: number; value: Resolution }>();
const inFlightResolutions = new Map<string, Promise<Resolution>>();

function cached(url: string): Resolution | null {
  const hit = cache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(url);
    return null;
  }
  return hit.value;
}

function remember(url: string, value: Resolution) {
  // Only allowlisted hosts reach this, so the key space is bounded by their
  // sites — but bound it here too rather than trusting that to stay true.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const ttl = value.embeddable
    ? OK_TTL_MS
    : value.kind === 'unreachable' ? UNREACHABLE_TTL_MS : NO_FEED_TTL_MS;
  cache.set(url, { at: Date.now(), ttl, value });
}

/**
 * The host allowlist, and the only thing keeping this from being a
 * fetch-anything route. A YouTube URL is additionally required to be a channel
 * live link — the shapes that name a video are handled without a request, so
 * accepting them here would only widen what this route will go and load.
 */
function isResolvable(url: string): boolean {
  if (isSkylineUrl(url)) return true;
  return isYouTubeUrl(url) && parseYouTubeUrl(url)?.kind === 'live-channel';
}

async function resolveExternalUrl(url: string): Promise<Resolution> {
  try {
    const res = await safeFetch(url, {
      signal: AbortSignal.timeout(3_500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OSIRIS/1.0; +https://github.com/simplifaisoul/osiris)',
        'Accept': 'text/html,application/xhtml+xml',
        'Connection': 'keep-alive',
      },
    });

    if (res.status === 404 || res.status === 410) {
      return { embeddable: false, kind: 'missing' };
    }
    if (!res.ok) {
      return { embeddable: false, kind: 'unreachable' };
    }

    const html = await res.text();
    if (isSkylineUrl(url)) {
      const feed = parseSkylinePage(html);
      if (feed.kind === 'youtube') {
        return { embeddable: true, kind: 'youtube', videoId: feed.videoId, embedUrl: feed.embedUrl };
      }
      if (feed.kind === 'hls' && feed.streamUrl) {
        return {
          embeddable: true,
          kind: 'hls',
          streamUrl: `/api/cctv/proxy?url=${encodeURIComponent(feed.streamUrl)}&type=stream`,
        };
      }
      if (feed.kind === 'snapshot') {
        return {
          embeddable: true,
          kind: 'snapshot',
          feedUrl: `/api/cctv/proxy?url=${encodeURIComponent(feed.snapshotUrl)}`,
        };
      }
      return { embeddable: false, kind: feed.kind };
    }

    const videoId = extractYouTubeId(html);
    return videoId
      ? { embeddable: true, kind: 'youtube', videoId, embedUrl: youtubeEmbedUrl(videoId) }
      : { embeddable: false, kind: 'unknown' };
  } catch (err) {
    console.error('cctv resolve failed:', url, err instanceof Error ? err.message : err);
    return { embeddable: false, kind: 'unreachable' };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');

  if (!url || !isResolvable(url)) {
    return NextResponse.json(
      { embeddable: false, kind: 'unknown', reason: 'not_resolvable' },
      { status: 400 },
    );
  }

  const hit = cached(url);
  if (hit) {
    return NextResponse.json(hit, { headers: { 'X-Cache': 'HIT' } });
  }

  let inFlight = inFlightResolutions.get(url);
  if (!inFlight) {
    inFlight = resolveExternalUrl(url).finally(() => {
      inFlightResolutions.delete(url);
    });
    inFlightResolutions.set(url, inFlight);
  }

  const value = await inFlight;
  remember(url, value);

  return NextResponse.json(value, {
    headers: {
      'X-Cache': 'MISS',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
    },
  });
}
