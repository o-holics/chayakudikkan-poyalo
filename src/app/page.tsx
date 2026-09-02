"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle, type DoodleName } from "@/components/Doodle";
import { Logo } from "@/components/Logo";

const STEPS: { icon: DoodleName; text: string }[] = [
  { icon: "moon", text: "Say when you're up for tea. That's it — close the app." },
  { icon: "chair", text: "We gather three to six people nearby and pick the spot, locked in 45 minutes before." },
  { icon: "cup", text: "You get a line from a Malayalam film to find each other by. Sip, and head home." },
];

export default function Landing() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || !user) return;
    if (profileLoading) return;
    router.replace(profile ? "/home" : "/onboarding");
  }, [authLoading, profileLoading, user, profile, router]);

  if (user) {
    return (
      <Screen center>
        <p className="text-sm text-ink-soft">putting the kettle on…</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="pt-2">
        <Logo full size={24} />
      </div>

      <div className="mt-16 flex flex-col items-center text-center">
        <Doodle name="cup" size={104} className="rise-slow text-ink" />
        <Stack gap={4} className="rise rise-delay mt-8 items-center">
          <Title>let&apos;s go for a tea</Title>
          <QuietText className="max-w-[20rem]">
            chayakudikkanpoyalo sits you down with a few people nearby for one cup of chai. You meet, and then you go home.
          </QuietText>
        </Stack>
      </div>

      <div className="mt-14">
        <ol className="space-y-6">
          {STEPS.map((s, i) => (
            <li key={i} className="flex items-start gap-4">
              <Doodle name={s.icon} size={30} className="mt-0.5 shrink-0 text-ink-soft" strokeWidth={4} />
              <p className="text-sm leading-relaxed text-ink">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-12 text-sm text-ink-soft">
        No profiles, no follows, nothing to keep up with. Just the cup.
      </p>

      <BottomAction>
        <Link href="/sign-in" className="block w-full">
          <Button full>begin</Button>
        </Link>
      </BottomAction>
    </Screen>
  );
}
