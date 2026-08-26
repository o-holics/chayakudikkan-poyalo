'use client';

import { useState } from 'react';
import ReportModal from './ReportModal';

interface UserActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    uid: string;
    username: string;
    gender?: string;
    isBlocked?: boolean;
    isFriend?: boolean;
  } | null;
  onActionComplete?: () => void;
}

export default function UserActionModal({
  isOpen,
  onClose,
  targetUser,
  onActionComplete,
}: UserActionModalProps) {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportWithBlock, setReportWithBlock] = useState(false);
  const [showBlockPrompt, setShowBlockPrompt] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen || !targetUser) return null;

  const handleAddFriend = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetUser.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send friend request');

      setFeedback({ type: 'success', message: data.message || 'Friend request sent!' });
      setTimeout(() => {
        onClose();
        if (onActionComplete) onActionComplete();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectBlock = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/safety/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetUser.uid, targetUsername: targetUser.username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to block user');

      setFeedback({ type: 'success', message: `${targetUser.username} has been blocked.` });
      setShowBlockPrompt(false);
      setTimeout(() => {
        onClose();
        if (onActionComplete) onActionComplete();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/safety/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUid: targetUser.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unblock user');

      setFeedback({ type: 'success', message: `${targetUser.username} unblocked.` });
      setTimeout(() => {
        onClose();
        if (onActionComplete) onActionComplete();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>

          {/* User Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg mb-3">
              {targetUser.username.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-xl font-bold text-white">{targetUser.username}</h3>
            {targetUser.gender && (
              <span className="text-xs text-gray-400 capitalize mt-0.5">
                {targetUser.gender.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {feedback && (
            <div className={`mb-4 p-3 rounded-xl text-xs text-center border ${feedback.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
              {feedback.message}
            </div>
          )}

          {/* Block Confirmation Prompt: "Report as well or no?" */}
          {showBlockPrompt ? (
            <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 text-center animate-fade-in">
              <div className="text-2xl mb-2">🚫</div>
              <h4 className="font-bold text-white text-sm mb-1">Block {targetUser.username}?</h4>
              <p className="text-xs text-gray-400 mb-4">Would you like to report this user as well?</p>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowBlockPrompt(false);
                    setReportWithBlock(true);
                    setShowReportModal(true);
                  }}
                  className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
                >
                  Yes, Report & Block
                </button>
                <button
                  onClick={handleDirectBlock}
                  disabled={actionLoading}
                  className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors"
                >
                  {actionLoading ? 'Blocking…' : 'No, Just Block'}
                </button>
                <button
                  onClick={() => setShowBlockPrompt(false)}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Action Buttons */
            <div className="space-y-2.5">
              {targetUser.isBlocked ? (
                <>
                  <button
                    onClick={handleUnblock}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <span>🔓</span>
                    <span>{actionLoading ? 'Unblocking…' : 'Unblock User'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setReportWithBlock(false);
                      setShowReportModal(true);
                    }}
                    className="w-full py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <span>⚠️</span>
                    <span>Report User</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Add Friend */}
                  {!targetUser.isFriend ? (
                    <button
                      onClick={handleAddFriend}
                      disabled={actionLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <span>👋</span>
                      <span>{actionLoading ? 'Sending Request…' : 'Add Friend'}</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                      <span>✓</span>
                      <span>Friends</span>
                    </div>
                  )}

                  {/* Report User */}
                  <button
                    onClick={() => {
                      setReportWithBlock(false);
                      setShowReportModal(true);
                    }}
                    className="w-full py-3 rounded-xl border border-gray-700 hover:border-gray-600 bg-gray-800/60 hover:bg-gray-800 text-gray-200 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <span>⚠️</span>
                    <span>Report User</span>
                  </button>

                  {/* Block User */}
                  <button
                    onClick={() => setShowBlockPrompt(true)}
                    className="w-full py-3 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <span>🚫</span>
                    <span>Block User</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            onClose();
          }}
          targetUser={targetUser}
          initialAlsoBlock={reportWithBlock}
          onSuccess={() => {
            if (onActionComplete) onActionComplete();
          }}
        />
      )}
    </>
  );
}
