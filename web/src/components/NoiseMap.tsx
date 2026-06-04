'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import type { MapPoint } from '@/types';
import type { InterpolationMethod } from '@/lib/interpolation';
import InterpolationLayer from './InterpolationLayer';

// Fix default marker icon broken by webpack
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

const BUCHAREST_CENTER: [number, number] = [44.4268, 26.1025];
const INITIAL_ZOOM = 12;

function dbColor(db: number): string {
  if (db < 50) return '#22c55e';
  if (db < 70) return '#eab308';
  if (db < 85) return '#f97316';
  return '#ef4444';
}

function formatTimestamp(ts: string): string {
  try {
    return format(new Date(ts), 'dd MMM yyyy, HH:mm');
  } catch {
    return ts;
  }
}

function qualityLabel(flag: string): string {
  const labels: Record<string, string> = {
    valid: 'Valid',
    suspect: 'Suspect',
    invalid: 'Invalid',
    unchecked: 'Unchecked',
    low_accuracy: 'Low accuracy',
    out_of_range: 'Out of range',
  };
  return labels[flag] ?? flag;
}

interface Props {
  points: MapPoint[];
  /** 'points' = raw markers only; anything else = interpolation overlay */
  interpolationMethod: InterpolationMethod | 'points';
}

export default function NoiseMap({ points, interpolationMethod }: Props) {
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [points]);

  const showOverlay = interpolationMethod !== 'points';
  // In overlay mode markers shrink so the surface is the focus;
  // in points mode they stay at full size.
  const markerRadius = showOverlay ? 4 : 8;
  const markerOpacity = showOverlay ? 0.65 : 0.75;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={BUCHAREST_CENTER}
        zoom={INITIAL_ZOOM}
        style={{ width: '100%', height: '100%' }}
        className="rounded-none"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Interpolation overlay — rendered below markers */}
        {showOverlay && (
          <InterpolationLayer
            points={points}
            method={interpolationMethod as InterpolationMethod}
          />
        )}

        {/* Sample point markers — always shown for spatial reference */}
        {points.map((point) => {
          const color = dbColor(point.measured_db);
          return (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={markerRadius}
              pathOptions={{
                color: '#fff',
                weight: showOverlay ? 1 : 1.5,
                fillColor: color,
                fillOpacity: markerOpacity,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <div className="font-semibold text-base mb-1">
                    <span style={{ color }} className="font-bold">
                      {point.measured_db.toFixed(1)} dB
                    </span>
                  </div>
                  <div className="text-gray-600 space-y-0.5">
                    <div>
                      <span className="font-medium">Time:</span>{' '}
                      {formatTimestamp(point.timestamp)}
                    </div>
                    <div>
                      <span className="font-medium">Quality:</span>{' '}
                      {qualityLabel(point.quality_flag)}
                    </div>
                    <div>
                      <span className="font-medium">Coords:</span>{' '}
                      {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* No data overlay */}
      {points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 shadow-lg text-center">
            <svg
              className="w-10 h-10 text-gray-400 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p className="text-gray-700 font-medium">No measurements found</p>
            <p className="text-gray-500 text-sm mt-1">
              Try adjusting the filters or time window
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
