"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Stack, Title, QuietText, Button, Stepper, Divider } from "@/components/ui";
import { AppTopBar } from "@/components/AppTopBar";
import { cycleTheme, getThemeChoice, themeLabel, type ThemeChoice } from "@/lib/theme";
import { SIZE_MAX, SIZE_MIN } from "@/lib/models";

export default function YouPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading } = useProfile();

  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [sizeMin, setSizeMin] = useState(SIZE_MIN);
  const [sizeMax, setSizeMax] = useState(SIZE_MAX);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => setTheme(getThemeChoice()), []);
  useEffect(() => {
    if (profile) {
      setSizeMin(profile.sizeMin ?? SIZE_MIN);
      setSizeMax(profile.sizeMax ?? SIZE_MAX);
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/welcome");
  }, [authLoading, user, router]);

  const dirty = profile ? sizeMin !== profile.sizeMin || sizeMax !== profile.sizeMax : false;

  const saveSize = async () => {
    if (!user) return;
    await updateDoc(doc(db, "profiles", user.uid), { sizeMin, sizeMax });
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1600);
  };

  return (
    <Screen>
      <AppTopBar back="/home" />

      <Stack gap={2} className="mt-8">
        <Title>{profile?.displayName ?? "you"}</Title>
        <QuietText>{user?.email}</QuietText>
      </Stack>

      <div className="mt-10">
        <Stack gap={6}>
          <div>
            <p className="mb-4 text-sm text-ink-soft">table size you&apos;re happy with</p>
            <div className="flex items-start justify-between">
              <Stepper label="smallest" value={sizeMin} min={SIZE_MIN} max={sizeMax} onChange={setSizeMin} />
              <Stepper label="biggest" value={sizeMax} min={sizeMin} max={SIZE_MAX} onChange={setSizeMax} />
            </div>
            {(dirty || savedNote) && (
              <div className="mt-4">
                {savedNote ? (
                  <p className="text-sm text-ink-soft">saved</p>
                ) : (
                  <Button variant="ghost" onClick={saveSize} disabled={loading}>
                    save
                  </Button>
                )}
              </div>
            )}
          </div>

          <Divider />

          <button
            type="button"
            className="flex items-center justify-between text-left"
            onClick={() => setTheme(cycleTheme())}
          >
            <span className="text-sm text-ink">appearance</span>
            <span className="text-sm text-ink-soft">{themeLabel(theme)}</span>
          </button>

          <Divider />

          <button
            type="button"
            className="text-left text-sm text-ink-soft underline decoration-line underline-offset-4"
            onClick={async () => {
              await signOut();
              router.replace("/welcome");
            }}
          >
            sign out
          </button>
        </Stack>
      </div>
    </Screen>
  );
}
