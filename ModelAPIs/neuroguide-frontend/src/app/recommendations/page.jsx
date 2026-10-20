import Link from "next/link";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";

// Temporary recommendation data. Replace with API results when available.
const recommendations = [
  {
    title: "The Five Little Animals",
    areas: "Language + Numeracy",
    age: "4–5 years",
    safe: true,
    score: 94,
    badge: "Highly Recommended",
  },
];

const moreRecommendations = [
  { title: "Animal Story Time", area: "Language", score: 91, label: "Story" },
  { title: "Count the Numbers", area: "Numeracy", score: 88, label: "Numbers" },
  { title: "Creative Drawing", area: "Motor", score: 82, label: "Drawing" },
];

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Activity", href: "/activity" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

function MediaPlaceholder({ label, className = "" }) {
  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-[#b5b5b5] bg-[#d8d8d8] text-[10px] tracking-wide text-[#858585] ${className}`}
    >
      <span aria-hidden="true" className="absolute left-[-5%] top-1/2 h-px w-[110%] -rotate-[16deg] bg-[#b0b0b0]" />
      <span aria-hidden="true" className="absolute left-[-5%] top-1/2 h-px w-[110%] rotate-[16deg] bg-[#b0b0b0]" />
      <span className="relative z-10 bg-[#d8d8d8]/80 px-2">{label}</span>
    </div>
  );
}

export default function Recommendations() {
  const featured = recommendations[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Recommendations" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9c9c9] bg-white px-16">
            <Link
              href="/"
              className="absolute left-4 inline-flex items-center gap-1.5 rounded-sm border border-[#bdbdbd] bg-[#e4e4e4] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#333] no-underline hover:bg-[#d8d8d8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
            >
              ‹ &nbsp; Back
            </Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">
              Recommendations
            </h1>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-8">
            <section aria-label="Recommendation context" className="mb-5 text-sm text-[#555]">
              <p>
                <span className="font-semibold">Recommended for:</span>{" "}
                <span className="rounded-sm border border-[#c5c5c5] bg-white px-2 py-1">
                  Child Name
                </span>
                <span className="mx-2 text-[#999]">|</span>
                Age 4
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-semibold">Based on:</span>
                {["Developmental Stage", "Interests", "Learning History"].map((basis) => (
                  <span key={basis} className="inline-flex items-center gap-1">
                    <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-[3px] border border-[#aaa] bg-[#d8d8d8] text-[10px] leading-none text-[#555]">✓</span>
                    {basis}
                  </span>
                ))}
              </p>
            </section>

            <article className="rounded-xl border border-[#c5c5c5] bg-white p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)_4.5rem] sm:items-start">
                <MediaPlaceholder label="IMG" className="w-full sm:w-24" />

                <div>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[#bdbdbd] bg-[#e6e6e6] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#555]">
                    <span aria-hidden="true">★</span> {featured.badge}
                  </span>
                  <h2 className="mt-2 text-lg font-bold">&quot;{featured.title}&quot;</h2>
                  <p className="mt-2 text-sm text-[#555]">
                    Development: <strong className="text-[#383838]">{featured.areas}</strong>
                  </p>
                  <p className="mt-1 text-sm text-[#555]">Age suitability: {featured.age}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#555]">
                    Safety:
                    <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-[3px] border border-[#aaa] bg-[#d8d8d8] text-[10px] leading-none text-[#555]">{featured.safe ? "✓" : "!"}</span>
                    {featured.safe ? "Safe" : "Review required"}
                  </p>
                </div>

                <div className="flex size-[4.5rem] flex-col items-center justify-center self-start rounded-full border border-[#c5c5c5] bg-[#e9e9e9] text-center">
                  <span className="text-lg font-bold leading-none">{featured.score}%</span>
                  <span className="mt-1 text-[9px] uppercase text-[#777]">Score</span>
                </div>
              </div>

              <div className="mt-5 border-t border-[#ddd] pt-4">
                <div className="mb-2 flex justify-between text-[10px] uppercase tracking-wide text-[#888]">
                  <span>Match Strength</span>
                  <span>{featured.score}%</span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full border border-[#c3c3c3] bg-[#dedede]"
                  role="progressbar"
                  aria-label="Recommendation match strength"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={featured.score}
                >
                  <div className="h-full rounded-full bg-[#929292]" style={{ width: `${featured.score}%` }} />
                </div>
                <div className="mt-4 flex justify-center">
                  <Link
                    href="/activity"
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#aaa] bg-[#d2d2d2] px-8 text-xs font-bold uppercase tracking-[0.12em] text-[#333] no-underline transition hover:bg-[#c5c5c5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                  >
                    [ Start Activity ]
                  </Link>
                </div>
              </div>
            </article>

            <section aria-labelledby="more-recommendations-title" className="mt-6">
              <h2 id="more-recommendations-title" className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">
                More Recommendations
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {moreRecommendations.map((item) => (
                  <article key={item.title} className="rounded-xl border border-[#c5c5c5] bg-white p-3.5">
                    <MediaPlaceholder label={`[ ${item.label} ]`} />
                    <div className="py-3 text-center text-sm text-[#666]">
                      <p>{item.area}</p>
                      <p className="mt-1 text-xs">Score: {item.score}%</p>
                    </div>
                    <div className="mb-3 h-2 overflow-hidden rounded-full border border-[#c3c3c3] bg-[#dedede]">
                      <div className="h-full rounded-full bg-[#aaa]" style={{ width: `${item.score}%` }} />
                    </div>
                    <div className="flex justify-center">
                      <Link
                        href="/activity"
                        aria-label={`View ${item.title}`}
                        className="rounded-md border border-[#bdbdbd] bg-white px-7 py-1.5 text-xs text-[#444] no-underline hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                      >
                        [View]
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
