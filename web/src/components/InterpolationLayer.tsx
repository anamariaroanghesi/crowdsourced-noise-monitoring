'use client';

/**
 * InterpolationLayer
 *
 * A react-leaflet component (must live inside <MapContainer>) that renders a
 * semi-transparent raster overlay built from one of the four interpolation
 * algorithms.  It re-renders whenever the map viewport, the point set, or the
 * selected method changes.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MapPoint } from '@/types';
import {
  type InterpolationMethod,
  type GeoPoint,
  buildContext,
  interpolate,
  dbToRgba,
} from '@/lib/interpolation';

// Grid dimensions per method — balances quality vs. computation time.
// Nearest-Neighbour intentionally uses a coarser grid so the Voronoi
// "cells" are clearly visible after upscaling.
const GRID: Record<InterpolationMethod, number> = {
  idw:     120,
  kriging:  70,
  spline:   90,
  nearest:  45,
};

interface Props {
  points: MapPoint[];
  method: InterpolationMethod;
}

export default function InterpolationLayer({ points, method }: Props) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  // Convert MapPoint → GeoPoint (only valid measurements)
  const geoPoints: GeoPoint[] = useMemo(
    () =>
      points
        .filter((p) => p.quality_flag === 'valid')
        .map((p) => ({ lat: p.latitude, lng: p.longitude, value: p.measured_db })),
    [points]
  );

  // Pre-compute expensive objects (kriging matrix, TPS fit) only when the
  // point set or method changes — NOT on every pan / zoom.
  const ctx = useMemo(
    () => buildContext(geoPoints, method),
    [geoPoints, method]
  );

  const render = useCallback(() => {
    if (geoPoints.length < 2) {
      overlayRef.current?.remove();
      overlayRef.current = null;
      return;
    }

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const gridSize = GRID[method];

    // ── Rasterise ──────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = gridSize;
    canvas.height = gridSize;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const img = ctx2d.createImageData(gridSize, gridSize);

    const latStep = (ne.lat - sw.lat) / gridSize;
    const lngStep = (ne.lng - sw.lng) / gridSize;

    for (let row = 0; row < gridSize; row++) {
      // row 0 → northernmost latitude
      const lat = ne.lat - row * latStep;

      for (let col = 0; col < gridSize; col++) {
        const lng = sw.lng + col * lngStep;

        const db = interpolate(geoPoints, lat, lng, method, ctx);
        const [r, g, b, a] = dbToRgba(db, 185);

        const idx = (row * gridSize + col) * 4;
        img.data[idx]     = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = a;
      }
    }

    ctx2d.putImageData(img, 0, 0);

    // Nearest-Neighbour: keep pixels sharp (pixelated upscale) so the
    // Voronoi boundaries are crisp rather than blurred.
    if (method === 'nearest') {
      ctx2d.imageSmoothingEnabled = false;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const leafletBounds: L.LatLngBoundsExpression = [
      [sw.lat, sw.lng],
      [ne.lat, ne.lng],
    ];

    if (overlayRef.current) {
      overlayRef.current.setUrl(dataUrl);
      overlayRef.current.setBounds(L.latLngBounds(leafletBounds));
    } else {
      overlayRef.current = L.imageOverlay(dataUrl, leafletBounds, {
        opacity: 1,
        // Keep nearest-neighbour cells sharp; smooth the others.
        className: method === 'nearest' ? 'interp-nearest' : 'interp-smooth',
        zIndex: 200,
      }).addTo(map);
    }
  }, [map, geoPoints, method, ctx]);

  useEffect(() => {
    render();
    map.on('moveend', render);
    map.on('zoomend', render);
    return () => {
      map.off('moveend', render);
      map.off('zoomend', render);
      overlayRef.current?.remove();
      overlayRef.current = null;
    };
  }, [map, render]);

  return null;
}
