"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/components/AuthProvider";
import { Screen, Stack, Title, QuietText, Button, Field, Stepper, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { DEFAULT_SIZE_MAX, DEFAULT_SIZE_MIN, SIZE_MAX, SIZE_MIN } from "@/lib/models";

type Step = "name" | "place" | "size";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState("");
  const [locating, setLocating] = useState(false);
  const [locHint, setLocHint] = useState<string | null>(null);
  const [sizeMin, setSizeMin] = useState(DEFAULT_SIZE_MIN);
  const [sizeMax, setSizeMax] = useState(DEFAULT_SIZE_MAX);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/welcome");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName.split(" ")[0]);
  }, [user, name]);

  const askLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocHint("This device won't share a location — type an area instead.");
      return;
    }
    setLocating(true);
    setLocHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setArea("");
        setLocating(false);
        setLocHint("got it");
      },
      () => {
        setLocating(false);
        setLocHint("Couldn't reach your location — type an area instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const placeReady = coords !== null || area.trim().length >= 2;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const lo = Math.max(SIZE_MIN, Math.min(SIZE_MAX, sizeMin));
    const hi = Math.max(lo, Math.min(SIZE_MAX, sizeMax));
    try {
      await setDoc(doc(db, "profiles", user.uid), {
        uid: user.uid,
        displayName: name.trim() || "friend",
        ...(coords ? { homePoint: coords } : {}),
        ...(area.trim() ? { areaLabel: area.trim() } : {}),
        sizeMin: lo,
        sizeMax: hi,
        createdAt: Date.now(),
      });
      router.replace("/home");
    } catch {
      setError("Couldn't save that. Try once more.");
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <Screen center>
        <p className="text-sm text-ink-soft">a moment…</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="flex items-center gap-1.5 pt-2">
        {(["name", "place", "size"] as Step[]).map((s) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${s === step ? "bg-ink" : "bg-line"}`} />
        ))}
      </div>

      {step === "name" && (
        <div className="mt-10 flex flex-1 flex-col">
          <Doodle name="sparkle" size={56} className="text-ink-soft" />
          <Stack gap={3} className="mt-6">
            <Title>what should we call you?</Title>
            <QuietText>A first name is plenty. It&apos;s all anyone at the table sees.</QuietText>
          </Stack>
          <div className="mt-8">
            <Field
              placeholder="e.g. Meera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              autoFocus
            />
          </div>
          <BottomAction>
            <Button full disabled={name.trim().length < 2} onClick={() => setStep("place")}>
              next
            </Button>
          </BottomAction>
        </div>
      )}

      {step === "place" && (
        <div className="mt-10 flex flex-1 flex-col">
          <Doodle name="pin" size={56} className="text-ink-soft" />
          <Stack gap={3} className="mt-6">
            <Title>where are you, roughly?</Title>
            <QuietText>So we can find tea near you. We only keep a rough point.</QuietText>
          </Stack>

          <div className="mt-8">
            <Stack gap={4}>
              <Button variant="ghost" full onClick={askLocation} disabled={locating}>
                {locating ? "finding you…" : coords ? "location shared ✓" : "use my location"}
              </Button>
              <div className="flex items-center gap-3 text-ink-soft">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <Field
                label="type an area"
                placeholder="e.g. Fort Kochi"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  if (e.target.value) setCoords(null);
                }}
                maxLength={60}
              />
              {locHint && <span className="text-xs text-ink-soft">{locHint}</span>}
            </Stack>
          </div>

          <BottomAction>
            <Stack gap={2}>
              <Button full disabled={!placeReady} onClick={() => setStep("size")}>
                next
              </Button>
              <Button variant="quiet" onClick={() => setStep("name")}>
                back
              </Button>
            </Stack>
          </BottomAction>
        </div>
      )}

      {step === "size" && (
        <div className="mt-10 flex flex-1 flex-col">
          <Doodle name="chair" size={56} className="text-ink-soft" />
          <Stack gap={3} className="mt-6">
            <Title>how many is good company?</Title>
            <QuietText>Tables are small — somewhere between three and six, including you.</QuietText>
          </Stack>

          <div className="mt-10 flex items-start justify-between">
            <Stepper
              label="smallest"
              value={sizeMin}
              min={SIZE_MIN}
              max={sizeMax}
              onChange={setSizeMin}
            />
            <Stepper
              label="biggest"
              value={sizeMax}
              min={sizeMin}
              max={SIZE_MAX}
              onChange={setSizeMax}
            />
          </div>

          {error && <p className="mt-6 text-sm text-ink">{error}</p>}

          <BottomAction>
            <Stack gap={2}>
              <Button full disabled={saving} onClick={save}>
                {saving ? "settling in…" : "settle in"}
              </Button>
              <Button variant="quiet" onClick={() => setStep("place")}>
                back
              </Button>
            </Stack>
          </BottomAction>
        </div>
      )}
    </Screen>
  );
}
