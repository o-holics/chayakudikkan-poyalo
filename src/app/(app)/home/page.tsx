"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Stack, Title, QuietText } from "@/components/ui";
import { Doodle } from "@/components/Doodle";
import { AppTopBar } from "@/components/AppTopBar";

function greeting() {
  const h = new Date().getHours();
  if (h >= 22 || h < 4) return "late one";
  if (h >= 17) return "evening";
  if (h >= 12) return "afternoon";
  return "morning";
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading } = useProfile();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace("/welcome");
    else if (!loading && !profile) router.replace("/onboarding");
  }, [authLoading, loading, user, profile, router]);

  return (
    <Screen>
      <AppTopBar />
      <Stack gap={3} className="mt-8">
        <Title>
          {greeting()}, {profile?.displayName ?? "friend"}
        </Title>
        <QuietText>Tea shops near you are on the way.</QuietText>
      </Stack>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-ink-soft">
        <Doodle name="kettle" size={84} />
        <p className="text-sm">nearby spots arrive next</p>
      </div>
    </Screen>
  );
}
