'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import UserActionModal from '@/components/UserActionModal';

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

export default function ProfilePage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<'history' | 'blocked'>('history');

  const { data: profile } = useSWR(user ? '/api/user/profile' : null, fetcher);
  const { data: history = [], isLoading: historyLoading } = useSWR(
    user ? '/api/user/history' : null,
    fetcher
  );
  const { data: blockedUsers = [], mutate: mutateBlocked, isLoading: blockedLoading } = useSWR(
    user ? '/api/safety/block' : null,
    fetcher
  );

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
            <p className="text-gray-400 text-xs mb-4">{profile?.email || user?.email}</p>

            <div className="flex gap-3 justify-center sm:justify-start">
              <Link
                href="/friends"
                className="px-4 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-xs font-semibold transition-colors"
              >
                👥 View Friends
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveSection('history')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${activeSection === 'history' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            ☕ Successful Meetups ({history.length})
          </button>
          <button
            onClick={() => setActiveSection('blocked')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors ${activeSection === 'blocked' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
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
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : 'Completed';

                  return (
                    <div
                      key={item.groupId || item.id}
                      className="bg-gray-800/50 border border-gray-800 hover:border-gray-700 rounded-2xl p-6 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-gray-800/60">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📍</span>
                            <h3 className="font-bold text-white text-base">{item.spotName || 'Tea Meetup'}</h3>
                            <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                              Group of {item.groupSize || item.members?.length || 2}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
                        </div>

                        {item.secretWord && (
                          <div className="bg-indigo-950/60 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-center w-fit">
                            <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">Secret Word</div>
                            <div className="text-sm font-extrabold text-indigo-200">{item.secretWord}</div>
                          </div>
                        )}
                      </div>

                      {/* Participant list */}
                      <div>
                        <div className="text-xs font-semibold text-gray-400 mb-3">
                          Meetup Members (click to interact):
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {(item.members || []).map((m: any, idx: number) => {
                            const isSelf = m.uid === user?.uid;
                            return (
                              <button
                                key={idx}
                                disabled={isSelf}
                                onClick={() => setSelectedUser(m)}
                                className={`
                                  flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all
                                  ${isSelf
                                    ? 'bg-gray-800/40 border-gray-700 text-gray-400 cursor-default'
                                    : 'bg-gray-800/80 border-gray-700 hover:border-indigo-500/50 hover:bg-gray-700 text-white cursor-pointer shadow-xs'
                                  }
                                `}
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

        {/* ── SECTION 2: BLOCKED USERS ── */}
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
                      className="px-3.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold transition-colors"
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
    </div>
  );
}
