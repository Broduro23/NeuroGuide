import Link from "next/link";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";

// Temporary sample data for the activity page. Replace this object with the
// activity returned by the API/database when that integration is ready.
const activity = {
  title: "The Five Little Animals",
  developmentalAreas: ["Language", "Numeracy"],
  ageSuitability: "4–5 years",
  isSafe: true,
  progress: 75,
};

export default function Activity() {
  const completedSegments = Math.round(activity.progress / 10);

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar activeItem="Activity" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9c9c9] bg-white px-16">
            <Link
              href="/"
              className="absolute left-4 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#444] no-underline hover:text-black focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-4"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="m12 4-6 6 6 6M6 10h11" />
              </svg>
              Back
            </Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">
              Learning Activity
            </h1>
          </div>

          <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-7 sm:px-8 sm:pt-8">
            <div className="mb-6 flex items-center justify-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-[#bdbdbd] bg-[#dedede] text-[0.55rem] text-[#777]"
              >
                ICON
              </span>
              <h2 className="text-center text-xl font-extrabold uppercase tracking-[0.06em] sm:text-2xl">
                {activity.title}
              </h2>
            </div>

            <section
              aria-label={`${activity.title} video`}
              className="mx-auto max-w-3xl rounded-xl border border-[#c5c5c5] bg-white p-3.5 sm:p-4"
            >
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-[#b5b5b5] bg-[#d8d8d8]">
                <span
                  aria-hidden="true"
                  className="absolute left-[-5%] top-1/2 h-px w-[110%] -rotate-[22deg] bg-[#b0b0b0]"
                />
                <span
                  aria-hidden="true"
                  className="absolute left-[-5%] top-1/2 h-px w-[110%] rotate-[22deg] bg-[#b0b0b0]"
                />
                <span className="relative z-10 bg-[#d8d8d8]/80 px-3 py-1 text-xs tracking-[0.12em] text-[#858585]">
                  [ CONTENT / VIDEO ]
                </span>
              </div>

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-[#333] transition-colors hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                  aria-label="Play or start activity"
                >
                  <span className="flex size-7 items-center justify-center rounded-full border border-[#aaa] bg-[#d2d2d2]">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className="ml-0.5 size-3 fill-[#555]"
                    >
                      <path d="M4 2.5v11L13 8z" />
                    </svg>
                  </span>
                  Play / Start
                </button>
              </div>
            </section>

            <section
              aria-label="Activity details"
              className="mx-auto mt-6 max-w-3xl space-y-2 text-sm text-[#4c4c4c]"
            >
              <p>
                <strong className="font-bold text-[#383838]">
                  Developmental Areas:
                </strong>{" "}
                {activity.developmentalAreas.map((area) => (
                  <span key={area} className="mr-2 inline-flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="flex size-3.5 items-center justify-center rounded-[3px] border border-[#aaa] bg-[#d8d8d8] text-[10px] leading-none text-[#555]"
                    >
                      ✓
                    </span>
                    {area}
                  </span>
                ))}
              </p>
              <p>
                <strong className="font-bold text-[#383838]">Age Suitability:</strong>{" "}
                {activity.ageSuitability}
              </p>
              <p>
                <strong className="font-bold text-[#383838]">Safety Status:</strong>{" "}
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="flex size-3.5 items-center justify-center rounded-[3px] border border-[#aaa] bg-[#d8d8d8] text-[10px] leading-none text-[#555]"
                  >
                    {activity.isSafe ? "✓" : "!"}
                  </span>
                  {activity.isSafe ? "Safe" : "Review required"}
                </span>
              </p>
            </section>

            <section
              aria-labelledby="activity-progress-title"
              className="mx-auto mt-6 max-w-3xl border-t border-[#ccc] pt-5"
            >
              <h3
                id="activity-progress-title"
                className="mb-4 text-center text-xs font-bold uppercase tracking-[0.12em]"
              >
                Activity Progress
              </h3>
              <div className="flex items-center gap-2">
                <div
                  className="flex min-w-0 flex-1 gap-1"
                  role="progressbar"
                  aria-label="Activity progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={activity.progress}
                >
                  {Array.from({ length: 10 }, (_, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`h-3 flex-1 rounded-full border border-[#c1c1c1] ${
                        index < completedSegments ? "bg-[#929292]" : "bg-[#dedede]"
                      }`}
                    />
                  ))}
                </div>
                <span className="shrink-0 text-xs text-[#555]">
                  {activity.progress}%
                </span>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
