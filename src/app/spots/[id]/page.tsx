'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import UserActionModal from '@/components/UserActionModal';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
});

const GROUP_SIZES = [2, 3, 6];
const LARGE_SIZES = [6];

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
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Avatar slot ─────────────────────────────────────────────────────────────
function AvatarSlot({
  member, index, isFriend, onSelect
}: {
  member?: { uid?: string; username: string; gender: string };
  index: number;
  isFriend?: boolean;
  onSelect?: (m: any) => void;
}) {
  const isFilled = !!member;
  const gradient = isFilled ? (GENDER_COLORS[member!.gender] ?? 'from-indigo-500 to-purple-600') : '';

  return (
    <div
      onClick={() => isFilled && onSelect && onSelect(member)}
      className={`flex flex-col items-center gap-1.5 relative ${isFilled && onSelect ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
    >
      <div
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold
          transition-all duration-700 ease-out
          ${isFilled
            ? isFriend
              ? `bg-gradient-to-br ${gradient} text-white shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900 scale-110`
              : `bg-gradient-to-br ${gradient} text-white shadow-lg ring-2 ring-white/20 scale-110`
            : 'bg-gray-800 border-2 border-dashed border-gray-600 text-gray-600'
          }
        `}
        style={{ transitionDelay: `${index * 60}ms` }}
      >
        {isFilled ? member!.username.charAt(0).toUpperCase() : '?'}

        {/* Friend badge */}
        {isFilled && isFriend && (
          <span
            className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-gray-900 animate-pulse"
            title="Your Friend"
          >
            💚
          </span>
        )}

        {/* Glow pulse on fill */}
        {isFilled && (
          <span className={`absolute inset-0 rounded-full ${isFriend ? 'bg-emerald-400' : `bg-gradient-to-br ${gradient}`} opacity-30 animate-ping`}
            style={{ animationDuration: '1.2s', animationIterationCount: 1 }}
          />
        )}
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[11px] text-gray-300 font-medium max-w-[56px] truncate text-center">
          {isFilled ? member!.username : '—'}
        </span>
        {isFilled && isFriend && (
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 mt-0.5 animate-fade-in">
            Friend
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Queue display ────────────────────────────────────────────────────────────
function QueueDisplay({
  current, required, genderFilter, members, matchAt, timerStartedAt, friendUids, onSelectMember
}: {
  current: number;
  required: number;
  genderFilter?: string;
  members: { uid?: string; username: string; gender: string }[];
  matchAt: string | null;
  timerStartedAt: string | null;
  friendUids?: Set<string>;
  onSelectMember?: (m: any) => void;
}) {
  const countdown = useCountdown(matchAt);
  const isLargeGroup = LARGE_SIZES.includes(required);
  const timerActive = isLargeGroup && !!timerStartedAt;
  const timerPaused = isLargeGroup && !timerStartedAt && current > 0;

  const slots = Array.from({ length: required }, (_, i) => members[i] ?? null);

  const friendsInQueue = members.filter(m => m.uid && friendUids?.has(m.uid));

  const getGenderFilterTag = () => {
    if (!genderFilter || genderFilter === 'mixed') return { text: 'Mixed Group', color: 'bg-gray-800 text-gray-300 border-gray-700' };
    if (genderFilter === 'male') return { text: '👨 Men Only', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
    if (genderFilter === 'female') return { text: '👩 Women Only', color: 'bg-pink-500/10 text-pink-300 border-pink-500/30' };
    return { text: '✨ Custom Group', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
  };

  const filterTag = getGenderFilterTag();

  return (
    <div>
      {/* Friend presence alert banner */}
      {friendsInQueue.length > 0 && (
        <div className="mb-5 p-3 rounded-xl bg-gradient-to-r from-emerald-950/70 via-teal-950/60 to-emerald-950/70 border border-emerald-500/40 flex items-center gap-3 animate-fade-in shadow-xl shadow-emerald-950/30">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-base">
            ✨
          </div>
          <div className="text-xs">
            <span className="font-bold text-emerald-300">
              {friendsInQueue.length === 1
                ? `Your friend ${friendsInQueue[0].username} is in this queue with you!`
                : `${friendsInQueue.map(f => f.username).join(', ')} (your friends) are in this queue!`}
            </span>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">You'll be meeting up together!</p>
          </div>
        </div>
      )}

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
                <span>Timer starts at 3</span>
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

      {/* Timer info for size 6 groups */}
      {isLargeGroup && (
        <div className={`rounded-lg p-3 mb-6 text-xs text-center ${timerActive ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-gray-800/50 border border-gray-700 text-gray-500'}`}>
          {timerActive
            ? current >= required
              ? '🚀 Full! Matching now…'
              : `⏱ Group matches when timer hits 0:00 (minimum 3 people). ${required - current} more welcome!`
            : `Need at least 3 people to start the 1m 30s timer. ${3 - current > 0 ? `${3 - current} more to go!` : ''}`
          }
        </div>
      )}

      {/* Avatar grid */}
      <div className={`flex flex-wrap justify-center gap-5 mb-8`}>
        {slots.map((member, i) => (
          <AvatarSlot
            key={i}
            member={member ?? undefined}
            index={i}
            isFriend={!!(member?.uid && friendUids?.has(member.uid))}
            onSelect={onSelectMember}
          />
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

  const [queueMode, setQueueMode] = useState<'default' | 'custom'>('default');
  const [selectedSize, setSelectedSize] = useState<number>(6);
  const [genderFilter, setGenderFilter] = useState<'mixed' | 'male' | 'female' | 'other'>('mixed');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { data: spots } = useSWR('/api/spots', fetcher);
  const spot = spots?.find((s: any) => s.id === spotId);

  const { data: profile } = useSWR(user ? '/api/user/profile' : null, fetcher);
  const { data: friendsData } = useSWR(user ? '/api/friends' : null, fetcher, {
    refreshInterval: 5000,
  });
  const friendUids = new Set<string>((friendsData?.friends || []).map((f: any) => f.uid));

  const { data: statusData, mutate: mutateStatus } = useSWR(
    user ? '/api/queue/status' : null,
    fetcher,
    { refreshInterval: 2500 }
  );

  const isMatched = statusData?.status === 'matched';
  const isWaiting = statusData?.status === 'waiting';

  const meetupRemaining = useCountdown(isMatched ? (statusData?.expiresAt || null) : null);

  const userGender = profile?.gender;
  const userGenderOption = userGender && userGender !== 'prefer_not_to_say' ? GENDER_LABELS[userGender] : null;

  const handleJoinQueue = async (sizeToJoin: number, filterToJoin: string) => {
    setJoining(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spotId, groupSize: sizeToJoin, genderFilter: filterToJoin }),
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
          <p className="text-gray-300 text-sm mt-1 flex items-center gap-1.5">
            <span>📍</span>
            <span>{spot.place || spot.description}</span>
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 pt-8">

        {/* ── MATCHED ── */}
        {isMatched && (
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/40 rounded-2xl p-8 text-center animate-fade-in-up">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold mb-1">Your group is ready!</h2>
            <p className="text-gray-400 text-sm mb-4">Find each other using this secret word:</p>

            {meetupRemaining && (
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3.5 py-1.5 rounded-full mb-6 font-medium">
                <span>⏱️</span>
                <span>Active meetup • Disbands in <strong>{meetupRemaining}</strong></span>
              </div>
            )}

            <div className="block bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-3xl font-extrabold tracking-widest py-4 px-10 rounded-xl shadow-2xl shadow-indigo-500/30 mb-8 max-w-sm mx-auto">
              {statusData.group?.secretWord}
            </div>

            <div className="bg-gray-900/60 rounded-xl p-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Members (click to interact)</h3>
              <div className="flex flex-wrap gap-4 justify-center">
                {(statusData.group?.userDetails ?? []).map((m: any, i: number) => {
                  const isSelf = m.uid === user?.uid;
                  const isFriend = !!(m.uid && friendUids.has(m.uid));
                  return (
                    <button
                      key={i}
                      disabled={isSelf}
                      onClick={() => setSelectedUser(m)}
                      className={`flex flex-col items-center gap-1 transition-transform ${isSelf ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                    >
                      <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${GENDER_COLORS[m.gender] ?? 'from-indigo-500 to-purple-600'} flex items-center justify-center text-lg font-bold shadow-md ${isFriend ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900 shadow-emerald-500/30' : ''}`}>
                        {m.username.charAt(0).toUpperCase()}
                        {isFriend && (
                          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                            💚
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-300 font-medium">{m.username} {isSelf ? '(You)' : ''}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 capitalize">{m.gender?.replace(/_/g, ' ')}</span>
                        {isFriend && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            Friend
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
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
              friendUids={friendUids}
              onSelectMember={(m) => {
                if (m?.username !== profile?.username) {
                  setSelectedUser(m);
                }
              }}
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

        {/* ── IDLE — Direct Action: Join Default & Custom Queue ── */}
        {!isMatched && !isWaiting && (
          <div className="animate-fade-in-up space-y-6">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {errorMsg}
              </div>
            )}

            {/* 1-CLICK FAST ACTION: JOIN DEFAULT */}
            <div className="bg-gradient-to-br from-indigo-950/60 via-gray-900/80 to-purple-950/60 border border-indigo-500/40 rounded-2xl p-6 shadow-xl shadow-indigo-950/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">⚡</span>
                    <h3 className="text-lg font-bold text-white">Default Fast Queue</h3>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                      Popular
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Group of 6 • Mixed gender • 1m 30s match timer (starts at 3 people)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleJoinQueue(6, 'mixed')}
                  disabled={joining}
                  className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  {joining ? 'Joining…' : (
                    <>
                      <span>⚡</span>
                      <span>Join Default</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* DIVIDER */}
            <div className="relative text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <span className="relative bg-gray-900 px-3 text-xs text-gray-500 font-medium uppercase tracking-wider">
                Or Custom Queue
              </span>
            </div>

            {/* CUSTOM QUEUE SETUP */}
            <div className="bg-gray-800/40 border border-gray-700/70 rounded-2xl p-6 space-y-5">
              {/* Step 1: Group Size */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Group Size
                  </label>
                  <span className="text-[11px] text-gray-500">
                    {selectedSize === 6 ? '⏱ Matches in 1m 30s at 3+' : 'Matches when full'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {GROUP_SIZES.map((size) => {
                    const isLarge = LARGE_SIZES.includes(size);
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`
                          relative p-3.5 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                          ${isSelected
                            ? 'border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/20'
                            : 'border-gray-700 bg-gray-800/60 hover:border-gray-600 hover:bg-gray-800'
                          }
                        `}
                      >
                        {isLarge && (
                          <span className="absolute top-2 right-2 text-[9px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1 py-0.2 rounded-full font-bold">
                            Timer
                          </span>
                        )}
                        <div className="text-xl font-extrabold text-white mb-0.5">{size}</div>
                        <div className="text-[10px] text-gray-400">
                          {isLarge ? '1m 30s timer' : 'Instant match'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Gender Preference */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5">
                  Gender Preference
                </label>

                <div className="grid grid-cols-2 gap-3">
                  {/* Mixed Option */}
                  <button
                    type="button"
                    onClick={() => setGenderFilter('mixed')}
                    className={`
                      relative p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                      ${genderFilter === 'mixed'
                        ? 'border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/20'
                        : 'border-gray-700 bg-gray-800/60 hover:border-gray-600 hover:bg-gray-800'
                      }
                    `}
                  >
                    <div className="text-lg mb-0.5">🌍</div>
                    <div className="font-semibold text-white text-xs">Mixed Group</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">All genders welcome</div>
                  </button>

                  {/* Gender-Only Option (Matches user's profile) */}
                  {userGender && userGender !== 'prefer_not_to_say' && userGenderOption ? (
                    <button
                      type="button"
                      onClick={() => setGenderFilter(userGender as any)}
                      className={`
                        relative p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer
                        ${genderFilter === userGender
                          ? userGender === 'female'
                            ? 'border-pink-500 bg-pink-500/15 shadow-md shadow-pink-500/20'
                            : 'border-blue-500 bg-blue-500/15 shadow-md shadow-blue-500/20'
                          : 'border-gray-700 bg-gray-800/60 hover:border-gray-600 hover:bg-gray-800'
                        }
                      `}
                    >
                      <div className="text-lg mb-0.5">{userGenderOption.icon}</div>
                      <div className="font-semibold text-white text-xs">{userGenderOption.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Only for {userGender}s</div>
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl border border-dashed border-gray-700 bg-gray-800/20 flex flex-col justify-center">
                      <div className="text-[10px] text-gray-500">
                        Gender-specific queues available for registered male or female profiles.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button for Custom Queue */}
              <button
                type="button"
                onClick={() => handleJoinQueue(selectedSize, genderFilter)}
                disabled={joining || !selectedSize}
                className="w-full py-3.5 rounded-xl bg-gray-700 hover:bg-gray-600 active:scale-[0.98] text-white font-bold text-sm border border-gray-600 shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {joining ? 'Joining Custom Queue…' : (
                  <>
                    <span>⚙️</span>
                    <span>
                      Join {genderFilter !== 'mixed' ? (genderFilter === 'male' ? 'Men-Only ' : genderFilter === 'female' ? 'Women-Only ' : '') : ''}Custom Queue ({selectedSize})
                    </span>
                  </>
                )}
              </button>
            </div>
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
          }}
        />
      )}
    </div>
  );
}
