import zlib from 'node:zlib';

const NO_REFERER_HOSTS = ['thb.gov.tw'];

export function sendsReferer(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return !NO_REFERER_HOSTS.some(suffix => h === suffix || h.endsWith('.' + suffix));
}

/**
 * Decompresses upstream responses if gzip/deflate/brotli was used.
 */
export function decompressBuffer(data: Buffer, encoding?: string | string[]): Buffer {
  if (!encoding) return data;
  const enc = (Array.isArray(encoding) ? encoding.join(',') : encoding).toLowerCase();
  try {
    if (enc.includes('gzip')) {
      return zlib.gunzipSync(data);
    }
    if (enc.includes('deflate')) {
      return zlib.inflateSync(data);
    }
    if (enc.includes('br')) {
      return zlib.brotliDecompressSync(data);
    }
  } catch {
    // If decompression fails, return raw data
  }
  return data;
}

/**
 * The type to serve a frame as.
 */
export function imageType(data: Buffer, declared: string): string {
  if (/^image\//i.test(declared)) return declared;
  const head = data.subarray(0, 12);
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head.toString('latin1', 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (head.length >= 4 && head.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  return declared;
}

/**
 * Rewrites an HLS (.m3u8) playlist so all relative and absolute segment URLs
 * and encryption keys are routed through this proxy with proper CORS and spoofed headers.
 */
export function rewriteM3u8(content: string, baseUrl: string, proxyBase: string = '/api/cctv/proxy'): string {
  const lines = content.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) {
      out.push(line);
      continue;
    }

    // Handles #EXT-X-MAP:URI="init.mp4"
    if (line.startsWith('#EXT-X-MAP:')) {
      const match = line.match(/URI=\"([^\"]+)\"/);
      if (match) {
        try {
          const full = new URL(match[1], baseUrl).toString();
          const proxied = `${proxyBase}?url=${encodeURIComponent(full)}&type=stream`;
          line = line.replace(match[1], proxied);
        } catch {}
      }
      out.push(line);
      continue;
    }

    // Handles #EXT-X-KEY:METHOD=...,URI="..."
    if (line.startsWith('#EXT-X-KEY:')) {
      const match = line.match(/URI=\"([^\"]+)\"/);
      if (match) {
        try {
          const full = new URL(match[1], baseUrl).toString();
          const proxied = `${proxyBase}?url=${encodeURIComponent(full)}&type=stream`;
          line = line.replace(match[1], proxied);
        } catch {}
      }
      out.push(line);
      continue;
    }

    // Other HLS directives
    if (line.startsWith('#')) {
      out.push(line);
      continue;
    }

    // Media segment or sub-playlist URL line
    try {
      const full = new URL(line, baseUrl).toString();
      const proxied = `${proxyBase}?url=${encodeURIComponent(full)}&type=stream`;
      out.push(proxied);
    } catch {
      out.push(line);
    }
  }

  return out.join('\n');
}

/** Multi-source header generation with provider spoofing */
export function buildUpstreamHeaders(targetUrl: URL, clientHeaders?: Headers): Record<string, string> {
  const host = targetUrl.hostname.toLowerCase();
  const headers: Record<string, string> = {
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  };

  const range = clientHeaders?.get('range');
  if (range) {
    headers['Range'] = range;
  }

  if (host.includes('skylinewebcams.com')) {
    headers['Referer'] = 'https://www.skylinewebcams.com/';
    headers['Origin'] = 'https://www.skylinewebcams.com';
  } else if (host.includes('tkchopin.pl')) {
    headers['Referer'] = 'https://nadmorski24.pl/';
    headers['Origin'] = 'https://nadmorski24.pl';
  } else if (host.includes('inmoves.nl')) {
    headers['Referer'] = 'https://www.rijkswaterstaat.nl/';
  } else if (host.includes('dgt.es')) {
    headers['Referer'] = 'https://infocar.dgt.es/';
  } else if (host.includes('aprr.fr')) {
    headers['Referer'] = 'https://voyage.aprr.fr/';
  } else if (host.includes('camstreamer.com')) {
    headers['Referer'] = 'https://camstreamer.com/';
  } else if (host.includes('ipcamlive.com')) {
    headers['Referer'] = 'https://g1.ipcamlive.com/';
  } else if (sendsReferer(host)) {
    headers['Referer'] = `https://${targetUrl.hostname}/`;
    headers['Origin'] = `https://${targetUrl.hostname}`;
  }

  return headers;
}
