"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { useBlocked, useHistory } from "@/lib/useSocial";
import { unblockUser } from "@/lib/social";
import { Screen, Stack, Title, QuietText, Button, Stepper, Divider } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";
import { LocationEditor } from "@/components/LocationEditor";
import { cycleTheme, getThemeChoice, themeLabel, type ThemeChoice } from "@/lib/theme";
import { SIZE_MAX, SIZE_MIN } from "@/lib/models";

function when(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function YouPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile } = useProfile();
  const history = useHistory();
  const blocked = useBlocked();

  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [sizeMin, setSizeMin] = useState(SIZE_MIN);
  const [sizeMax, setSizeMax] = useState(SIZE_MAX);
  const [saved, setSaved] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getThemeChoice());
  }, []);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSizeMin(profile.sizeMin ?? SIZE_MIN);
    setSizeMax(profile.sizeMax ?? SIZE_MAX);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  const dirty = profile ? sizeMin !== profile.sizeMin || sizeMax !== profile.sizeMax : false;

  const saveSize = async () => {
    if (!user) return;
    await updateDoc(doc(db, "profiles", user.uid), { sizeMin, sizeMax });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <Screen className="pb-16">
      <AppTopBar back="/home" />

      <Stack gap={2} className="mt-8">
        <Title>{profile?.displayName ?? "you"}</Title>
        <QuietText>{user?.email}</QuietText>
      </Stack>

      {user && (
        <div className="mt-6">
          <LocationEditor uid={user.uid} profile={profile} />
        </div>
      )}

      <div className="mt-10">
        <p className="mb-3 text-xs uppercase tracking-wide text-ink-soft">shared cups</p>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-ink-soft">
            <Doodle name="cup" size={56} />
            <p className="text-sm">Once you meet a table, it stays here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">{h.spotName}</span>
                  <span className="text-xs text-ink-soft">{when(h.at)}</span>
                </div>
                <p className="mt-1 font-mal text-sm text-ink-soft">{h.line?.quote}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {(h.members ?? []).map((m) => m.displayName).join(", ")}
                  {h.outcome && h.outcome !== "met" ? ` · ${h.outcome}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Divider />

      <div className="mt-8">
        <p className="mb-4 text-sm text-ink-soft">table size you&apos;re happy with</p>
        <div className="flex items-start justify-between">
          <Stepper label="smallest" value={sizeMin} min={SIZE_MIN} max={sizeMax} onChange={setSizeMin} />
          <Stepper label="biggest" value={sizeMax} min={sizeMin} max={SIZE_MAX} onChange={setSizeMax} />
        </div>
        {(dirty || saved) && (
          <div className="mt-4">
            {saved ? <p className="text-sm text-ink-soft">saved</p> : <Button variant="ghost" onClick={saveSize}>save</Button>}
          </div>
        )}
      </div>

      <Divider />

      <button
        type="button"
        className="mt-8 flex w-full items-center justify-between text-left"
        onClick={() => setTheme(cycleTheme())}
      >
        <span className="text-sm text-ink">appearance</span>
        <span className="text-sm text-ink-soft">{themeLabel(theme)}</span>
      </button>

      {blocked.length > 0 && (
        <>
          <Divider />
          <button
            type="button"
            className="mt-8 flex w-full items-center justify-between text-left"
            onClick={() => setShowBlocked((v) => !v)}
          >
            <span className="text-sm text-ink">blocked</span>
            <span className="text-sm text-ink-soft">{blocked.length}</span>
          </button>
          {showBlocked && (
            <ul className="mt-3 divide-y divide-line">
              {blocked.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-ink">{b.displayName}</span>
                  <button
                    className="text-sm text-ink-soft underline decoration-line underline-offset-4"
                    onClick={() => user && unblockUser(user.uid, b.uid)}
                  >
                    unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Divider />

      <button
        type="button"
        className="mt-8 text-left text-sm text-ink-soft underline decoration-line underline-offset-4"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
      >
        sign out
      </button>
    </Screen>
  );
}
