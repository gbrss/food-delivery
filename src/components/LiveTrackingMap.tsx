import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom clean SVG pins for Restaurant, Driver (Moto), and Client Destination
const createCustomIcon = (bgColor: string, label: string, pulse = false) =>
  L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
        ${
          pulse
            ? `<span style="position: absolute; inset: 0; border-radius: 9999px; background-color: ${bgColor}; opacity: 0.35; animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
            : ''
        }
        <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9999px; background-color: ${bgColor}; color: #ffffff; font-weight: 700; font-size: 15px; border: 2.5px solid #ffffff; box-shadow: 0 6px 14px rgba(15, 23, 42, 0.28);">
          ${label}
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

const restaurantIcon = createCustomIcon('#0F172A', '🏪');
const driverIcon = createCustomIcon('#EA580C', '🛵', true);
const clientIcon = createCustomIcon('#16A34A', '🏠');

interface MapBoundsUpdaterProps {
  points: [number, number][];
}

const MapBoundsUpdater: React.FC<MapBoundsUpdaterProps> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    }
  }, [map, points]);
  return null;
};

export interface LiveTrackingMapProps {
  restaurantLat: number;
  restaurantLng: number;
  restaurantName: string;
  clientLat: number;
  clientLng: number;
  clientAddress: string;
  driverLat: number;
  driverLng: number;
  driverName?: string;
  heightClass?: string;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  restaurantLat,
  restaurantLng,
  restaurantName,
  clientLat,
  clientLng,
  clientAddress,
  driverLat,
  driverLng,
  driverName = 'Diego Morales',
  heightClass = 'h-72 sm:h-80',
}) => {
  const restPos: [number, number] = [restaurantLat, restaurantLng];
  const drvPos: [number, number] = [driverLat, driverLng];
  const cliPos: [number, number] = [clientLat, clientLng];

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-100`}>
      <MapContainer
        center={drvPos}
        zoom={14}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapBoundsUpdater points={[restPos, drvPos, cliPos]} />

        {/* Route from Restaurant to Driver (completed segment) */}
        <Polyline
          positions={[restPos, drvPos]}
          pathOptions={{ color: '#94A3B8', weight: 4, dashArray: '6, 8' }}
        />

        {/* Active Route from Driver to Client */}
        <Polyline
          positions={[drvPos, cliPos]}
          pathOptions={{ color: '#EA580C', weight: 5 }}
        />

        <Marker position={restPos} icon={restaurantIcon}>
          <Popup>
            <div className="text-xs">
              <p className="font-bold text-slate-900">Restaurante Origen</p>
              <p className="text-slate-600">{restaurantName}</p>
            </div>
          </Popup>
        </Marker>

        <Marker position={drvPos} icon={driverIcon}>
          <Popup>
            <div className="text-xs">
              <p className="font-bold text-orange-600">Repartidor en ruta (GPS)</p>
              <p className="text-slate-700">{driverName}</p>
              <p className="font-mono text-[11px] text-slate-500">
                {driverLat.toFixed(4)}, {driverLng.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>

        <Marker position={cliPos} icon={clientIcon}>
          <Popup>
            <div className="text-xs">
              <p className="font-bold text-emerald-700">Punto de Entrega</p>
              <p className="text-slate-600">{clientAddress}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-3 rounded-xl bg-white/95 backdrop-blur-md px-3 py-2 text-xs text-slate-700 shadow-sm border border-slate-200/80">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" />
          Comercio
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5 font-semibold text-orange-600">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block animate-pulse" />
          Repartidor GPS
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          Tu Dirección
        </span>
      </div>
    </div>
  );
};
