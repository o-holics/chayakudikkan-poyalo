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
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-indigo-400">Chayakudikkan Poyalo</h1>
          <p className="text-gray-400">Welcome, {profile?.username}!</p>
        </div>
        <button 
          onClick={() => {
            // Sign out logic would go here
            document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            window.location.href = '/login';
          }}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-md text-sm"
        >
          Sign Out
        </button>
      </header>

      <div className="max-w-5xl mx-auto">
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
