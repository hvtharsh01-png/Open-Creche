import L from 'leaflet';
import type { CrecheType, Stage } from '../../shared/types';
import { STAGE_COLOR } from './stage';

export function pinIcon(stage: Stage, type: CrecheType, selected: boolean, rank?: number) {
  const size = selected ? 40 : 32;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="oc-pin ${selected ? 'sel' : ''}" style="--c:${STAGE_COLOR[stage]};width:${size}px;height:${size}px">${type}${rank ? `<span class="rank">${rank}</span>` : ''}</div>`,
  });
}

export const youIcon = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: '<div class="you-pin"></div>' });
