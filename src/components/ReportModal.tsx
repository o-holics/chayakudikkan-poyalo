'use client';

import { useState } from 'react';

export const REPORT_REASONS = [
  { id: 'Faking Gender', label: 'Faking Gender', desc: 'Profile gender does not match their real identity' },
  { id: 'Having unaccounted extra people with user', label: 'Having unaccounted extra people with user', desc: 'Brought unexpected or unauthorized individuals' },
  { id: 'Foul Language', label: 'Foul Language', desc: 'Used abusive, offensive, or inappropriate language' },
  { id: 'Unsafe vibes from this user', label: 'Unsafe vibes from this user', desc: 'Made you or the group feel threatened or uncomfortable' },
] as const;

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { uid: string; username: string };
  initialAlsoBlock?: boolean;
  onSuccess?: () => void;
}

export default function ReportModal({
  isOpen,
  onClose,
  targetUser,
  initialAlsoBlock = false,
  onSuccess,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [alsoBlock, setAlsoBlock] = useState(initialAlsoBlock);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setError('Please select a reason for reporting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/safety/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUid: targetUser.uid,
          targetUsername: targetUser.username,
          reason: selectedReason,
          alsoBlock,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">🛡️</div>
            <h3 className="text-xl font-bold text-white mb-1">Report Submitted</h3>
            <p className="text-gray-400 text-sm">
              Thank you for keeping our community safe. {alsoBlock ? 'User has also been blocked.' : ''}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Report User</h3>
                <p className="text-xs text-gray-400">Reporting <span className="text-indigo-300 font-semibold">{targetUser.username}</span></p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4">Please select the reason that best describes the issue:</p>

            <div className="space-y-2.5 mb-5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150
                    ${selectedReason === r.id
                      ? 'border-red-500 bg-red-500/10 text-white'
                      : 'border-gray-800 bg-gray-800/40 hover:border-gray-700 text-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.id}
                    checked={selectedReason === r.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-1 accent-red-500"
                  />
                  <div>
                    <div className="font-semibold text-sm">{r.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Also block toggle */}
            <div className="bg-gray-800/60 border border-gray-800 rounded-xl p-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Block this user as well?</div>
                <div className="text-xs text-gray-400">Prevent future queueing or messages from them</div>
              </div>
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={(e) => setAlsoBlock(e.target.checked)}
                className="w-5 h-5 accent-red-500 rounded cursor-pointer"
              />
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedReason}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition-all"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
