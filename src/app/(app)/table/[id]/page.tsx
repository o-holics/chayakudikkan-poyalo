"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { useTable } from "@/lib/useActiveTable";
import { useTableChat, usePresence, setArrived } from "@/lib/useTableExtras";
import { cachedSpot } from "@/lib/useNearby";
import { apiFetch } from "@/lib/api";
import { Screen, Stack, Title, QuietText, Button, Divider } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";
import { PersonSheet } from "@/components/PersonSheet";
import type { TableMember } from "@/lib/models";

function mapHref(spotId: string, spotName: string): string {
  const c = cachedSpot(spotId);
  return c?.geoUrl || c?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spotName)}`;
}

export default function TablePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { table, loading } = useTable(id);

  const me = user && profile ? { uid: user.uid, name: profile.displayName } : null;
  const { messages, send } = useTableChat(id, me);
  const presence = usePresence(id);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "met" | "leave">(null);
  const [confirmMet, setConfirmMet] = useState(false);
  const [person, setPerson] = useState<TableMember | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ticked = useRef(false);

  const iAmHere = me ? Boolean(presence[me.uid]) : false;
  const isMember = table && user ? table.memberUids.includes(user.uid) : true;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length]);

  // Nudge past the meet window.
  useEffect(() => {
    if (!table || table.status !== "active") return;
    const iv = setInterval(async () => {
      if (ticked.current || Date.now() < table.meetBy) return;
      ticked.current = true;
      try {
        await apiFetch("/api/table/tick", { method: "POST", body: { tableId: id } });
      } catch {
        /* ignore */
      } finally {
        ticked.current = false;
      }
    }, 8000);
    return () => clearInterval(iv);
  }, [table, id]);

  const closing = useMemo(() => {
    if (!table) return null;
    if (table.status === "met") return { doodle: "sparkle" as const, text: "that was a good cup. see you around." };
    if (table.status === "expired") return { doodle: "moon" as const, text: "the table didn't quite come together this time." };
    if (table.status === "cancelled") return { doodle: "moon" as const, text: "this table wound down." };
    return null;
  }, [table]);

  if (!loading && (!table || !isMember)) {
    return (
      <Screen center>
        <div className="flex flex-col items-center gap-4 text-center text-ink-soft">
          <Doodle name="cup" size={64} />
          <QuietText>This table has ended.</QuietText>
          <Link href="/home" className="text-sm text-ink underline decoration-line underline-offset-4">
            back home
          </Link>
        </div>
      </Screen>
    );
  }

  if (loading || !table) {
    return (
      <Screen center>
        <p className="text-sm text-ink-soft">finding your table…</p>
      </Screen>
    );
  }

  if (closing) {
    return (
      <Screen center>
        <div className="rise flex flex-col items-center gap-5 text-center">
          <Doodle name={closing.doodle} size={72} className="text-ink-soft" />
          <QuietText>{closing.text}</QuietText>
          <Link href="/home" className="text-sm text-ink underline decoration-line underline-offset-4">
            back home
          </Link>
        </div>
      </Screen>
    );
  }

  const leave = async () => {
    setBusy("leave");
    try {
      await apiFetch("/api/table/leave", { method: "POST", body: { tableId: id } });
    } catch {
      /* ignore */
    }
    router.replace("/home");
  };

  const markMet = async () => {
    setBusy("met");
    try {
      await apiFetch("/api/table/met", { method: "POST", body: { tableId: id } });
    } catch {
      /* ignore */
    }
    setBusy(null);
    setConfirmMet(false);
  };

  return (
    <Screen className="pb-6">
      <AppTopBar back="/home" />

      <div className="mt-6 rounded-2xl border border-line bg-paper-raised p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-ink-soft">say this to find each other</p>
        <p className="mt-3 font-mal text-2xl leading-snug text-ink">{table.line.quote}</p>
        <p className="mt-2 text-sm text-ink-soft">
          {table.line.translit} — {table.line.film}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-soft">
          📍 {table.spotName}
          {table.meetAt
            ? ` · around ${new Date(table.meetAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </span>
        <a
          href={mapHref(table.spotId, table.spotName)}
          target="_blank"
          rel="noreferrer"
          className="text-ink underline decoration-line underline-offset-4"
        >
          open in maps
        </a>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {table.members.map((m) => {
          const here = Boolean(presence[m.uid]);
          const self = m.uid === user?.uid;
          return (
            <button
              key={m.uid}
              type="button"
              disabled={self}
              onClick={() => setPerson(m)}
              className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm disabled:opacity-100"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${here ? "bg-ink" : "bg-line"}`} />
              <span className="text-ink">{self ? "you" : m.displayName}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant={iAmHere ? "primary" : "ghost"} onClick={() => me && setArrived(id, me, !iAmHere)}>
          {iAmHere ? "you're here ✓" : "i'm here"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirmMet(true)}>
          we met
        </Button>
      </div>

      {confirmMet && (
        <div className="mt-3 rounded-xl border border-line p-4 text-center">
          <QuietText>Close the table — everyone found each other?</QuietText>
          <div className="mt-3 flex justify-center gap-3">
            <Button onClick={markMet} disabled={busy === "met"}>
              {busy === "met" ? "…" : "yes, we met"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmMet(false)}>
              not yet
            </Button>
          </div>
        </div>
      )}

      <Divider />

      <div ref={scroller} className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">quiet so far — say hello</p>
        ) : (
          messages.map((m) => {
            const self = m.senderUid === user?.uid;
            return (
              <div key={m.id} className={self ? "text-right" : "text-left"}>
                {!self && <p className="text-xs text-ink-soft">{m.senderName}</p>}
                <p className="text-sm text-ink">{m.text}</p>
              </div>
            );
          })
        )}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            send(draft);
            setDraft("");
          }
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="say something"
          maxLength={500}
          className="w-full rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-ink px-4 py-3 text-sm text-paper disabled:opacity-40" disabled={!draft.trim()}>
          send
        </button>
      </form>

      <div className="mt-4 text-center">
        <Button variant="quiet" onClick={leave} disabled={busy === "leave"}>
          {busy === "leave" ? "leaving…" : "leave the table"}
        </Button>
      </div>

      {person && (
        <PersonSheet
          person={person}
          onClose={() => setPerson(null)}
        />
      )}
    </Screen>
  );
}
