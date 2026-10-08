import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';
import net from 'node:net';
import { promises as dns } from 'node:dns';
import { validateHost } from '@/lib/ssrf-guard';
import {
  imageType,
  rewriteM3u8,
  buildUpstreamHeaders,
  decompressBuffer,
} from '@/lib/cctv-proxy-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * OSIRIS CCTV Hybrid Media & Stream Proxy
 *
 * Designed to handle heterogeneous global video streams:
 *  1. Live HLS Video Playlists (.m3u8) — downloads and rewrites segment, encryption key,
 *     and sub-playlist URLs so players (Hls.js / Native Safari) can stream cross-origin
 *     without CORS, TLS certificate, or Referer restrictions.
 *  2. Video Segments (.ts, .m4s, .mp4) — binary chunks streamed with Range header support,
 *     correct 206 Partial Content codes, and low-latency Keep-Alive pooling.
 *  3. Snapshot Images (.jpg, .png, .webp) — in-memory frame cache with 304 Not Modified & ETag.
 *  4. Multi-Source Header Engine — provider-aware Referer/Origin spoofing for SkylineWebcams,
 *     Polish feeds (Nadmorski/tkchopin), Dutch RWS (inmoves), Spanish DGT, French APRR,
 *     CamStreamer, IPCamLive, and municipal traffic authorities worldwide.
 *  5. SSRF Defense — validates all target IPs against private/reserved ranges while allowing
 *     any legitimate public internet camera.
 */

/**
 * Persistent Keep-Alive connection agents.
 * Reusing TCP and TLS handshakes cuts latency down to ~20-80ms.
 */
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 6000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 128,
  maxFreeSockets: 64,
  timeout: 6000,
  rejectUnauthorized: false, // Allows municipal/public CCTV servers with self-signed or missing intermediate certs
});

const ATTEMPT_TIMEOUT_MS = 5000;
const MAX_ADDRESSES = 2;
const DNS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes DNS cache

const dnsCache = new Map<string, { addresses: (string | undefined)[]; expires: number }>();

async function addressesFor(hostname: string): Promise<(string | undefined)[]> {
  const cached = dnsCache.get(hostname);
  if (cached && Date.now() < cached.expires) {
    return cached.addresses;
  }
  try {
    const found = await dns.lookup(hostname, { all: true });
    // Prioritize IPv4 addresses first to avoid dual-stack IPv6 connection timeouts
    const sorted = [...found].sort((a, b) => (a.family === 4 ? -1 : 1));
    const addresses = sorted.slice(0, MAX_ADDRESSES).map(a => a.address);
    dnsCache.set(hostname, { addresses, expires: Date.now() + DNS_CACHE_TTL_MS });
    return addresses;
  } catch {
    return [undefined]; // let Node resolve it itself
  }
}

interface UpstreamResponse {
  status: number;
  contentType: string;
  headers: Record<string, string | string[] | undefined>;
  data: Buffer;
}

interface CachedFrame {
  status: number;
  contentType: string;
  data: Buffer;
  etag: string;
  fetchedAt: number;
}

const FRAME_CACHE_TTL_MS = 3_000; // 3s fresh
const FRAME_CACHE_MAX_AGE_MS = 15_000; // 15s stale fallback
const MAX_FRAME_CACHE_ITEMS = 300;
const frameCache = new Map<string, CachedFrame>();
const inFlightRequests = new Map<string, Promise<UpstreamResponse>>();

/** Fetches upstream media/stream, trying addresses, following safe redirects. */
async function fetchUpstream(
  url: string,
  clientHeaders?: Headers,
  redirectHops: number = 0,
): Promise<UpstreamResponse> {
  if (redirectHops > 3) {
    throw new Error('Too many redirects');
  }

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();

  // SSRF defense: block private ranges / localhost / internal cloud metadata
  const hostCheck = await validateHost(host);
  if (!hostCheck.ok) {
    throw new Error(`Security check failed: ${hostCheck.reason}`);
  }

  const addresses = await addressesFor(host);
  let lastError: unknown;
  for (const address of addresses.length ? addresses : [undefined]) {
    try {
      return await proxyFetch(url, clientHeaders, address, redirectHops);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No address answered');
}

/** Low-level request with connection pooling and redirect handling */
function proxyFetch(
  url: string,
  clientHeaders?: Headers,
  address?: string,
  redirectHops: number = 0,
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const headers = buildUpstreamHeaders(parsed, clientHeaders);

    const options: any = {
      headers,
      timeout: ATTEMPT_TIMEOUT_MS,
      agent: isHttps ? httpsAgent : httpAgent,
    };

    if (address) {
      const family = net.isIPv6(address) ? 6 : 4;
      options.lookup = (_host: string, opts: { all?: boolean }, cb: (err: null, addr: unknown, family?: number) => void) =>
        cb(null, opts?.all ? [{ address, family }] : address, family);
    }

    if (isHttps) {
      options.rejectUnauthorized = false;
    }

    const req = mod.get(url, options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        let redirectTarget: URL;
        try {
          redirectTarget = new URL(res.headers.location, url);
        } catch {
          if (!settled) { settled = true; reject(new Error('Invalid redirect target')); }
          return;
        }

        if (redirectTarget.protocol !== 'http:' && redirectTarget.protocol !== 'https:') {
          if (!settled) { settled = true; reject(new Error(`Disallowed redirect protocol: ${redirectTarget.protocol}`)); }
          return;
        }

        fetchUpstream(redirectTarget.toString(), clientHeaders, redirectHops + 1).then(r => {
          if (!settled) { settled = true; resolve(r); }
        }).catch(err => {
          if (!settled) { settled = true; reject(err); }
        });
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        if (!settled) {
          settled = true;
          const rawData = Buffer.concat(chunks);
          const decompressed = decompressBuffer(rawData, res.headers['content-encoding']);
          resolve({
            status: res.statusCode || 200,
            contentType: (res.headers['content-type'] as string) || '',
            headers: res.headers,
            data: decompressed,
          });
        }
      });
      res.on('error', (err) => {
        if (!settled) { settled = true; reject(err); }
      });
    });

    req.on('error', (err) => {
      if (!settled) { settled = true; reject(err); }
    });
    req.on('timeout', () => {
      req.destroy();
      if (!settled) { settled = true; reject(new Error('Timeout')); }
    });
  });
}

/** Pre-flight OPTIONS for cross-origin HLS requests */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const requestedType = request.nextUrl.searchParams.get('type');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Disallowed protocol' }, { status: 400 });
  }

  const host = target.hostname.toLowerCase();

  // SSRF defense: block private ranges / localhost / internal cloud metadata
  const hostSecurity = await validateHost(host);
  if (!hostSecurity.ok) {
    return NextResponse.json({ error: 'Target host rejected by security policy' }, { status: 403 });
  }

  // Detect whether this is a stream (HLS playlist or video segment)
  const isStreamRequest = requestedType === 'stream' ||
    target.pathname.endsWith('.m3u8') ||
    target.pathname.endsWith('.ts') ||
    target.pathname.endsWith('.m4s') ||
    target.pathname.endsWith('.mp4') ||
    target.search.includes('.m3u8') ||
    target.search.includes('.ts');

  // ── 1. STREAM HANDLING (HLS Playlists & Video Segments) ──
  if (isStreamRequest) {
    try {
      const result = await fetchUpstream(target.toString(), request.headers);

      if (result.status >= 400) {
        return NextResponse.json({ error: `Upstream stream ${result.status}` }, { status: result.status });
      }

      const textSample = result.data.subarray(0, 50).toString('utf8');
      const isM3u8 = textSample.startsWith('#EXTM3U') ||
        result.contentType.includes('mpegurl') ||
        target.pathname.endsWith('.m3u8') ||
        target.search.includes('.m3u8');

      if (isM3u8) {
        // Rewrite HLS manifest so all chunk requests route through Osiris proxy
        const rewritten = rewriteM3u8(result.data.toString('utf8'), target.toString());
        return new NextResponse(rewritten, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Proxy-Kind': 'HLS-PLAYLIST',
          },
        });
      }

      // Binary video segment (.ts, .m4s, .mp4 chunk)
      const segmentType = target.pathname.endsWith('.mp4') ? 'video/mp4' : 'video/mp2t';
      const responseHeaders: Record<string, string> = {
        'Content-Type': result.contentType || segmentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=60',
        'X-Proxy-Kind': 'VIDEO-SEGMENT',
      };
      const contentRange = result.headers['content-range'];
      if (typeof contentRange === 'string') {
        responseHeaders['Content-Range'] = contentRange;
      }

      return new NextResponse(new Uint8Array(result.data), {
        status: result.status,
        headers: responseHeaders,
      });
    } catch (error: any) {
      console.error('Stream proxy error:', error?.message || error);
      return NextResponse.json({ error: 'Stream proxy failed: ' + (error?.message || 'unknown') }, { status: 502 });
    }
  }

  // ── 2. IMAGE SNAPSHOT HANDLING (High performance frame cache) ──
  const cacheKey = target.toString();
  const ifNoneMatch = request.headers.get('if-none-match');
  const now = Date.now();
  const cached = frameCache.get(cacheKey);

  if (cached && (now - cached.fetchedAt < FRAME_CACHE_TTL_MS)) {
    if (ifNoneMatch && ifNoneMatch === cached.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': cached.etag,
          'Cache-Control': 'public, max-age=4, stale-while-revalidate=12',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new NextResponse(new Uint8Array(cached.data), {
      status: cached.status,
      headers: {
        'Content-Type': imageType(cached.data, cached.contentType),
        'Cache-Control': 'public, max-age=4, stale-while-revalidate=12',
        'Access-Control-Allow-Origin': '*',
        'ETag': cached.etag,
        'X-Proxy-Cache': 'HIT',
      },
    });
  }

  try {
    let pending = inFlightRequests.get(cacheKey);
    if (!pending) {
      pending = fetchUpstream(cacheKey, request.headers).finally(() => {
        inFlightRequests.delete(cacheKey);
      });
      inFlightRequests.set(cacheKey, pending);
    }

    const result = await pending;

    if (result.status >= 400) {
      return NextResponse.json({ error: `Upstream ${result.status}` }, { status: result.status });
    }

    const etag = `W/"${result.data.length}-${Math.floor(now / 3000)}"`;

    if (frameCache.size >= MAX_FRAME_CACHE_ITEMS) {
      const oldest = frameCache.keys().next().value;
      if (oldest) frameCache.delete(oldest);
    }
    frameCache.set(cacheKey, {
      status: result.status,
      contentType: result.contentType,
      data: result.data,
      etag,
      fetchedAt: now,
    });

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=4, stale-while-revalidate=12',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        'Content-Type': imageType(result.data, result.contentType),
        'Cache-Control': 'public, max-age=4, stale-while-revalidate=12',
        'Access-Control-Allow-Origin': '*',
        'ETag': etag,
        'X-Proxy-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    if (cached && (now - cached.fetchedAt < FRAME_CACHE_MAX_AGE_MS)) {
      return new NextResponse(new Uint8Array(cached.data), {
        status: cached.status,
        headers: {
          'Content-Type': imageType(cached.data, cached.contentType),
          'Cache-Control': 'public, max-age=2',
          'Access-Control-Allow-Origin': '*',
          'ETag': cached.etag,
          'X-Proxy-Cache': 'STALE',
        },
      });
    }
    console.error('Camera image proxy error:', error?.message || error);
    return NextResponse.json({ error: 'Proxy failed: ' + (error?.message || 'unknown') }, { status: 502 });
  }
}
