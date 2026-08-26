'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
});

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { data: profile, error: profileError } = useSWR(
    user ? '/api/user/profile' : null,
    fetcher
  );

  const { data: spots, error: spotsError } = useSWR('/api/spots', fetcher, {
    refreshInterval: 10000, // Poll every 10 seconds for active wait counts
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

  useEffect(() => {
    if (profileError && profileError.message.includes('Fetch failed')) {
      // If we got a 404 from the profile fetch, we need to onboard
      router.replace('/onboarding');
    }
  }, [profileError, router]);

  if (authLoading || (user && !profile && !profileError) || !spots) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-white">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Chayakudikkan Poyalo
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Welcome, <span className="text-white font-semibold">{profile?.username}</span>!</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/friends"
            className="relative bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <span>👥</span>
            <span>Friends</span>
            {pendingRequestsCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <span>👤</span>
            <span>Profile</span>
          </Link>

          <button 
            onClick={() => {
              document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
              window.location.href = '/login';
            }}
            className="bg-gray-800/80 hover:bg-red-500/10 hover:text-red-400 border border-gray-700 px-3 py-2 rounded-xl text-sm text-gray-400 transition-colors"
            title="Sign Out"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto">
        {/* Active Queue / Meetup Alert Banner */}
        {isUserWaiting && (
          <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xl shadow-indigo-950/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-lg animate-pulse">
                ⏳
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">You are currently in an active queue!</h3>
                <p className="text-xs text-gray-300">
                  {activeSpot?.name ? `At ${activeSpot.name}` : 'Waiting for group'} • {queueStatus.current} / {queueStatus.required} joined
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/spots/${queueStatus.spotId}`}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Go to Queue →
              </Link>
            </div>
          </div>
        )}

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

        <h2 className="text-xl font-semibold mb-6">Choose a Meetup Spot</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spots.map((spot: any) => (
            <div key={spot.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col">
              <div 
                className="h-48 bg-cover bg-center" 
                style={{ backgroundImage: `url(${spot.imageUrl})` }}
              />
              <div className="p-5 flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white">{spot.name}</h3>
                    {spot.waitingCount > 0 && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2 py-1 rounded-full flex items-center">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1 animate-pulse"></span>
                        {spot.waitingCount} waiting
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{spot.description}</p>
                </div>
                
                <Link 
                  href={`/spots/${spot.id}`}
                  className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-md font-medium transition-colors"
                >
                  Join Queue
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
