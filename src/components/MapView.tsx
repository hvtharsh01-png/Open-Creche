import { useEffect } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng, OpportunityView } from '../../shared/types';
import { fmtLakh, STAGES } from '../../shared/types';
const INDIA_CENTER: [number, number] = [22.5, 80.5];
import { pinIcon, youIcon } from '../lib/icons';
import { STAGE_COLOR } from '../lib/stage';

export interface FlyTarget extends LatLng {
  zoom?: number;
  key: number;
}

interface Props {
  items: OpportunityView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  rankById?: Record<string, number>;
  you?: LatLng | null;
  radius?: { center: LatLng; km: number } | null;
  pickMode?: boolean;
  onPick?: (p: LatLng) => void;
  fly?: FlyTarget | null;
  height?: string;
  showLegend?: boolean;
}

function Flyer({ fly }: { fly?: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (fly) map.flyTo([fly.lat, fly.lng], fly.zoom ?? 7, { duration: 1 });
  }, [fly?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Picker({ onPick, active }: { onPick?: (p: LatLng) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active && onPick) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Refit the map when its container changes size (list/map toggle on phones). */
function Resizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function MapView({ items, selectedId, onSelect, rankById, you, radius, pickMode, onPick, fly, height = '100%', showLegend = true }: Props) {
  return (
    <div className={`relative w-full ${pickMode ? 'pick-cursor' : ''}`} style={{ height }}>
      {/* centre + zoom (not fitBounds) so a map mounted in a zero-size box can never produce NaN coordinates */}
      <MapContainer center={INDIA_CENTER} zoom={typeof window !== 'undefined' && window.innerWidth < 640 ? 4 : 5} minZoom={4} maxBounds={[[0, 60], [42, 105]]} scrollWheelZoom className="h-full w-full rounded-2xl">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Picker onPick={onPick} active={!!pickMode} />
        <Flyer fly={fly} />
        <Resizer />

        {radius && <Circle center={[radius.center.lat, radius.center.lng]} radius={radius.km * 1000} pathOptions={{ color: '#e5408a', weight: 1.5, fillColor: '#e5408a', fillOpacity: 0.07, dashArray: '6 6' }} />}

        {items.map((o) => {
          const sel = o.id === selectedId;
          return (
            <Marker
              key={o.id}
              position={[o.lat, o.lng]}
              icon={pinIcon(o.stage, o.type, sel, rankById?.[o.id])}
              zIndexOffset={sel ? 1000 : rankById?.[o.id] ? 500 : 0}
              eventHandlers={{ click: () => onSelect(o.id) }}
            >
              <Tooltip className="oc-tip" direction="top" offset={[0, -14]}>
                <div className="text-xs">
                  <div className="font-bold">{o.name}</div>
                  <div className="text-muted">
                    {o.district}, {o.state}
                  </div>
                  <div className="font-semibold" style={{ color: STAGE_COLOR[o.stage] }}>
                    {STAGES.find((s) => s.id === o.stage)!.label} · {o.units} creches · {fmtLakh(o.unitCostLakh)} each
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {you && (
          <Marker position={[you.lat, you.lng]} icon={youIcon} zIndexOffset={950}>
            <Tooltip className="oc-tip" direction="right">
              You are here
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-xl">
          Click anywhere on the map to set your location
        </div>
      )}

      {showLegend && (
        <div className="absolute bottom-3 left-3 z-[500] hidden rounded-xl border border-brand-100 bg-white/95 p-3 text-[11px] font-semibold shadow-lg backdrop-blur sm:block">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Stage · pin letter is creche type</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {STAGES.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: STAGE_COLOR[s.id] }} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
