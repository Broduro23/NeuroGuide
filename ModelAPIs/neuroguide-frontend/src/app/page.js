import Link from "next/link";
import Navbar from "../components/navbar";
import Sidebar from "../components/Sidebar";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
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
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Home" />

        <main className="min-w-0 flex-1">
          <div className="flex min-h-12 items-center justify-center border-b border-[#c9c9c9] bg-white px-4">
            <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
              Home
            </h1>
          </div>

          <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-8 sm:pt-9">
            <section className="relative overflow-hidden rounded-xl border border-[#c5c5c5] bg-white p-6 sm:p-9 lg:p-12">
              <div aria-hidden="true" className="absolute -right-16 -top-24 size-72 rounded-full border border-[#e5e5e5] sm:size-96" />
              <div aria-hidden="true" className="absolute -right-6 -top-14 size-52 rounded-full border border-[#e5e5e5] sm:size-72" />

              <div className="relative max-w-2xl">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#777]">
                  A thoughtful start to every learning day
                </p>
                <h2 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  Help your child learn through play.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#666] sm:text-base sm:leading-7">
                  NeuroGuide helps caregivers find safe, age-appropriate learning
                  activities that connect with a child&apos;s interests and
                  developmental goals.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/recommendations"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#333] bg-[#333] px-5 text-sm font-semibold text-white no-underline transition hover:bg-[#4a4a4a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                  >
                    Explore recommendations
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="ml-2 size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 10h13m-5-5 5 5-5 5" />
                    </svg>
                  </Link>
                  <Link
                    href="/profile"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#bdbdbd] bg-white px-5 text-sm font-semibold text-[#383838] no-underline transition hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                  >
                    Set up a child profile
                  </Link>
                </div>
              </div>
            </section>

            <section aria-labelledby="getting-started-title" className="mt-9">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#777]">
                    Your next steps
                  </p>
                  <h2 id="getting-started-title" className="mt-1 text-xl font-bold">
                    Make NeuroGuide your own
                  </h2>
                </div>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-[#555] underline underline-offset-4 hover:text-black"
                >
                  Account settings
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {features.map((feature) => (
                  <article
                    key={feature.number}
                    className="flex min-h-48 flex-col rounded-xl border border-[#c5c5c5] bg-white p-5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border border-[#c5c5c5] bg-[#f0f0f0] text-[10px] font-bold text-[#666]">
                      {feature.number}
                    </span>
                    <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-5 text-[#666]">
                      {feature.description}
                    </p>
                    <Link
                      href={feature.href}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#383838] no-underline hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
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
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#c5c5c5] bg-[#e7e7e7] p-5 text-inherit no-underline transition hover:bg-[#dedede] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#777]">
                    Learning activities
                  </p>
                  <h2 className="mt-1 text-base font-bold">Pick up where you left off</h2>
                  <p className="mt-1 text-xs text-[#666]">
                    Open an activity and explore it together.
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl text-[#666] transition-transform group-hover:translate-x-1">→</span>
              </Link>

              <Link
                href="/profile"
                className="group flex items-center justify-between gap-4 rounded-xl border border-[#c5c5c5] bg-[#e7e7e7] p-5 text-inherit no-underline transition hover:bg-[#dedede] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#777]">
                    Child profile
                  </p>
                  <h2 className="mt-1 text-base font-bold">Update interests and goals</h2>
                  <p className="mt-1 text-xs text-[#666]">
                    Keep activity suggestions relevant as your child grows.
                  </p>
                </div>
                <span aria-hidden="true" className="text-xl text-[#666] transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
