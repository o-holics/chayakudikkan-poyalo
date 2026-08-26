'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import LocationInput from '@/components/LocationInput';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('male');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(40);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          gender,
          location: locationName,
          latitude,
          longitude,
          searchRadiusKm: Number(searchRadiusKm) || 40,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f13]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white flex flex-col justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 mb-3 text-2xl">
            ☕
          </div>
          <h1 className="text-2xl font-bold text-white">
            Complete Your Profile
          </h1>
          <p className="mt-1.5 text-xs text-gray-400">
            Tell us who you are and where you want to find tea meetups.
          </p>
        </div>

        <div className="bg-gray-900/70 border border-gray-800 backdrop-blur-xl rounded-3xl p-7 shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Display Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-white text-sm placeholder-gray-500 outline-none transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. TeaLover99"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Gender <span className="text-red-400">*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-800/80 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-white text-sm outline-none transition-all cursor-pointer"
              >
                <option value="male">👨 Male</option>
                <option value="female">👩 Female</option>
                <option value="other">✨ Other</option>
                <option value="prefer_not_to_say">🔒 Prefer not to say</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                Used for optional gender-specific queue matching.
              </p>
            </div>

            {/* Location with Google-Maps style realtime search */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Your Location <span className="text-indigo-400 text-[11px]">(for finding nearby spots)</span>
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
              <p className="text-[10px] text-gray-500 mt-1">
                We use this to show spots within your preferred travel distance.
              </p>
            </div>

            {/* Default Radius Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Search Radius
                </label>
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
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
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>5 km</span>
                <span>Default: 40 km</span>
                <span>150 km</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {submitting ? 'Saving Profile…' : 'Start Exploring Spots →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
