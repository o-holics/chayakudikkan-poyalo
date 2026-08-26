'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
});

const GROUP_SIZES = [2, 5, 8, 10];
const LARGE_SIZES = [8, 10];

const GENDER_COLORS: Record<string, string> = {
  male: 'from-blue-500 to-indigo-600',
  female: 'from-pink-500 to-rose-600',
  other: 'from-purple-500 to-violet-600',
  prefer_not_to_say: 'from-gray-500 to-slate-600',
};

const GENDER_LABELS: Record<string, { label: string; icon: string }> = {
  male: { label: 'Men Only', icon: '👨' },
  female: { label: 'Women Only', icon: '👩' },
  other: { label: 'Other Only', icon: '✨' },
};

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(matchAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!matchAt) { setRemaining(null); return; }

    const update = () => {
      const diff = new Date(matchAt).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [matchAt]);

  if (remaining === null) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Avatar slot ─────────────────────────────────────────────────────────────
function AvatarSlot({ member, index }: { member?: { username: string; gender: string }; index: number }) {
  const isFilled = !!member;
  const gradient = isFilled ? (GENDER_COLORS[member!.gender] ?? 'from-indigo-500 to-purple-600') : '';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold
          transition-all duration-700 ease-out
          ${isFilled
            ? `bg-gradient-to-br ${gradient} text-white shadow-lg ring-2 ring-white/20 scale-110`
            : 'bg-gray-800 border-2 border-dashed border-gray-600 text-gray-600'
          }
        `}
        style={{ transitionDelay: `${index * 60}ms` }}
      >
        {isFilled ? member!.username.charAt(0).toUpperCase() : '?'}

        {/* Glow pulse on fill */}
        {isFilled && (
          <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-30 animate-ping`}
            style={{ animationDuration: '1.2s', animationIterationCount: 1 }}
          />
        )}
      </div>
      <span className="text-[11px] text-gray-400 max-w-[56px] truncate text-center">
        {isFilled ? member!.username : '—'}
      </span>
    </div>
  );
}

// ─── Queue display ────────────────────────────────────────────────────────────
function QueueDisplay({
  current, required, genderFilter, members, matchAt, timerStartedAt
}: {
  current: number;
  required: number;
  genderFilter?: string;
  members: { username: string; gender: string }[];
  matchAt: string | null;
  timerStartedAt: string | null;
}) {
  const countdown = useCountdown(matchAt);
  const isLargeGroup = LARGE_SIZES.includes(required);
  const timerActive = isLargeGroup && !!timerStartedAt;
  const timerPaused = isLargeGroup && !timerStartedAt && current > 0;

  const slots = Array.from({ length: required }, (_, i) => members[i] ?? null);

  const getGenderFilterTag = () => {
    if (!genderFilter || genderFilter === 'mixed') return { text: 'Mixed Group', color: 'bg-gray-800 text-gray-300 border-gray-700' };
    if (genderFilter === 'male') return { text: '👨 Men Only', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
    if (genderFilter === 'female') return { text: '👩 Women Only', color: 'bg-pink-500/10 text-pink-300 border-pink-500/30' };
    return { text: '✨ Custom Group', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
  };

  const filterTag = getGenderFilterTag();

  return (
    <div>
      {/* Header stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-indigo-300 font-semibold text-sm">
            {current} / {required} joined
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${filterTag.color} font-medium`}>
            {filterTag.text}
          </span>
        </div>

        {/* Timer badge */}
        {isLargeGroup && (
          <div className={`
            px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5
            ${timerActive
              ? countdown === '0:00'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : timerPaused
                ? 'bg-gray-800 border-gray-600 text-gray-500'
                : 'bg-gray-800 border-gray-700 text-gray-600'
            }
          `}>
            {timerActive ? (
              <>
                <span>⏱</span>
                <span>{countdown ?? '—'}</span>
              </>
            ) : timerPaused ? (
              <>
                <span>⏸</span>
                <span>Timer paused</span>
              </>
            ) : (
              <>
                <span>⏱</span>
                <span>Timer starts at 5</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${timerActive ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
          style={{ width: `${(current / required) * 100}%` }}
        />
      </div>

      {/* Timer info for large groups */}
      {isLargeGroup && (
        <div className={`rounded-lg p-3 mb-6 text-xs text-center ${timerActive ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-gray-800/50 border border-gray-700 text-gray-500'}`}>
          {timerActive
            ? current >= required
              ? '🚀 Full! Matching now…'
              : `⏱ Group matches when timer hits 0:00 (minimum 5 people). ${required - current} more welcome!`
            : `Need at least 5 people to start the 3-minute timer. ${5 - current > 0 ? `${5 - current} more to go!` : ''}`
          }
        </div>
      )}

      {/* Avatar grid */}
      <div className={`flex flex-wrap justify-center gap-5 mb-8`}>
        {slots.map((member, i) => (
          <AvatarSlot key={i} member={member ?? undefined} index={i} />
        ))}
      </div>

      <p className="text-gray-500 text-sm text-center">
        {required - current > 0
          ? <>Waiting for <span className="text-white font-semibold">{required - current}</span> more {required - current === 1 ? 'person' : 'people'}…</>
          : <span className="text-green-400 font-semibold">Queue full! Matching…</span>
        }
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SpotDetailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const spotId = params.id as string;

  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [genderFilter, setGenderFilter] = useState<'mixed' | 'male' | 'female' | 'other'>('mixed');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { data: spots } = useSWR('/api/spots', fetcher);
  const spot = spots?.find((s: any) => s.id === spotId);

  const { data: profile } = useSWR(user ? '/api/user/profile' : null, fetcher);

  const { data: statusData, mutate: mutateStatus } = useSWR(
    user ? '/api/queue/status' : null,
    fetcher,
    { refreshInterval: 2500 }
  );

  const isMatched = statusData?.status === 'matched';
  const isWaiting = statusData?.status === 'waiting';

  const userGender = profile?.gender;
  const userGenderOption = userGender && userGender !== 'prefer_not_to_say' ? GENDER_LABELS[userGender] : null;

  const handleJoin = async () => {
    if (!selectedSize) return;
    setJoining(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId, groupSize: selectedSize, genderFilter }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to join queue');
      } else {
        await mutateStatus();
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('Network error while joining queue');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await fetch('/api/queue/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId, roomId: statusData?.roomId }),
      });
      await mutateStatus();
      router.push('/dashboard');
    } catch (e) {
      console.error(e);
    } finally {
      setLeaving(false);
    }
  };

  if (!spot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="animate-pulse text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero */}
      <div className="h-64 bg-cover bg-center relative" style={{ backgroundImage: `url(${spot.imageUrl})` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-gray-900" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm mb-2 inline-block">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold">{spot.name}</h1>
          <p className="text-gray-300 text-sm mt-1">{spot.description}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 pt-8">

        {/* ── MATCHED ── */}
        {isMatched && (
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/40 rounded-2xl p-8 text-center animate-fade-in-up">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold mb-1">Your group is ready!</h2>
            <p className="text-gray-400 text-sm mb-6">Find each other using this secret word:</p>

            <div className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-3xl font-extrabold tracking-widest py-4 px-10 rounded-xl shadow-2xl shadow-indigo-500/30 mb-8">
              {statusData.group?.secretWord}
            </div>

            <div className="bg-gray-900/60 rounded-xl p-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Members</h3>
              <div className="flex flex-wrap gap-4 justify-center">
                {(statusData.group?.userDetails ?? []).map((m: any, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${GENDER_COLORS[m.gender] ?? 'from-indigo-500 to-purple-600'} flex items-center justify-center text-lg font-bold`}>
                      {m.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-300">{m.username}</span>
                    <span className="text-[10px] text-gray-600 capitalize">{m.gender?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleLeave} disabled={leaving} className="text-sm text-gray-600 hover:text-red-400 transition-colors">
              End Meetup
            </button>
          </div>
        )}

        {/* ── WAITING ── */}
        {isWaiting && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 animate-fade-in-up">
            <div className="mb-6">
              <h2 className="text-lg font-bold">Waiting for your group</h2>
              <p className="text-gray-500 text-sm">Group of <span className="text-indigo-400 font-semibold">{statusData.required}</span></p>
            </div>

            <QueueDisplay
              current={statusData.current ?? 0}
              required={statusData.required}
              genderFilter={statusData.genderFilter}
              members={statusData.members ?? []}
              matchAt={statusData.matchAt}
              timerStartedAt={statusData.timerStartedAt}
            />

            <div className="mt-6 text-center">
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/30 py-2 px-6 rounded-lg text-sm font-medium transition-colors"
              >
                {leaving ? 'Leaving…' : 'Leave Queue'}
              </button>
            </div>
          </div>
        )}

        {/* ── IDLE — choose size & gender preference ── */}
        {!isMatched && !isWaiting && (
          <div className="animate-fade-in-up">
            {/* Step 1: Group Size */}
            <h2 className="text-lg font-semibold text-gray-200 mb-1">1. Choose group size</h2>
            <p className="text-gray-500 text-sm mb-4">Sizes 8 and 10 match after a 3-minute timer (minimum 5 people).</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {GROUP_SIZES.map((size) => {
                const isLarge = LARGE_SIZES.includes(size);
                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`
                      relative p-5 rounded-xl border-2 text-left transition-all duration-200
                      ${selectedSize === size
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
                      }
                    `}
                  >
                    {isLarge && (
                      <span className="absolute top-2 right-2 text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        Timer
                      </span>
                    )}

                    <div className="text-3xl font-extrabold text-white mb-1">{size}</div>
                    <div className="text-xs text-gray-500">
                      {isLarge ? 'Matches in 3 min (min 5)' : 'Matches when full'}
                    </div>

                    {selectedSize === size && (
                      <div className="absolute bottom-3 right-3 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Step 2: Gender Preference */}
            <h2 className="text-lg font-semibold text-gray-200 mb-1">2. Gender preference</h2>
            <p className="text-gray-500 text-sm mb-4">Choose who you want to meet up with.</p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* Mixed Option */}
              <button
                type="button"
                onClick={() => setGenderFilter('mixed')}
                className={`
                  relative p-4 rounded-xl border-2 text-left transition-all duration-200
                  ${genderFilter === 'mixed'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
                  }
                `}
              >
                <div className="text-xl mb-1">🌍</div>
                <div className="font-semibold text-white text-sm">Mixed Group</div>
                <div className="text-xs text-gray-400 mt-0.5">Open to all genders</div>
                {genderFilter === 'mixed' && (
                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Gender-Only Option (Matches user's profile) */}
              {userGender && userGender !== 'prefer_not_to_say' && userGenderOption ? (
                <button
                  type="button"
                  onClick={() => setGenderFilter(userGender as any)}
                  className={`
                    relative p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${genderFilter === userGender
                      ? userGender === 'female'
                        ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/20'
                        : 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'
                    }
                  `}
                >
                  <div className="text-xl mb-1">{userGenderOption.icon}</div>
                  <div className="font-semibold text-white text-sm">{userGenderOption.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Only for registered {userGender}s</div>
                  {genderFilter === userGender && (
                    <div className={`absolute top-3 right-3 w-4 h-4 rounded-full ${userGender === 'female' ? 'bg-pink-500' : 'bg-blue-500'} flex items-center justify-center`}>
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-gray-700 bg-gray-800/20 flex flex-col justify-center">
                  <div className="text-xs text-gray-500">
                    Gender-specific queues available for registered male or female profiles.
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={!selectedSize || joining}
              className={`
                w-full py-4 rounded-xl font-bold text-lg transition-all duration-200
                ${selectedSize
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30 transform hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }
              `}
            >
              {joining
                ? 'Joining queue…'
                : selectedSize
                  ? `Join ${genderFilter !== 'mixed' ? (genderFilter === 'male' ? 'Men-Only ' : genderFilter === 'female' ? 'Women-Only ' : '') : ''}Group of ${selectedSize}`
                  : 'Select a group size'
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
