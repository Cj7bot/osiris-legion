import type { CctvCamera } from './types';
import {
  LATAM_SKYLINE_CAMERAS,
  AFRICA_SKYLINE_CAMERAS,
  EUROPE_SKYLINE_CAMERAS,
} from './world-skyline.generated';

/**
 * OSIRIS — public live webcams outside Asia.
 *
 * Fills the regions OSIRIS had no CCTV coverage for at all: Latin America, the
 * Caribbean, Africa, and the European countries with no traffic-authority feed
 * of their own. Split by continent so viewport-scoped queries stay meaningful.
 */

/**
 * Curated 24/7 continuous live streaming video webcams for European cities.
 * Uses verified continuous embeds (YouTube nocookie) with fallback channel resolution.
 */
export const CONTINUOUS_EUROPE_LIVE_CAMERAS: CctvCamera[] = [
  {
    id: 'live-uk-london-abbey-road',
    lat: 51.5320,
    lng: -0.1774,
    name: 'London - Abbey Road Beatles Crossing (Live Stream)',
    city: 'London',
    country: 'UK',
    stream_url: 'https://www.youtube-nocookie.com/embed/ohq35Pow4XU?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@abbeyroad/live',
    source: 'Abbey Road Studios (Live Stream)',
  },
  {
    id: 'live-it-venice-grand-canal',
    lat: 45.4380,
    lng: 12.3359,
    name: 'Venice - Grand Canal & Rialto Bridge (Live Stream)',
    city: 'Venice',
    country: 'Italy',
    stream_url: 'https://www.youtube-nocookie.com/embed/nviU2HYj-Jc?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@iloveyouvenice/live',
    source: 'I Love You Venice (Live Stream)',
  },
  {
    id: 'live-ie-dublin-temple-bar',
    lat: 53.3454,
    lng: -6.2642,
    name: 'Dublin - Temple Bar Historic Quarter (Live Stream)',
    city: 'Dublin',
    country: 'Ireland',
    stream_url: 'https://www.youtube-nocookie.com/embed/Td6RKyYxFx0?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@TheTempleBarPub/live',
    source: 'Temple Bar (Live Stream)',
  },
  {
    id: 'live-fr-paris-montmartre',
    lat: 48.8867,
    lng: 2.3431,
    name: 'Paris - Sacré-Cœur & City Panorama (Live Stream)',
    city: 'Paris',
    country: 'France',
    stream_url: 'https://www.youtube-nocookie.com/embed/Z4_vLKuNVBk?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@PARISTV/live',
    source: 'Paris TV (Live Stream)',
  },
  {
    id: 'live-fr-paris-streets',
    lat: 48.8566,
    lng: 2.3522,
    name: 'Paris - Central Streets & Seine (Live Stream)',
    city: 'Paris',
    country: 'France',
    stream_url: 'https://www.youtube-nocookie.com/embed/B6ojcoiys7c?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@ARTVISIONTV/live',
    source: 'Art Vision TV (Live Stream)',
  },
];

/**
 * Curated 24/7 continuous live streaming video webcams for Americas cities.
 */
export const CONTINUOUS_AMERICAS_LIVE_CAMERAS: CctvCamera[] = [
  {
    id: 'live-us-nyc-times-square',
    lat: 40.7580,
    lng: -73.9855,
    name: 'New York - Times Square 4K (Live Stream)',
    city: 'New York',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/xqdukYhcGEU?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@EarthCam/live',
    source: 'EarthCam (Live Stream)',
  },
  {
    id: 'live-us-miami-beach',
    lat: 25.7781,
    lng: -80.1313,
    name: 'Miami Beach - Ocean Drive (Live Stream)',
    city: 'Miami Beach',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/LECA8Zd1DkY?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@Travelistul/live',
    source: 'Travelistul (Live Stream)',
  },
  {
    id: 'live-us-port-everglades',
    lat: 26.0911,
    lng: -80.1172,
    name: 'Fort Lauderdale - Port Everglades (Live Stream)',
    city: 'Fort Lauderdale',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/lJHyz5JcMos?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@PortEvergladesWebcam/live',
    source: 'Port Everglades Cam (Live Stream)',
  },
  {
    id: 'live-us-chicago-skyline',
    lat: 41.8781,
    lng: -87.6298,
    name: 'Chicago - Downtown Skyline (Live Stream)',
    city: 'Chicago',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/-vl4_f8Emtw?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@ChicagoLive/live',
    source: 'Chicago Live (Live Stream)',
  },
  {
    id: 'live-us-niagara-falls',
    lat: 43.0799,
    lng: -79.0747,
    name: 'Niagara Falls - Panorama View (Live Stream)',
    city: 'Niagara Falls',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/3pxmfvZO6xI?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@NiagaraFallsLive/live',
    source: 'Niagara Falls Live (Live Stream)',
  },
  {
    id: 'live-us-hawaii-waikiki',
    lat: 21.2766,
    lng: -157.8274,
    name: 'Honolulu - Waikiki Beach (Live Stream)',
    city: 'Honolulu',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/2NKSmXhexPo?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@Walkwaikiki/live',
    source: 'Walk Waikiki (Live Stream)',
  },
  {
    id: 'live-us-california-monterey',
    lat: 36.6183,
    lng: -121.9015,
    name: 'Monterey Bay - Coastal Panorama (Live Stream)',
    city: 'Monterey',
    country: 'US',
    stream_url: 'https://www.youtube-nocookie.com/embed/AWJi0LgyA28?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1',
    stream_type: 'iframe',
    external_url: 'https://www.youtube.com/@MontereyBayAquarium/live',
    source: 'Monterey Bay Live (Live Stream)',
  },
];

export async function fetchLatamLiveCameras(): Promise<CctvCamera[]> {
  return [...CONTINUOUS_AMERICAS_LIVE_CAMERAS, ...LATAM_SKYLINE_CAMERAS];
}

export async function fetchAfricaLiveCameras(): Promise<CctvCamera[]> {
  return AFRICA_SKYLINE_CAMERAS;
}

export async function fetchEuropeLiveCameras(): Promise<CctvCamera[]> {
  return [...CONTINUOUS_EUROPE_LIVE_CAMERAS, ...EUROPE_SKYLINE_CAMERAS];
}
