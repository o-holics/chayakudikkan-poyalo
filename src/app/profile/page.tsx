'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import UserActionModal from '@/components/UserActionModal';
import LocationInput from '@/components/LocationInput';
import SignOutModal from '@/components/SignOutModal';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
});

const GENDER_COLORS: Record<string, string> = {
  male: 'from-blue-500 to-indigo-600',
  female: 'from-pink-500 to-rose-600',
  other: 'from-purple-500 to-violet-600',
  prefer_not_to_say: 'from-gray-500 to-slate-600',
};

function ProfileContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<'history' | 'location' | 'blocked'>(
    tabParam === 'location' ? 'location' : tabParam === 'blocked' ? 'blocked' : 'history'
  );
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  // Sync tab state whenever searchParams changes or on mount
  useEffect(() => {
    const tab = searchParams.get('tab') || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null);
    if (tab === 'location' || tab === 'blocked' || tab === 'history') {
      setActiveSection(tab);
    }
  }, [searchParams]);

  const switchTab = (tab: 'history' | 'location' | 'blocked') => {
    setActiveSection(tab);
    router.replace(`/profile?tab=${tab}`, { scroll: false });
  };

  const { data: profile, mutate: mutateProfile } = useSWR(user ? '/api/user/profile' : null, fetcher);
  const { data: history = [], isLoading: historyLoading } = useSWR(
    user ? '/api/user/history' : null,
    fetcher
  );
  const { data: blockedUsers = [], mutate: mutateBlocked, isLoading: blockedLoading } = useSWR(
    user ? '/api/safety/block' : null,
    fetcher
  );

  // Location edit states
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(40);
  const [savingLocation, setSavingLocation] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile) {
      setLocationName(profile.location || '');
      setLatitude(profile.latitude ?? null);
      setLongitude(profile.longitude ?? null);
      setSearchRadiusKm(profile.searchRadiusKm || 40);
    }
  }, [profile]);

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocation(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: locationName,
          latitude,
          longitude,
          searchRadiusKm: Number(searchRadiusKm) || 40,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update location settings');
      }

      await mutateProfile();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || 'Error updating location settings');
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-20">
      <div className="max-w-4xl mx-auto mb-8">
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm mb-3 inline-block">
          ← Back to Dashboard
        </Link>

        {/* Profile Card */}
        <div className="bg-gray-800/60 border border-gray-800 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl">
            {profile?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{profile?.username || 'User'}</h1>
              <span className="inline-block bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full capitalize w-fit mx-auto sm:mx-0">
                {profile?.gender ? profile.gender.replace(/_/g, ' ') : 'Member'}
              </span>
            </div>
            <p className="text-gray-400 text-xs mb-3">{profile?.email || user?.email}</p>

            <div className="flex flex-wrap items-center gap-2 mb-4 justify-center sm:justify-start text-xs">
              <span className="bg-gray-900/60 border border-gray-700/60 px-2.5 py-1 rounded-lg text-gray-300 flex items-center gap-1.5">
                <span>📍</span>
                <span className="truncate max-w-[200px]">{profile?.location || 'Location not set'}</span>
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-indigo-300 font-semibold">
                🎯 {profile?.searchRadiusKm || 40} km radius
              </span>
            </div>

            <div className="flex gap-3 justify-center sm:justify-start items-center">
              <Link
                href="/friends"
                className="px-4 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs font-semibold transition-colors"
              >
                👥 View Friends
              </Link>
              <button
                onClick={() => setShowSignOutModal(true)}
                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 px-3 group"
                title="Sign Out"
              >
                <svg className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 mb-6 overflow-x-auto">
          <button
            onClick={() => switchTab('history')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${activeSection === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            ☕ Successful Meetups ({history.length})
          </button>
          <button
            onClick={() => switchTab('location')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${activeSection === 'location' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            📍 Location & Radius ({profile?.searchRadiusKm || 40} km)
          </button>
          <button
            onClick={() => switchTab('blocked')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${activeSection === 'blocked' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            🚫 Blocked Users ({blockedUsers.length})
          </button>
        </div>

        {/* ── SECTION 1: MEETUP HISTORY ── */}
        {activeSection === 'history' && (
          <div>
            {historyLoading ? (
              <div className="text-center py-12 text-gray-500 animate-pulse">Loading meetup history…</div>
            ) : history.length === 0 ? (
              <div className="p-10 rounded-2xl bg-gray-800/30 border border-gray-800 text-center">
                <div className="text-4xl mb-3">☕</div>
                <h3 className="text-lg font-bold text-gray-300 mb-1">No past meetups yet</h3>
                <p className="text-gray-500 text-xs max-w-sm mx-auto">
                  When you join and complete a successful queue meetup at any tea spot, it will be recorded here!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item: any) => {
                  const dateStr = item.matchedAt ? new Date(item.matchedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Recent';

                  return (
                    <div
                      key={item.groupId || item.id}
                      className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">☕</span>
                            <h3 className="font-bold text-base text-white">{item.spotName || 'Meetup Spot'}</h3>
                            <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Group of {item.groupSize}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
                        </div>

                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-center">
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Secret Word</div>
                          <div className="text-sm font-extrabold text-indigo-300 tracking-wider">{item.secretWord}</div>
                        </div>
                      </div>

                      {/* Participants */}
                      <div className="border-t border-gray-700/60 pt-3 mt-3">
                        <div className="text-xs font-semibold text-gray-400 mb-2">People you met with:</div>
                        <div className="flex flex-wrap gap-2">
                          {(item.members || []).map((m: any, idx: number) => {
                            const isSelf = m.uid === user?.uid;
                            return (
                              <button
                                key={idx}
                                disabled={isSelf}
                                onClick={() => setSelectedUser(m)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                                  isSelf
                                    ? 'bg-gray-700/40 text-gray-400 cursor-default'
                                    : 'bg-gray-700/80 hover:bg-gray-600 text-gray-200 hover:text-white cursor-pointer'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${GENDER_COLORS[m.gender] ?? 'from-indigo-500 to-purple-600'} flex items-center justify-center text-[10px] font-bold text-white`}>
                                  {m.username?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium">{m.username} {isSelf ? '(You)' : ''}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2: LOCATION & SEARCH RADIUS ── */}
        {activeSection === 'location' && (
          <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Location & Discovery Distance</h2>
              <p className="text-gray-400 text-xs mt-1">
                Customize your home location and set the maximum relative distance radius for meetup spots shown on your dashboard.
              </p>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-6 max-w-xl">
              {/* Location Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Your Location
                </label>
                <LocationInput
                  value={locationName}
                  onChange={(val) => setLocationName(val)}
                  onLocationSelect={(item) => {
                    setLocationName(item.name);
                    setLatitude(item.lat);
                    setLongitude(item.lon);
                  }}
                  placeholder="Type city, neighborhood, or area..."
                />
                {latitude && longitude && (
                  <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                    <span>GPS Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
                  </div>
                )}
              </div>

              {/* Radius Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-gray-300">
                    Maximum Distance Radius
                  </label>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/30">
                    {searchRadiusKm} km
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={150}
                  step={5}
                  value={searchRadiusKm}
                  onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>5 km (Immediate neighborhood)</span>
                  <span>40 km (Default)</span>
                  <span>150 km (Wide area)</span>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs animate-fade-in">
                  ✓ Location and search radius updated successfully!
                </div>
              )}

              {saveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs animate-fade-in">
                  {saveError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingLocation}
                className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingLocation ? 'Saving Changes…' : 'Save Location Preferences'}
              </button>
            </form>
          </div>
        )}

        {/* ── SECTION 3: BLOCKED USERS ── */}
        {activeSection === 'blocked' && (
          <div>
            {blockedLoading ? (
              <div className="text-center py-12 text-gray-500 animate-pulse">Loading blocked users…</div>
            ) : blockedUsers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-gray-800/30 border border-gray-800 text-center">
                <div className="text-4xl mb-3">🛡️</div>
                <h3 className="text-lg font-bold text-gray-300 mb-1">No blocked users</h3>
                <p className="text-gray-500 text-xs">You haven't blocked anyone. Your blocked list will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map((bu: any) => (
                  <div
                    key={bu.uid}
                    className="p-4 rounded-xl bg-gray-800/60 border border-gray-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-300 text-sm">
                        {bu.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{bu.username}</div>
                        <div className="text-xs text-gray-500">
                          Blocked on {bu.blockedAt ? new Date(bu.blockedAt).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedUser({ ...bu, isBlocked: true })}
                      className="px-3.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Action Modal */}
      {selectedUser && (
        <UserActionModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          targetUser={selectedUser}
          onActionComplete={() => {
            setSelectedUser(null);
            mutateBlocked();
          }}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={logout}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading Profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
