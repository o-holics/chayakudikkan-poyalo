"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/lib/useProfile";
import { Screen, Title, QuietText, Button } from "@/components/ui";
import { Doodle, type DoodleName } from "@/components/Doodle";
import { Logo } from "@/components/Logo";

const STEPS = [
  {
    num: "01",
    icon: "moon" as DoodleName,
    title: "Declare your time",
    desc: "Pick a time today or tomorrow for a cup of tea. That's it — close the app and go about your day.",
  },
  {
    num: "02",
    icon: "chair" as DoodleName,
    title: "Automatic Matchmaker",
    desc: "45 minutes before your time, we pick a central nearby tea spot and lock in a small table of 3 to 6 people.",
  },
  {
    num: "03",
    icon: "cup" as DoodleName,
    title: "Say the line & sip",
    desc: "Find your group using an iconic Malayalam movie quote sign. Have a cup of chai, chat, and head home.",
  },
];

const CARDS = [
  {
    tag: "THE ENGINE",
    title: "Fire & Forget Matchmaker",
    desc: "Say when you're free and put your phone away. The matcher pairs nearby tea lovers and locks the table 45 mins before.",
    highlight: "No endless back-and-forth planning.",
  },
  {
    tag: "THE SIGN",
    title: "Malayalam Movie Lines",
    desc: "Every table gets assigned a cult classic Malayalam movie quote like \"Ethra manoharamaya nadakku!\". Say the line at the cafe to find your group.",
    highlight: "Fun, low-pressure table identification.",
  },
  {
    tag: "THE PHILOSOPHY",
    title: "Zero Feeds or Follows",
    desc: "No public profiles, followers, or notification loops. You meet for a 20-minute tea break and return to real life.",
    highlight: "Calm software for real moments.",
  },
];

const FAQS = [
  {
    q: "Do I need to create a public profile?",
    a: "No. You only choose a display name and your preferred table size. There are no social profiles, follower counts, or public accounts.",
  },
  {
    q: "How do I find my table at the cafe?",
    a: "Every table gets assigned an iconic Malayalam movie quote sign (e.g. 'Ethra manoharamaya nadakku!'). When you arrive at the spot, just say the line to identify your table.",
  },
  {
    q: "What if no one is nearby at my chosen time?",
    a: "The matchmaker automatically widens the search radius as the travel deadline approaches, or offers an opt-in pair match so you're never stranded.",
  },
  {
    q: "Is chayakudikkanpoyalo free?",
    a: "Yes! 100% free and open-source. You only pay for your own cup of tea at the local shop.",
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
      {/* ── 1. Top App Header ────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-line/60 pb-4">
        <Logo full size={24} />
        
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-ink">
            How it works
          </a>
          <a href="#products" className="transition-colors hover:text-ink">
            Product
          </a>
          <a href="#faq" className="transition-colors hover:text-ink">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="!px-4 !py-2 text-sm">
              sign in
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button className="!px-5 !py-2 text-sm">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* ── 2. Hero Section (In Malayalam Script + App Theme) ─────────── */}
      <section className="mt-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
          <Doodle name="cup" size={16} className="text-ink" />
          Real-Life Tea Meetups
        </div>

        {/* Malayalam Script Headline */}
        <h1 className="mt-6 font-mal text-4xl sm:text-6xl lg:text-7xl leading-tight text-ink font-normal">
          ഒരു ചായ കുടിക്കാൻ പോയാലോ?
        </h1>
        <p className="mt-2 text-sm italic text-ink-soft font-mono">
         oru chaya kudikkan poyalo?
        </p>

        <QuietText className="mt-6 max-w-2xl text-base sm:text-xl leading-relaxed">
          A calm way to meet 3–6 nearby people over a hot cup of chai. <br className="hidden sm:inline" />
          Say when you&apos;re free, close the app, and meet at a local tea spot.
        </QuietText>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/sign-in" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto !px-8 !py-4 text-base">
              I&apos;m up for tea
            </Button>
          </Link>
          <a href="#how-it-works" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full sm:w-auto !px-6 !py-4 text-base">
              Explore how it works ↓
            </Button>
          </a>
        </div>
      </section>

      {/* ── Ticker / Feature Strip ────────────────────────────────────── */}
      <div className="mt-14 w-full rounded-2xl border border-line bg-paper-raised/60 py-4 text-xs font-mono tracking-widest text-ink-soft uppercase overflow-hidden">
        <div className="flex justify-around items-center gap-6 whitespace-nowrap opacity-90 max-w-7xl mx-auto px-6">
          <span>☕ 100% Free & Open-Source</span>
          <span>•</span>
          <span>📍 OpenStreetMap Powered</span>
          <span>•</span>
          <span>🎬 Malayalam Movie Signs</span>
          <span>•</span>
          <span>🔒 Zero Follows or Feeds</span>
          <span>•</span>
          <span>⏰ 45-Min Travel Lock</span>
        </div>
      </div>

      {/* ── 3. Product Cards Section (Matching App Paper Theme) ───────── */}
      <section className="mt-20 border-t border-line/80 pt-16" id="products">
        <div className="max-w-3xl">
          <span className="text-xs font-mono uppercase tracking-widest text-ink-soft">
            DESIGNED FOR CALM CONNECTION
          </span>
          <Title className="mt-3 text-3xl sm:text-4xl">
            Step away from screens. Enjoy real chai.
          </Title>
          <QuietText className="mt-3 text-base leading-relaxed">
            No feeds keeping you addicted. No unread messages cluttering your inbox.
            Just a small group of nearby people gathered at a local tea shop.
          </QuietText>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {CARDS.map((card, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-3xl border border-line bg-paper-raised p-8 shadow-sm transition-transform hover:-translate-y-1 duration-300 min-h-[24rem]"
            >
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-ink-soft">
                  {card.tag}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-ink">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft font-light">
                  {card.desc}
                </p>
              </div>

              <div className="mt-8 border-t border-line/60 pt-4">
                <p className="text-xs font-mono text-ink-soft">Key Highlight</p>
                <p className="mt-1 text-sm font-medium text-ink">{card.highlight}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. How It Works Step-by-Step ────────────────────────────────── */}
      <section id="how-it-works" className="mt-24 border-t border-line/80 pt-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-ink-soft">
            STEP BY STEP
          </span>
          <Title className="mt-3 text-3xl sm:text-4xl">
            How a table comes together
          </Title>
          <QuietText className="mt-3 text-sm sm:text-base">
            Three simple steps to join a tea table in your neighborhood.
          </QuietText>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, idx) => (
            <div
              key={idx}
              className="relative rounded-3xl border border-line bg-paper-raised p-8 flex flex-col justify-between shadow-sm"
            >
              <div>
                <span className="text-4xl font-bold text-ink-soft/30">{s.num}</span>
                <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-paper text-ink">
                  <Doodle name={s.icon} size={26} strokeWidth={3} />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed font-light">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. Malayalam Line Spotlight Banner ─────────────────────────── */}
      <section className="mt-20 rounded-3xl border border-line bg-paper-raised p-8 sm:p-12 text-center shadow-sm">
        <Doodle name="sparkle" size={44} className="mx-auto text-ink" />
        <h2 className="mt-4 font-mal text-3xl sm:text-5xl leading-snug text-ink">
          &quot;Ethra manoharamaya nadakku!&quot;
        </h2>
        <p className="mt-4 text-sm sm:text-base text-ink-soft max-w-xl mx-auto font-light leading-relaxed">
          Finding your table at the cafe is part of the fun. Every match comes with a Malayalam cult classic dialogue sign. Say the line, sit down, and enjoy chai.
        </p>
        <div className="mt-8">
          <Link href="/sign-in">
            <Button className="px-8">Get Started Free</Button>
          </Link>
        </div>
      </section>

      {/* ── 6. FAQ Section ─────────────────────────────────────────────── */}
      <section id="faq" className="mt-24 border-t border-line/80 pt-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <span className="text-xs font-mono uppercase tracking-widest text-ink-soft">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <Title className="mt-3 text-3xl sm:text-4xl">
              Got questions? We have answers.
            </Title>
          </div>

          <div className="mt-12 space-y-4">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-line bg-paper-raised p-6 transition-colors hover:border-ink/30"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left font-semibold text-ink text-lg"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span>{faq.q}</span>
                  <span className="text-ink-soft font-mono text-xl">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <p className="mt-4 text-sm text-ink-soft leading-relaxed border-t border-line/50 pt-4 font-light">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. App Theme Footer ────────────────────────────────────────── */}
      <footer className="mt-24 border-t border-line/80 pt-12 pb-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <Logo full size={24} />
            <p className="mt-2 text-xs text-ink-soft font-mono">
              calm software for real-life moments
            </p>
          </div>

          <div className="text-center text-xs font-mono text-ink-soft">
            © 2026 chayakudikkanpoyalo · All rights reserved.
          </div>

          <div>
            <Link href="/sign-in">
              <Button className="!px-6 !py-2.5 text-sm">Join a Table</Button>
            </Link>
          </div>
        </div>
      </footer>
    </Screen>
  );
}
