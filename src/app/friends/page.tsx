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

export default function FriendsPage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'requests'>('all');

  const { data, mutate, isLoading } = useSWR(user ? '/api/friends' : null, fetcher, {
    refreshInterval: 5000,
  });

  const friends = data?.friends || [];
  const requests = data?.requests || [];

  const handleRespond = async (targetUid: string, action: 'accept' | 'decline') => {
    setRespondingId(targetUid);
    try {
      await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid, action }),
      });
      await mutate();
    } catch (e) {
      console.error(e);
    } finally {
      setRespondingId(null);
    }
  };

  const handleUnfriend = async (targetUid: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid }),
      });
      await mutate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 pb-20">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm mb-3 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Friends & Community</h1>
            <p className="text-gray-400 text-sm mt-1">Connect with people you met during tea meetups</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Mobile Tab Switcher */}
        <div className="flex sm:hidden border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'all' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400'}`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'requests' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400'}`}
          >
            <span>Requests</span>
            {requests.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {requests.length}
              </span>
            )}
          </button>
        </div>

        {/* Two-column layout for desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

          {/* ── COLUMN 1: FRIENDS LIST ── */}
          <div className={`${activeTab !== 'all' ? 'hidden sm:block' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <span>👥 Total Friends</span>
                <span className="bg-gray-800 text-gray-300 text-xs px-2.5 py-0.5 rounded-full border border-gray-700">
                  {friends.length}
                </span>
              </h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading friends…</div>
            ) : friends.length === 0 ? (
              <div className="p-8 rounded-2xl bg-gray-800/40 border border-gray-800 text-center">
                <div className="text-3xl mb-2">☕</div>
                <h3 className="font-semibold text-gray-300 text-sm">No friends yet</h3>
                <p className="text-gray-500 text-xs mt-1">Join meetup queues and add people you enjoy chatting with!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend: any) => (
                  <div
                    key={friend.uid}
                    className="p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 flex items-center justify-between transition-all"
                  >
                    <div
                      onClick={() => setSelectedUser({ ...friend, isFriend: true })}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${GENDER_COLORS[friend.gender] ?? 'from-indigo-500 to-purple-600'} flex items-center justify-center font-bold text-white shadow-md`}>
                        {friend.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm hover:text-indigo-400 transition-colors">
                          {friend.username}
                        </div>
                        <div className="text-[11px] text-gray-500 capitalize">
                          {friend.gender ? friend.gender.replace(/_/g, ' ') : 'Tea Lover'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUser({ ...friend, isFriend: true })}
                        className="px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
                      >
                        Options
                      </button>
                      <button
                        onClick={() => handleUnfriend(friend.uid)}
                        title="Remove Friend"
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── COLUMN 2: FRIEND REQUESTS ── */}
          <div className={`${activeTab !== 'requests' ? 'hidden sm:block' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <span>📬 Friend Requests</span>
                {requests.length > 0 && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {requests.length} new
                  </span>
                )}
              </h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading requests…</div>
            ) : requests.length === 0 ? (
              <div className="p-8 rounded-2xl bg-gray-800/40 border border-gray-800 text-center">
                <div className="text-3xl mb-2">✨</div>
                <h3 className="font-semibold text-gray-300 text-sm">No pending requests</h3>
                <p className="text-gray-500 text-xs mt-1">When someone sends you a friend request, it will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req: any) => (
                  <div
                    key={req.uid}
                    className="p-4 rounded-xl bg-gray-800/80 border border-indigo-500/30 flex items-center justify-between transition-all"
                  >
                    <div
                      onClick={() => setSelectedUser(req)}
                      className="flex items-center gap-3 cursor-pointer flex-1"
                    >
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${GENDER_COLORS[req.gender] ?? 'from-indigo-500 to-purple-600'} flex items-center justify-center font-bold text-white shadow-md`}>
                        {req.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm hover:text-indigo-400 transition-colors">
                          {req.username}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Wants to be friends
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRespond(req.uid, 'accept')}
                        disabled={respondingId === req.uid}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
                      >
                        {respondingId === req.uid ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleRespond(req.uid, 'decline')}
                        disabled={respondingId === req.uid}
                        className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* User Action Modal */}
      {selectedUser && (
        <UserActionModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          targetUser={selectedUser}
          onActionComplete={() => {
            setSelectedUser(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}
