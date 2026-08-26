'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { calculateDistanceKm } from '@/lib/geo';
import SignOutModal from '@/components/SignOutModal';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
});

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const { data: profile, error: profileError } = useSWR(
    user ? '/api/user/profile' : null,
    fetcher
  );

  const { data: spots, error: spotsError } = useSWR('/api/spots', fetcher, {
    refreshInterval: 10000,
  });

  const { data: friendsData } = useSWR(user ? '/api/friends' : null, fetcher, {
    refreshInterval: 10000,
  });
  const pendingRequestsCount = friendsData?.requests?.length || 0;

  const { data: queueStatus, mutate: mutateQueueStatus } = useSWR(
    user ? '/api/queue/status' : null,
    fetcher,
    { refreshInterval: 3000 }
  );

  const isUserWaiting = queueStatus?.status === 'waiting';
  const isUserMatched = queueStatus?.status === 'matched';
  const activeSpot = isUserWaiting ? spots?.find((s: any) => s.id === queueStatus?.spotId) : null;

  const [joiningSpotId, setJoiningSpotId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Use the user's saved radius preference from profile
  const userRadius = profile?.searchRadiusKm || 40;

  const handleQuickJoin = async (spotId: string) => {
    setJoiningSpotId(spotId);
    setJoinError(null);
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId, groupSize: 6, genderFilter: 'mixed' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join default queue');
        setJoiningSpotId(null);
      } else {
        await mutateQueueStatus();
        router.push(`/spots/${spotId}`);
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join default queue');
      setJoiningSpotId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profileError && profileError.message.includes('404')) {
      router.replace('/onboarding');
    }
  }, [profileError, router]);

  if (authLoading || (!profile && !profileError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f13]">
        <div className="text-white animate-pulse">Loading Chai Meetups...</div>
      </div>
    );
  }

  // Calculate relative distance for each spot
  const userLat = profile?.latitude ?? null;
  const userLon = profile?.longitude ?? null;

  const enrichedSpots = (spots || []).map((spot: any) => {
    const distanceKm =
      userLat !== null && userLon !== null && spot.latitude && spot.longitude
        ? calculateDistanceKm(userLat, userLon, spot.latitude, spot.longitude)
        : null;
    return {
      ...spot,
      distanceKm,
    };
  });

  // Filter spots by saved profile distance radius
  const filteredSpots = enrichedSpots
    .filter((s: any) => {
      if (s.distanceKm === null) return true; // If coordinates not set, keep visible
      return s.distanceKm <= userRadius;
    })
    .sort((a: any, b: any) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Chayakudikkan Poyalo?
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              Find instant tea meetups with verified people near you.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/friends"
              className="relative p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105"
            >
              <span>👥</span>
              <span className="hidden sm:inline">Friends</span>
              {pendingRequestsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {pendingRequestsCount}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="p-2 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-extrabold text-white shadow-sm ring-1 ring-white/20">
                {profile?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline">{profile?.username || 'Profile'}</span>
            </Link>

            <button
              onClick={() => setShowSignOutModal(true)}
              className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 transition-all cursor-pointer shadow-sm hover:scale-105 flex items-center justify-center group"
              title="Sign Out"
            >
              <svg className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* User Active Queue Banner */}
        {isUserWaiting && (
          <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900/40 border border-indigo-500/40 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-lg animate-pulse">
                ⏳
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  You are in the queue for <span className="text-indigo-300">{activeSpot?.name || 'a Meetup Spot'}</span>
                </h3>
                <p className="text-xs text-gray-300">
                  {queueStatus?.current} of {queueStatus?.required} people joined ({queueStatus?.genderFilter || 'mixed'} group)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/spots/${queueStatus.spotId}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
              >
                Go to Waiting Room →
              </Link>
            </div>
          </div>
        )}

        {/* User Active Meetup Banner */}
        {isUserMatched && (
          <div className="bg-gradient-to-r from-green-900/40 via-indigo-900/40 to-purple-900/40 border border-green-500/40 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-lg">
                🎉
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Active Meetup in Progress!</h3>
                <p className="text-xs text-gray-300">
                  Secret Word: <span className="text-green-300 font-bold tracking-wider">{queueStatus.group?.secretWord}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={queueStatus.group?.spotId ? `/spots/${queueStatus.group.spotId}` : `/spots/spot-1`}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all shadow-md"
              >
                View Meetup →
              </Link>
            </div>
          </div>
        )}

        {joinError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between animate-fade-in">
            <span>{joinError}</span>
            <button onClick={() => setJoinError(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {/* ── LOCATION & SEARCH RADIUS BAR ── */}
        <div className="bg-gray-900/80 border border-gray-800 backdrop-blur-md rounded-2xl p-4 mb-8 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📍</span>
            <div>
              <div className="text-xs text-gray-400">Spots near your location:</div>
              <div className="text-sm font-semibold text-white flex flex-wrap items-center gap-2">
                <span className="truncate max-w-xs">{profile?.location || 'Location Not Set'}</span>
                <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                  within {userRadius} km
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/profile?tab=location"
            className="px-3.5 py-2 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700/80 text-gray-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1.5 self-end sm:self-auto"
          >
            <span>⚙️</span>
            <span>Change Location / Radius</span>
          </Link>
        </div>

        {/* Section Heading with Count */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            Choose a Meetup Spot <span className="text-gray-500 text-sm font-normal">({filteredSpots.length} available)</span>
          </h2>
        </div>

        {/* Spots Grid or Empty State */}
        {filteredSpots.length === 0 ? (
          <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-12 text-center max-w-md mx-auto my-6">
            <div className="text-4xl mb-3">📍</div>
            <h3 className="text-lg font-bold text-white mb-1">No spots within {userRadius} km</h3>
            <p className="text-gray-400 text-xs mb-6">
              We couldn't find any tea spots within {userRadius} km of {profile?.location || 'your location'}. You can increase your search radius in your profile settings.
            </p>
            <Link
              href="/profile?tab=location"
              className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg cursor-pointer"
            >
              Adjust Distance Radius in Profile →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSpots.map((spot: any) => (
              <div
                key={spot.id}
                className="bg-gray-900/70 rounded-2xl overflow-hidden shadow-xl border border-gray-800 hover:border-gray-700/80 transition-all flex flex-col backdrop-blur-sm group"
              >
                <div
                  className="h-48 bg-cover bg-center relative"
                  style={{ backgroundImage: `url(${spot.imageUrl})` }}
                >
                  {/* Relative Distance Tag */}
                  {spot.distanceKm !== null && (
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <span>🚗</span>
                      <span>{spot.distanceKm} km away</span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {spot.name}
                      </h3>
                      {spot.activeCount > 0 ? (
                        <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>{spot.activeCount} active</span>
                        </span>
                      ) : (
                        <span className="bg-gray-800 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-700/60">
                          Quiet now
                        </span>
                      )}
                    </div>

                    {/* Place Name and Relative Distance */}
                    <p className="text-gray-400 text-xs mb-3 line-clamp-2 flex items-center gap-1">
                      <span>📍</span>
                      <span>{spot.place || spot.description}</span>
                    </p>

                    {/* Active Users Breakdown */}
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2 bg-gray-800/50 py-1.5 px-2.5 rounded-lg border border-gray-700/40">
                      <span className="flex items-center gap-1">
                        <span className="text-indigo-400 text-xs">⏳</span>
                        <span><strong>{spot.waitingCount || 0}</strong> waiting</span>
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="flex items-center gap-1">
                        <span className="text-emerald-400 text-xs">☕</span>
                        <span><strong>{spot.matchedCount || 0}</strong> in meetups</span>
                      </span>
                    </div>
                  </div>

                  {/* Dual Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gray-700/50">
                    <button
                      type="button"
                      onClick={() => handleQuickJoin(spot.id)}
                      disabled={joiningSpotId !== null}
                      className="w-full text-center bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-indigo-600/25 hover:shadow-indigo-500/40 active:scale-[0.97] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1.5"
                      title="Quick Join: Group of 6 (Mixed, 1m30s timer at 3+)"
                    >
                      {joiningSpotId === spot.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="text-amber-300">⚡</span>
                          <span>Join Default</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/spots/${spot.id}`}
                      className="w-full text-center bg-gradient-to-b from-gray-800/90 to-gray-900/90 hover:from-gray-700 hover:to-gray-800 text-gray-200 hover:text-white border border-gray-700/80 hover:border-indigo-500/50 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-indigo-500/10 active:scale-[0.97] flex items-center justify-center gap-1.5 group/btn"
                    >
                      <span className="group-hover/btn:rotate-45 transition-transform duration-300">⚙️</span>
                      <span>Custom</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign Out Confirmation Modal */}
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={logout}
      />
    </div>
  );
}
