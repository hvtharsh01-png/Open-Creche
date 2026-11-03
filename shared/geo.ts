import type { LatLng } from './types.js';

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Place extends LatLng {
  name: string;
  state: string;
}

/** Districts / cities used as creche locations and "near me" anchors. Coordinates are approximate. */
export const PLACES: Place[] = [
  // Maharashtra
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  { name: 'Thane', state: 'Maharashtra', lat: 19.186, lng: 73.023 },
  { name: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  { name: 'Ratnagiri', state: 'Maharashtra', lat: 16.9902, lng: 73.312 },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
  // Uttar Pradesh
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Kanpur Nagar', state: 'Uttar Pradesh', lat: 26.4499, lng: 80.3319 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  { name: 'Gorakhpur', state: 'Uttar Pradesh', lat: 26.7606, lng: 83.3732 },
  { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  { name: 'Bahraich', state: 'Uttar Pradesh', lat: 27.5743, lng: 81.5948 },
  // Madhya Pradesh
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  { name: 'Rewa', state: 'Madhya Pradesh', lat: 24.5362, lng: 81.3037 },
  { name: 'Sagar', state: 'Madhya Pradesh', lat: 23.8388, lng: 78.7378 },
  { name: 'Dindori', state: 'Madhya Pradesh', lat: 22.9429, lng: 81.0817 },
  // West Bengal
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Howrah', state: 'West Bengal', lat: 22.5958, lng: 88.2636 },
  { name: 'Purulia', state: 'West Bengal', lat: 23.3321, lng: 86.3616 },
  { name: 'Murshidabad', state: 'West Bengal', lat: 24.175, lng: 88.2806 },
  { name: 'Darjeeling', state: 'West Bengal', lat: 26.7271, lng: 88.3953 },
  // Karnataka
  { name: 'Bengaluru Urban', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Raichur', state: 'Karnataka', lat: 16.212, lng: 77.3439 },
  { name: 'Kalaburagi', state: 'Karnataka', lat: 17.3297, lng: 76.8343 },
  { name: 'Dharwad', state: 'Karnataka', lat: 15.3647, lng: 75.124 },
  // Tamil Nadu
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198 },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { name: 'Tiruppur', state: 'Tamil Nadu', lat: 11.1085, lng: 77.3411 },
  { name: 'Salem', state: 'Tamil Nadu', lat: 11.6643, lng: 78.146 },
  // Odisha (pilot)
  { name: 'Keonjhar', state: 'Odisha', lat: 21.6289, lng: 85.5817 },
  { name: 'Sundargarh', state: 'Odisha', lat: 22.1167, lng: 84.0333 },
  { name: 'Jajpur', state: 'Odisha', lat: 20.85, lng: 86.3333 },
  { name: 'Khordha', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  { name: 'Koraput', state: 'Odisha', lat: 18.812, lng: 82.711 },
  { name: 'Mayurbhanj', state: 'Odisha', lat: 21.9347, lng: 86.7336 },
  // Rajasthan
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  { name: 'Banswara', state: 'Rajasthan', lat: 23.5461, lng: 74.435 },
  { name: 'Jodhpur', state: 'Rajasthan', lat: 26.2389, lng: 73.0243 },
  // Gujarat
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Dahod', state: 'Gujarat', lat: 22.8344, lng: 74.2594 },
  // Bihar
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Gaya', state: 'Bihar', lat: 24.7955, lng: 85.0002 },
  // Jharkhand
  { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lng: 85.3096 },
  { name: 'West Singhbhum', state: 'Jharkhand', lat: 22.5574, lng: 85.8049 },
];

export const placesIn = (state: string) => PLACES.filter((p) => p.state === state);
export const findPlace = (name: string) => PLACES.find((p) => p.name === name);

/** India map view used by the Leaflet maps: [[south, west], [north, east]]. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [7.5, 68.5],
  [35.5, 97.5],
];
