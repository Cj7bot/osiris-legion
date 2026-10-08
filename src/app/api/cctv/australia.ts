import { CctvCamera } from "./types";
import { stealthFetch } from '@/lib/stealthFetch';

// Curated continuous 24/7 live video webcams for Australia (Sydney)
const AUSTRALIA_LIVE_VIDEO_STREAMS: CctvCamera[] = [
  {
    id: 'au-sydney-harbour-live',
    lat: -33.8568,
    lng: 151.2153,
    name: 'Sydney Harbour & Opera House (Live Stream)',
    city: 'Sydney',
    country: 'Australia',
    stream_url: 'https://www.youtube-nocookie.com/embed/5uZa3-RMFos?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@webcamsydney/live',
    source: 'Webcam Sydney (Live Stream)',
  },
  {
    id: 'au-sydney-bridge-live',
    lat: -33.8523,
    lng: 151.2108,
    name: 'Sydney Harbour Bridge & Circular Quay (Live Stream)',
    city: 'Sydney',
    country: 'Australia',
    stream_url: 'https://www.youtube-nocookie.com/embed/uBoCoMsaSQU?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@sydneylivecamera/live',
    source: 'Sydney Live Cam (Live Stream)',
  },
];

export async function fetchAustraliaCameras(): Promise<CctvCamera[]> {
    try {
        const res = await stealthFetch('https://www.livetraffic.com/datajson/all-feeds-web.json', { signal: AbortSignal.timeout(12000) });
        if (!res.ok) return AUSTRALIA_LIVE_VIDEO_STREAMS;
        const data = await res.json();
        const trafficCams = (data || []).filter((event: { eventType: string; }) => event.eventType === 'liveCams').map((cam: { path: string; geometry: { coordinates: number[] }; properties: { title: string; region: string; href: string }; }) => {
            return {
                id: cam.path,
                lat: cam.geometry.coordinates[1],
                lng: cam.geometry.coordinates[0],
                name: cam.properties.title || 'Australia Camera',
                city: cam.properties.region || 'Australia',
                country: 'Australia',
                feed_url: cam.properties.href || '',
                source: 'Live Traffic',
            };
        }).filter((c: { lat: number; lng: number; }) => c.lat && c.lng);

        return [...AUSTRALIA_LIVE_VIDEO_STREAMS, ...trafficCams];
    } catch {
        return AUSTRALIA_LIVE_VIDEO_STREAMS;
    }
}