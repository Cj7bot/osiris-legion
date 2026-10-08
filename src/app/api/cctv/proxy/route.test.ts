import { describe, it, expect } from 'vitest';
import { imageType, rewriteM3u8 } from '@/lib/cctv-proxy-utils';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(8)]);

describe('imageType', () => {
  it('reads the type off the bytes when the source will not say', () => {
    // Every Singapore LTA frame arrives like this, with nosniff alongside.
    expect(imageType(jpeg, 'application/octet-stream')).toBe('image/jpeg');
    expect(imageType(png, 'application/octet-stream')).toBe('image/png');
    expect(imageType(jpeg, '')).toBe('image/jpeg');
  });

  it('takes a declared image type at its word', () => {
    expect(imageType(jpeg, 'image/png')).toBe('image/png');
    expect(imageType(Buffer.alloc(0), 'image/jpeg')).toBe('image/jpeg');
  });

  it('leaves anything it does not recognise alone', () => {
    expect(imageType(Buffer.from('not an image'), 'text/html')).toBe('text/html');
    expect(imageType(Buffer.alloc(2), 'application/octet-stream')).toBe('application/octet-stream');
  });
});

describe('rewriteM3u8', () => {
  it('rewrites relative and absolute segment URLs to Osiris proxy endpoints', () => {
    const raw = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MAP:URI="init.mp4"
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXTINF:2.000,
chunk0.ts
#EXTINF:2.000,
https://cdn.example.com/chunk1.ts`;

    const rewritten = rewriteM3u8(raw, 'https://origin.example.com/live/playlist.m3u8');
    expect(rewritten).toContain('#EXT-X-MAP:URI="/api/cctv/proxy?url=https%3A%2F%2Forigin.example.com%2Flive%2Finit.mp4&type=stream"');
    expect(rewritten).toContain('#EXT-X-KEY:METHOD=AES-128,URI="/api/cctv/proxy?url=https%3A%2F%2Forigin.example.com%2Flive%2Fkey.bin&type=stream"');
    expect(rewritten).toContain('/api/cctv/proxy?url=https%3A%2F%2Forigin.example.com%2Flive%2Fchunk0.ts&type=stream');
    expect(rewritten).toContain('/api/cctv/proxy?url=https%3A%2F%2Fcdn.example.com%2Fchunk1.ts&type=stream');
  });

  it('rewrites master playlist variant streams', () => {
    const raw = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720
chunklist_w1234.m3u8`;

    const rewritten = rewriteM3u8(raw, 'https://streaming1.neotel.net.mk/stream/deve_bair.m3u8');
    expect(rewritten).toContain('/api/cctv/proxy?url=https%3A%2F%2Fstreaming1.neotel.net.mk%2Fstream%2Fchunklist_w1234.m3u8&type=stream');
  });
});
