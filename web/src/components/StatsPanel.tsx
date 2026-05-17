'use client';

import type { Statistics } from '@/types';

interface Props {
  stats: Statistics | null;
  loading: boolean;
}

function dbColorClass(db: number | null): string {
  if (db === null) return 'text-gray-400';
  if (db < 50) return 'text-green-500';
  if (db < 70) return 'text-yellow-500';
  if (db < 85) return 'text-orange-500';
  return 'text-red-500';
}

function fmt(db: number | null): string {
  return db != null ? `${db.toFixed(1)} dB` : '—';
}

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-2">
      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse" />
    </div>
  );
}

function StatRow({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${colorClass ?? 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

export default function StatsPanel({ stats, loading }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-[#e94560]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        Statistics
      </h2>

      {loading ? (
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : stats ? (
        <div>
          <StatRow
            label="Measurements"
            value={`${stats.valid_count} / ${stats.total_count}`}
          />
          <StatRow
            label="Average"
            value={fmt(stats.avg_db)}
            colorClass={dbColorClass(stats.avg_db)}
          />
          <StatRow
            label="Minimum"
            value={fmt(stats.min_db)}
            colorClass="text-green-600"
          />
          <StatRow
            label="Maximum"
            value={fmt(stats.max_db)}
            colorClass="text-red-600"
          />
          <StatRow
            label="Median (p50)"
            value={fmt(stats.percentile_50)}
          />
          <StatRow
            label="p95"
            value={fmt(stats.percentile_95)}
            colorClass={dbColorClass(stats.percentile_95)}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          No statistics available
        </p>
      )}
    </div>
  );
}
