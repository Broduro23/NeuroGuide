"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/navbar";
import Sidebar from "../components/Sidebar";
import { apiFetch, hasAccessToken } from "../lib/api";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Content Library", href: "/content-management" },
  { label: "Media Testing", href: "/media-testing" },
  { label: "Activity", href: "/activity" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

const features = [
  {
    number: "01",
    title: "Start with your child",
    description:
      "Add their age, interests, and learning goals to shape more relevant activity suggestions.",
    href: "/profile",
    linkLabel: "Set up a profile",
  },
  {
    number: "02",
    title: "Find a good next activity",
    description:
      "Explore age-appropriate activities matched to developmental areas and interests.",
    href: "/recommendations",
    linkLabel: "Explore recommendations",
  },
  {
    number: "03",
    title: "Keep learning visible",
    description:
      "Follow activity progress and see the areas your child is practicing over time.",
    href: "/activity",
    linkLabel: "View activities",
  },
  {
    number: "04",
    title: "Check audio and video",
    description:
      "Run transcript safety and sampled-frame checks before adding media to the library.",
    href: "/media-testing",
    linkLabel: "Open media testing",
  },
];

export default function Home() {
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      Promise.resolve().then(() => {
        if (active) setAuthenticated(false);
      });
      return () => { active = false; };
    }

    apiFetch("profile/")
      .then(() => { if (active) setAuthenticated(true); })
      .catch(() => { if (active) setAuthenticated(false); });

    return () => { active = false; };
  }, []);

  if (authenticated !== true) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          {authenticated === null ? (
            <p role="status" className="text-sm text-[#536c73]">Checking your session…</p>
          ) : (
            <section className="w-full max-w-3xl rounded-2xl border border-[#c9dadd] bg-white px-6 py-10 text-center shadow-sm sm:px-12 sm:py-14">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#647d83]">NeuroGuide</p>
              <h1 className="mx-auto mt-4 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
                Learning through play starts here.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#536c73] sm:text-base">
                Sign in to find activities and recommendations, or create an account as a caregiver or content provider.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#176b5b] bg-[#176b5b] px-6 text-sm font-semibold text-white no-underline transition hover:bg-[#115648]">
                  Log in
                </Link>
                <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#b6ccd1] bg-white px-6 text-sm font-semibold text-[#304b54] no-underline transition hover:bg-[#eef5f5]">
                  Register
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Home" />

        <main className="min-w-0 flex-1">
          <div className="flex min-h-12 items-center justify-center border-b border-[#c9dadd] bg-white px-4">
            <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
              Home
            </h1>
          </div>

          <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-8 sm:pt-9">
            <section className="relative overflow-hidden rounded-xl border border-[#c9dadd] bg-white p-6 sm:p-9 lg:p-12">
              <div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border border-[#e7f0f2] sm:size-96" />
              <div aria-hidden="true" className="absolute -right-6 -top-14 size-52 rounded-full border border-[#e7f0f2] sm:size-72" />

              <div className="relative max-w-2xl">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#647d83]">
                  A thoughtful start to every learning day
                </p>
                <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  Help your child learn through play.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#536c73] sm:text-base sm:leading-7">
                  NeuroGuide helps caregivers find safe, age-appropriate learning
                  activities that connect with a child&apos;s interests and
                  developmental goals.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/recommendations"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#176b5b] bg-[#176b5b] px-5 text-sm font-semibold text-white no-underline transition hover:bg-[#115648] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
                  >
                    Explore recommendations
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="ml-2 size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 10h13m-5-5 5 5-5 5" />
                    </svg>
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#b6ccd1] bg-white px-5 text-sm font-semibold text-[#304b54] no-underline transition hover:bg-[#eef5f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
                  >
                    Set up a child profile
                  </Link>
                </div>
              </div>
            </section>

            <section aria-labelledby="getting-started-title" className="mt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#647d83]">
                    Your next steps
                  </p>
                  <h2 id="getting-started-title" className="mt-1 text-xl font-bold">
                    Make NeuroGuide your own
                  </h2>
                </div>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-[#445f67] underline underline-offset-4 hover:text-black"
                >
                  Account settings
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {features.map((feature) => (
                  <article
                    key={feature.number}
                    className="flex min-h-48 flex-col rounded-xl border border-[#c9dadd] bg-white p-5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border border-[#c9dadd] bg-[#f3f8f9] text-[10px] font-bold text-[#536c73]">
                      {feature.number}
                    </span>
                    <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-5 text-[#536c73]">
                      {feature.description}
                    </p>
                    <Link
                      href={feature.href}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#304b54] no-underline hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
                    >
                      {feature.linkLabel}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/activity"
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#c9dadd] bg-[#e7f0f2] p-5 text-inherit no-underline transition hover:bg-[#dbe9eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#647d83]">
                    Learning activities
                  </p>
                  <h2 className="mt-1 text-base font-bold">Pick up where you left off</h2>
                  <p className="mt-1 text-xs text-[#536c73]">
                    Open an activity and explore it together.
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl text-[#536c73] transition-transform group-hover:translate-x-1">→</span>
              </Link>

              <Link
                href="/profile"
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#c9dadd] bg-[#e7f0f2] p-5 text-inherit no-underline transition hover:bg-[#dbe9eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#647d83]">
                    Child profile
                  </p>
                  <h2 className="mt-1 text-base font-bold">Update interests and goals</h2>
                  <p className="mt-1 text-xs text-[#536c73]">
                    Keep activity suggestions relevant as your child grows.
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl text-[#536c73] transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
