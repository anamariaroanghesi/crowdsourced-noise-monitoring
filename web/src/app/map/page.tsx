'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import StatsPanel from '@/components/StatsPanel';
import FilterPanel from '@/components/FilterPanel';
import LegendPanel from '@/components/LegendPanel';
import { mapApi } from '@/lib/api';
import type { MapPoint, Statistics, MapPointsResponse } from '@/types';

// Dynamically import the map (Leaflet requires browser APIs)
const NoiseMap = dynamic(() => import('@/components/NoiseMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#e94560] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

interface Filters {
  time_window: string;
  min_db?: number;
  max_db?: number;
}

export default function MapPage() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [dataDensity, setDataDensity] = useState<MapPointsResponse['data_density'] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ time_window: '24h' });

  const fetchData = useCallback(async (f: Filters) => {
    setLoading(true);
    setStatsLoading(true);
    setError(null);

    try {
      const [pointsRes, statsRes] = await Promise.allSettled([
        mapApi.getPoints(f),
        mapApi.getStatistics({ time_window: f.time_window }),
      ]);

      if (pointsRes.status === 'fulfilled') {
        setPoints(pointsRes.value.points);
        setTotalCount(pointsRes.value.total);
        setDataDensity(pointsRes.value.data_density);
      } else {
        setPoints([]);
        setTotalCount(0);
        const errMsg =
          (pointsRes.reason as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail ?? 'Failed to load map data.';
        setError(typeof errMsg === 'string' ? errMsg : 'Failed to load map data.');
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats(null);
      }
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  function handleFilterChange(newFilters: Filters) {
    setFilters(newFilters);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area (75%) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Showing</span>
              <span className="font-semibold text-gray-800">
                {loading ? '—' : points.length}
              </span>
              <span className="text-sm text-gray-500">
                of {loading ? '—' : totalCount} measurements
              </span>
            </div>

            {dataDensity === 'low' && !loading && (
              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1 text-xs font-medium">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Low data density — results may not be representative
              </div>
            )}

            {error && (
              <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1 text-xs font-medium">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}

            <button
              onClick={() => fetchData(filters)}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1a1a2e] hover:bg-[#0f3460] disabled:opacity-50 text-white rounded-lg transition font-medium"
            >
              <svg
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <NoiseMap points={points} />
          </div>
        </div>

        {/* Sidebar (25%) */}
        <aside className="w-72 xl:w-80 flex-shrink-0 bg-gray-50 border-l border-gray-200 overflow-y-auto sidebar-scroll">
          <div className="p-4 space-y-4">
            <FilterPanel onFilterChange={handleFilterChange} />
            <StatsPanel stats={stats} loading={statsLoading} />
            <LegendPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
