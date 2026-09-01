"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { blockUser, reportUser, unblockUser } from "@/lib/social";
import { REPORT_REASONS } from "@/lib/models";
import { Button, Stack } from "@/components/ui";

type Person = { uid: string; displayName: string };

export function PersonSheet({
  person,
  onClose,
  isBlocked,
  onChange,
}: {
  person: Person;
  onClose: () => void;
  isBlocked?: boolean;
  onChange?: () => void;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<"main" | "report">("main");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const me = user?.uid;

  const wrap = (fn: () => Promise<unknown>, msg: string) => async () => {
    if (!me) return;
    setBusy(true);
    try {
      await fn();
      setDone(msg);
      onChange?.();
      setTimeout(onClose, 1200);
    } catch {
      setDone("That didn't go through.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[26rem] rounded-2xl border border-line bg-paper p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-lg text-ink">{person.displayName}</p>
          <button onClick={onClose} className="text-sm text-ink-soft">
            close
          </button>
        </div>

        {done ? (
          <p className="mt-6 text-sm text-ink-soft">{done}</p>
        ) : view === "report" ? (
          <Stack gap={2} className="mt-5">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-3 text-sm text-ink">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-ink"
                />
                {r}
              </label>
            ))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="anything else (optional)"
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
            />
            <div className="mt-2 flex gap-3">
              <Button
                disabled={!reason || busy}
                onClick={wrap(() => reportUser(me!, person, reason, note), "Thanks — we'll look into it.")}
              >
                send report
              </Button>
              <Button variant="quiet" onClick={() => setView("main")}>
                back
              </Button>
            </div>
          </Stack>
        ) : (
          <Stack gap={3} className="mt-5">
            {isBlocked ? (
              <Button variant="ghost" full disabled={busy} onClick={wrap(() => unblockUser(me!, person.uid), "Unblocked.")}>
                unblock
              </Button>
            ) : (
              <>
                <Button variant="ghost" full onClick={() => setView("report")}>
                  report
                </Button>
                <Button
                  variant="ghost"
                  full
                  disabled={busy}
                  onClick={wrap(() => blockUser(me!, person), `Blocked ${person.displayName}.`)}
                >
                  block
                </Button>
              </>
            )}
          </Stack>
        )}
      </div>
    </div>
  );
}
