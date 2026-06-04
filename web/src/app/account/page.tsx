'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { authApi, gamificationApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import type { User, GamificationProfile, BadgeCatalogItem } from '@/types';

const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
};
const MAX_LEVEL = 5;

function getLevelProgress(level: number, totalPoints: number) {
  if (level >= MAX_LEVEL) return { progress: 100, pointsNeeded: 0, nextThreshold: LEVEL_THRESHOLDS[MAX_LEVEL] };
  const currentThreshold = LEVEL_THRESHOLDS[level];
  const nextThreshold = LEVEL_THRESHOLDS[level + 1];
  const progress = Math.round(((totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
  return { progress, pointsNeeded: nextThreshold - totalPoints, nextThreshold };
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-gray-500',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-yellow-500',
  5: 'bg-[#e94560]',
};

const BADGE_ICONS: Record<string, string> = {
  first_measurement: '🎯',
  measurements_10: '📡',
  measurements_100: '🏙️',
  streak_7: '🔥',
  streak_30: '⚡',
  high_accuracy: '🎯',
  district_mapper: '🗺️',
  weekend_contributor: '🌤️',
  night_contributor: '🦉',
  community_champion: '🏆',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl px-5 py-4 border border-white/5 flex flex-col gap-1">
      <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [badges, setBadges] = useState<BadgeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    Promise.all([authApi.me(), gamificationApi.getProfile(), gamificationApi.getBadges()])
      .then(([u, p, b]) => {
        setUser(u);
        setProfile(p);
        setBadges(b);
        setLoading(false);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-[#16213e] text-white">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  const { progress, pointsNeeded } = getLevelProgress(profile.level, profile.total_points);
  const levelColor = LEVEL_COLORS[profile.level] ?? 'bg-[#e94560]';
  const memberSince = new Date(user.created_at).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="min-h-screen bg-[#16213e] text-white">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Profile header */}
        <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/5 flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-[#0f3460] flex items-center justify-center flex-shrink-0 text-2xl font-bold text-[#e94560]">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{user.display_name}</h1>
            <p className="text-gray-400 text-sm truncate">{user.email}</p>
            <p className="text-gray-500 text-xs mt-1">Member since {memberSince}</p>

            {/* Level + progress bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-200">
                  Level {profile.level} — {profile.level_name}
                </span>
                {profile.level < MAX_LEVEL ? (
                  <span className="text-gray-500">{pointsNeeded} pts to next level</span>
                ) : (
                  <span className="text-[#e94560] font-semibold">Max level</span>
                )}
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${levelColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div>
          <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Points" value={profile.total_points.toLocaleString()} />
            <StatCard label="Current Streak" value={`${profile.current_streak}d`} />
            <StatCard label="Longest Streak" value={`${profile.longest_streak}d`} />
            <StatCard label="Badges Earned" value={`${earnedCount} / ${badges.length}`} />
          </div>
        </div>

        {/* Badges */}
        <div>
          <h2 className="text-sm uppercase tracking-wider text-gray-500 mb-3">Achievements</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.code}
                className={`rounded-xl p-4 border flex gap-3 items-start transition ${
                  badge.earned
                    ? 'bg-[#1a1a2e] border-[#e94560]/30'
                    : 'bg-[#1a1a2e]/40 border-white/5 opacity-50'
                }`}
              >
                <span className="text-2xl leading-none flex-shrink-0">
                  {BADGE_ICONS[badge.code] ?? '🏅'}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${badge.earned ? 'text-white' : 'text-gray-400'}`}>
                    {badge.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{badge.description}</p>
                  {badge.earned && badge.awarded_at && (
                    <p className="text-xs text-[#e94560] mt-1">
                      {new Date(badge.awarded_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                  {!badge.earned && (
                    <p className="text-xs text-gray-600 mt-1">+{badge.points_reward} pts</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
