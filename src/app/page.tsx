"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Stack, Title, QuietText, Button } from "@/components/ui";
import { Doodle, type DoodleName } from "@/components/Doodle";
import { Logo } from "@/components/Logo";

const STEPS: { icon: DoodleName; number: string; title: string; text: string }[] = [
  {
    icon: "moon",
    number: "01",
    title: "Declare your time",
    text: "Pick a time today or tomorrow for a cup of tea. That's it — close the app and go about your day.",
  },
  {
    icon: "chair",
    number: "02",
    title: "Automatic Matchmaker",
    text: "45 minutes before, we pick a central nearby tea spot and lock in a small table of 3 to 6 people.",
  },
  {
    icon: "cup",
    number: "03",
    title: "Say the line & sip",
    text: "Find your group using a classic Malayalam movie quote sign. Have a cup of chai, chat, and head home.",
  },
];

const FEATURES = [
  {
    icon: "sparkle" as DoodleName,
    title: "Zero Follows or Profiles",
    desc: "No social feeds, follower counts, or endless messaging. You meet for tea and return to real life.",
  },
  {
    icon: "kettle" as DoodleName,
    title: "Local & Map-Powered",
    desc: "Uses OpenStreetMap to discover authentic local tea shops and cafes right near your neighborhood.",
  },
  {
    icon: "chair" as DoodleName,
    title: "45-Min Travel Guarantee",
    desc: "Tables lock 45 minutes in advance so everyone has plenty of time to travel comfortably.",
  },
  {
    icon: "moon" as DoodleName,
    title: "Safe & Respectful",
    desc: "Strict group caps (3–6 people), optional pairs mode, and one-tap blocking & reporting built-in.",
  },
];

const FAQS = [
  {
    q: "Do I need to create a public profile?",
    a: "No. You only choose a display name and your preferred table size. There are no social profiles, photos, or public accounts.",
  },
  {
    q: "How do I find my table at the cafe?",
    a: "Every table gets assigned an iconic Malayalam movie quote sign (e.g. 'Ethra manoharamaya nadakku!'). When you arrive, just say the line to find your group.",
  },
  {
    q: "What if no one is nearby at my chosen time?",
    a: "The matchmaker automatically widens the search radius as the travel deadline approaches, or offers an opt-in pair match so you're never stranded.",
  },
  {
    q: "Is chayakudikkanpoyalo free?",
    a: "Yes! 100% free and open-source. You only pay for your own cup of tea at the cafe.",
  },
];

export default function Landing() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      {/* Product Navigation Header */}
      <header className="flex items-center justify-between border-b border-line/60 pb-4">
        <Logo full size={24} />
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#features" className="transition-colors hover:text-ink">
            Features
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="!px-4 !py-2.5 text-sm">
              sign in
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button className="!px-5 !py-2.5 text-sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
        {/* Left Hero Content */}
        <div className="lg:col-span-6 flex flex-col items-start">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink">
            <span className="h-2 w-2 rounded-full bg-ink animate-pulse" />
            Real-Life Tea Meetups
          </div>

          <Title className="mt-6 text-4xl sm:text-5xl lg:text-5xl lg:leading-tight">
            Stop scrolling. <br />
            Start sipping.
          </Title>

          <QuietText className="mt-5 text-base sm:text-lg leading-relaxed text-ink-soft">
            chayakudikkanpoyalo gathers a small table of 3–6 nearby people over a hot cup of chai.
            Say when you&apos;re free, close the app, and meet at a local cafe. No endless DMs, no social media feeds — just chai and conversation.
          </QuietText>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/sign-in" className="w-full sm:w-auto">
              <Button full className="sm:px-8 text-base">
                Join a Table Now
              </Button>
            </Link>
            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="ghost" full className="sm:px-6 text-base">
                Explore How It Works →
              </Button>
            </a>
          </div>

          {/* Trust Highlights */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-line/60 pt-6 w-full">
            <div>
              <p className="text-xl font-bold text-ink">3 to 6</p>
              <p className="text-xs text-ink-soft">Cozy small table limit</p>
            </div>
            <div>
              <p className="text-xl font-bold text-ink">45 mins</p>
              <p className="text-xs text-ink-soft">Locked travel deadline</p>
            </div>
          </div>
        </div>

        {/* Right Live Table Preview Mockup Card */}
        <div className="lg:col-span-6">
          <div className="relative rounded-3xl border border-line bg-paper-raised p-6 sm:p-8 shadow-md">
            <div className="flex items-center justify-between border-b border-line/60 pb-4">
              <div className="flex items-center gap-2">
                <Doodle name="cup" size={24} className="text-ink" />
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Live Table Card Preview</span>
              </div>
              <span className="rounded-full bg-ink text-paper px-2.5 py-0.5 text-xs font-medium">Locked & Ready</span>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider text-ink-soft font-medium">table sign · say the line</p>
              <p className="mt-2 font-mal text-2xl sm:text-3xl leading-snug text-ink">&quot;Ethra manoharamaya nadakku!&quot;</p>
              <p className="mt-1 text-xs text-ink-soft">Manichitrathazhu (1993)</p>

              <div className="mt-6 rounded-2xl border border-line/80 bg-paper p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">📍 Eva&apos;s Coffee · Kowdiar</p>
                    <p className="text-xs text-ink-soft">Today · around 4:30 PM</p>
                  </div>
                  <span className="text-xs font-medium text-ink underline decoration-line underline-offset-4">Open Maps</span>
                </div>
              </div>

              {/* Members Avatars */}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {["Adithya", "Kiran", "Meera", "Rahul"].map((name, i) => (
                    <div key={i} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-xs font-semibold text-ink">
                      {name[0]}
                    </div>
                  ))}
                  <span className="ml-1 text-xs text-ink-soft">4 at the table</span>
                </div>
                <span className="text-xs font-medium text-ink">Table #304</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="mt-24 border-t border-line/80 pt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Step by step</span>
          <Title className="mt-3 text-3xl sm:text-4xl">How chayakudikkanpoyalo works</Title>
          <QuietText className="mt-3">
            Designed for calm, real-world connection. No feeds, no notifications overload.
          </QuietText>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={i} className="relative flex flex-col rounded-3xl border border-line bg-paper-raised p-8 shadow-sm">
              <span className="text-3xl font-black text-ink-soft/40">{s.number}</span>
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-paper text-ink">
                <Doodle name={s.icon} size={26} strokeWidth={3} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="mt-24 border-t border-line/80 pt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Calm Software Philosophy</span>
          <Title className="mt-3 text-3xl sm:text-4xl">Built for real human connection</Title>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-line bg-paper-raised p-6">
              <Doodle name={f.icon} size={32} className="text-ink" />
              <h3 className="mt-4 text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Malayalam Dialogue Spotlight Banner */}
      <section className="mt-20 rounded-3xl border border-line bg-paper-raised p-8 sm:p-12 text-center shadow-sm">
        <Doodle name="sparkle" size={40} className="mx-auto text-ink" />
        <h2 className="mt-4 font-mal text-3xl sm:text-4xl leading-tight text-ink">&quot;Namukku chaya kudikkan poyalo?&quot;</h2>
        <p className="mt-3 text-sm text-ink-soft max-w-lg mx-auto">
          Finding your group at a crowded cafe should be fun. Every table gets an iconic Malayalam movie dialogue as its sign.
        </p>
        <div className="mt-6">
          <Link href="/sign-in">
            <Button className="px-8">Get Started Free</Button>
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="mt-24 border-t border-line/80 pt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Got Questions?</span>
          <Title className="mt-3 text-3xl sm:text-4xl">Frequently Asked Questions</Title>
        </div>

        <div className="mt-10 max-w-3xl mx-auto space-y-4">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="rounded-2xl border border-line bg-paper-raised p-6">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left font-semibold text-ink text-base"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{faq.q}</span>
                <span className="text-ink-soft text-xl">{openFaq === idx ? "−" : "+"}</span>
              </button>
              {(openFaq === idx || true) && (
                <p className="mt-3 text-sm leading-relaxed text-ink-soft border-t border-line/40 pt-3">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA & Links */}
      <footer className="mt-24 border-t border-line/80 pt-12 pb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo full size={24} />
          </div>

          <p className="text-xs text-ink-soft">
            chayakudikkanpoyalo · calm software for real-life moments
          </p>

          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button className="!px-6 !py-2.5 text-sm">Join a Table</Button>
            </Link>
          </div>
        </div>
      </footer>
    </Screen>
  );
}
