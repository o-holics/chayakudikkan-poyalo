"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { Screen, Stack, Title, QuietText, Button, Field, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => router.replace("/");

  const withGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      done();
    } catch (e) {
      setError(niceError(e));
      setBusy(false);
    }
  };

  const withEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      done();
    } catch (err) {
      setError(niceError(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div className="flex flex-col items-center pt-4">
        <Doodle name="moon" size={68} className="text-ink-soft" />
      </div>

      <Stack gap={3} className="mt-8">
        <Title>{mode === "in" ? "welcome back" : "come in"}</Title>
        <QuietText>No profiles, no photos. Just a name and a cup.</QuietText>
      </Stack>

      <form onSubmit={withEmail} className="mt-8">
        <Stack gap={4}>
          <Field
            label="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Field
            label="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
          {error && <p className="text-sm text-ink">{error}</p>}
          <Button full type="submit" disabled={busy}>
            {busy ? "a moment…" : mode === "in" ? "sign in" : "create account"}
          </Button>
        </Stack>
      </form>

      <div className="mt-5 flex items-center gap-3 text-ink-soft">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <Button variant="ghost" full onClick={withGoogle} disabled={busy} className="mt-5">
        continue with Google
      </Button>

      <BottomAction>
        <button
          type="button"
          className="w-full text-center text-sm text-ink-soft underline decoration-line underline-offset-4"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
        >
          {mode === "in" ? "new here? create an account" : "already have one? sign in"}
        </button>
      </BottomAction>
    </Screen>
  );
}

function niceError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-cred") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "That email and password don't match.";
  if (code.includes("email-already")) return "That email already has an account — try signing in.";
  if (code.includes("weak-password")) return "Pick a slightly longer password.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "The Google window closed before finishing.";
  if (code.includes("network")) return "Looks like the connection dropped.";
  return "Something went sideways. Try again in a moment.";
}
