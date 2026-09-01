"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen } from "@/components/ui";
import { Doodle } from "@/components/Doodle";

export default function Entry() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/welcome");
      return;
    }
    if (profileLoading) return;
    router.replace(profile ? "/home" : "/onboarding");
  }, [authLoading, profileLoading, user, profile, router]);

  return (
    <Screen center>
      <div className="rise flex flex-col items-center gap-6">
        <Doodle name="steam" size={60} className="text-ink-soft" />
        <p className="text-sm text-ink-soft">putting the kettle on…</p>
      </div>
    </Screen>
  );
}
