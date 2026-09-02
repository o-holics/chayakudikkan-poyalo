"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Stack, Title, QuietText, Button } from "@/components/ui";
import { Doodle, type DoodleName } from "@/components/Doodle";
import { Logo } from "@/components/Logo";

const STEPS: { icon: DoodleName; title: string; text: string }[] = [
  {
    icon: "moon",
    title: "1. Say when you're free",
    text: "Pick a time today or tomorrow for a cup of tea. That's it — close the app and go about your day.",
  },
  {
    icon: "chair",
    title: "2. We gather a small table",
    text: "45 minutes before, we pick a central nearby tea spot and lock in a table of 3 to 6 people.",
  },
  {
    icon: "cup",
    title: "3. Say the line & sip",
    text: "Find your group using a classic Malayalam movie quote sign. Have a cup of chai, chat, and head home.",
  },
];

const FEATURES = [
  {
    title: "Zero Follows or Profiles",
    desc: "No social feeds, follower counts, or endless messaging. You meet for tea and return to real life.",
  },
  {
    title: "Local & Map-Powered",
    desc: "Uses OpenStreetMap to discover local tea shops and cafes right near your neighborhood.",
  },
  {
    title: "Safe & Respectful",
    desc: "Strict group caps (3–6 people), automatic 45-minute lock deadline, and one-tap blocking & reporting.",
  },
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
    <Screen wide>
      {/* Top Header */}
      <header className="flex items-center justify-between py-2">
        <Logo full size={24} />
        <Link href="/sign-in">
          <Button variant="ghost" className="!px-4 !py-2 text-sm">
            sign in
          </Button>
        </Link>
      </header>

      {/* Main Grid: Responsive 2-column on desktop */}
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
        {/* Left Hero Column */}
        <div className="flex flex-col lg:col-span-6">
          <div className="flex items-center gap-3 text-ink-soft">
            <Doodle name="cup" size={48} className="rise-slow text-ink" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">simple tea meetups</span>
          </div>

          <Stack gap={4} className="mt-6">
            <Title className="text-3xl lg:text-4xl lg:leading-tight">
              let&apos;s go for a tea.
            </Title>
            <QuietText className="text-base leading-relaxed">
              chayakudikkanpoyalo gathers a few people nearby over a hot cup of chai.
              You sit down, enjoy the conversation, and then you head home.
            </QuietText>
          </Stack>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button full className="sm:px-8">
                Get Started
              </Button>
            </Link>
            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="ghost" full className="sm:px-6">
                How it works
              </Button>
            </a>
          </div>

          {/* Quick Stat Banner */}
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-paper-raised/50 p-4">
            <Doodle name="kettle" size={28} className="shrink-0 text-ink" />
            <p className="text-xs leading-normal text-ink-soft">
              <strong className="font-semibold text-ink">Malayalam Dialogue Signs:</strong> Find your table at the cafe using iconic movie lines like <em className="not-italic text-ink font-mal">&quot;Ethra manoharamaya nadakku!&quot;</em>
            </p>
          </div>
        </div>

        {/* Right Preview Card / Steps Column */}
        <div className="lg:col-span-6" id="how-it-works">
          <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-sm sm:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">how it works</h2>
            
            <ol className="mt-6 space-y-6">
              {STEPS.map((s, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-paper text-ink">
                    <Doodle name={s.icon} size={22} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 rounded-xl border border-line/60 bg-paper p-4 text-center">
              <p className="text-xs text-ink-soft">
                No endless swiping or long chats. Just one cup of tea.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid Section */}
      <section className="mt-16 border-t border-line pt-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft text-center">why chayakudikkanpoyalo?</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="rounded-2xl border border-line bg-paper-raised p-6">
              <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="mt-14 border-t border-line pt-8 pb-4 text-center">
        <p className="text-sm text-ink font-medium">Ready for a cup of tea near you?</p>
        <div className="mt-4 flex justify-center">
          <Link href="/sign-in">
            <Button className="px-8">join a table</Button>
          </Link>
        </div>
        <p className="mt-8 text-xs text-ink-soft/70">
          chayakudikkanpoyalo · calm software for real-life moments
        </p>
      </footer>
    </Screen>
  );
}
