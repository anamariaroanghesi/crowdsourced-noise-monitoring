'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { authApi } from '@/lib/api';

export default function Navbar() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      setLoggedIn(true);
      authApi
        .me()
        .then((user) => setDisplayName(user.display_name))
        .catch(() => {
          // token may be invalid; ignore silently
        });
    }
  }, []);

  function handleLogout() {
    authApi.logout().catch(() => {});
    clearToken();
    setLoggedIn(false);
    setDisplayName(null);
    router.push('/login');
  }

  return (
    <nav className="bg-[#1a1a2e] text-white shadow-lg z-50 relative">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: Logo + title */}
        <Link href="/map" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-8 h-8 bg-[#e94560] rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">
            Noise Monitor{' '}
            <span className="text-[#e94560]">BCN</span>
          </span>
        </Link>

        {/* Right: auth controls */}
        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <span className="text-sm text-gray-300 hidden sm:block">
                {displayName ?? 'User'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm bg-[#0f3460] hover:bg-[#e94560] rounded-lg transition font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm hover:text-[#e94560] transition font-medium"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 text-sm bg-[#e94560] hover:bg-[#c73652] rounded-lg transition font-medium"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
