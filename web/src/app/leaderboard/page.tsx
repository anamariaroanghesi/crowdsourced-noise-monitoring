'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { gamificationApi } from '@/lib/api';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types';

type Period = 'weekly' | 'monthly' | 'all_time';

const PERIOD_LABELS: Record<Period, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  all_time: 'All-time',
};

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl leading-none">🥇</span>;
  if (rank === 2) return <span className="text-2xl leading-none">🥈</span>;
  if (rank === 3) return <span className="text-2xl leading-none">🥉</span>;
  return (
    <span className="w-8 text-center font-bold text-gray-400 text-sm tabular-nums">
      {rank}
    </span>
  );
}

function LevelBadge({ level, levelName }: { level: number; levelName: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#0f3460] text-[#e94560] border border-[#e94560]/30"
      title={levelName}
    >
      Lv {level}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-white/5 animate-pulse">
          <td className="px-4 py-3 w-12">
            <div className="h-5 w-5 bg-white/10 rounded mx-auto" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 bg-white/10 rounded w-32" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 bg-white/10 rounded w-12" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="h-4 bg-white/10 rounded w-16 ml-auto" />
          </td>
          <td className="px-4 py-3 text-right">
            <div className="h-4 bg-white/10 rounded w-16 ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('all_time');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    gamificationApi
      .getLeaderboard(period)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load leaderboard. Please try again.');
        setLoading(false);
      });
  }, [period]);

  const periodCountLabel = period === 'all_time' ? 'Points' : 'Measurements';

  return (
    <div className="min-h-screen bg-[#16213e] text-white">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Leaderboard</h1>
          <p className="text-gray-400 text-sm">
            Top contributors to the Bucharest noise monitoring network
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex justify-center gap-2 mb-8">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                period === p
                  ? 'bg-[#e94560] text-white shadow-lg shadow-[#e94560]/30'
                  : 'bg-[#0f3460] text-gray-300 hover:bg-[#1a1a4e]'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-xl border border-white/5">
          {/* Table header */}
          <div className="bg-[#0f3460] px-4 py-3 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-[#e94560]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 21V10M12 21V3M16 21v-7"
              />
            </svg>
            <span className="font-bold text-sm uppercase tracking-wider text-gray-300">
              {PERIOD_LABELS[period]} Rankings
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 uppercase text-xs border-b border-white/10">
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3 text-left">Contributor</th>
                <th className="px-4 py-3 text-center">Level</th>
                <th className="px-4 py-3 text-right">{periodCountLabel}</th>
                <th className="px-4 py-3 text-right">Total Points</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              ) : !data || data.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <svg
                        className="w-12 h-12 text-gray-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8 21V10M12 21V3M16 21v-7"
                        />
                      </svg>
                      <span>No entries yet for this period.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.entries.map((entry: LeaderboardEntry) => (
                  <tr
                    key={entry.rank}
                    className={`border-b border-white/5 transition hover:bg-white/5 ${
                      entry.rank <= 3 ? 'bg-white/[0.02]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <RankMedal rank={entry.rank} />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.display_name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <LevelBadge level={entry.level} levelName={entry.level_name} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                      {period === 'all_time'
                        ? entry.total_points.toLocaleString()
                        : entry.measurement_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#e94560]">
                      {entry.total_points.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-gray-600">
          Updates in real-time as measurements are submitted.
        </p>
      </main>
    </div>
  );
}
