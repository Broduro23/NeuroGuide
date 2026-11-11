"use client";

import RoleGate from "../../components/RoleGate";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";
import { apiFetch, hasAccessToken } from "../../lib/api";

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

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function activityHref(historyId, contentId) {
  const params = new URLSearchParams({
    historyId: String(historyId),
    contentId: String(contentId),
  });
  return `/activity?${params.toString()}`;
}

function ProgressContent() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/progress");
      return () => {
        active = false;
      };
    }

    apiFetch("recommend/history/")
      .then((records) => {
        if (active) setHistory(records);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const totals = useMemo(() => {
    const events = history.flatMap((session) => session.activities || []);
    return {
      sessions: history.length,
      completed: events.filter((event) => event.event_type === "completed").length,
      viewed: events.filter((event) => event.event_type === "viewed").length,
    };
  }, [history]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Progress" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9dadd] bg-white px-16">
            <Link href="/" className="absolute left-4 text-xs font-medium uppercase tracking-wide text-[#36535b] no-underline hover:text-black">
              ‹ &nbsp; Back
            </Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">
              Learning Progress
            </h1>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-7 sm:px-8">
            {isLoading ? (
              <p className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center text-sm text-[#536c73]">
                Loading progress…
              </p>
            ) : error ? (
              <p role="alert" className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center text-sm text-red-700">
                {error}
              </p>
            ) : (
              <>
                <section aria-label="Progress summary" className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: totals.sessions, label: "Recommendation Sessions" },
                    { value: totals.viewed, label: "Activities Viewed" },
                    { value: totals.completed, label: "Activities Completed" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-[#c9dadd] bg-white p-4 text-center">
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="mt-1 text-xs text-[#647d83]">{stat.label}</p>
                    </div>
                  ))}
                </section>

                <section aria-labelledby="history-title" className="mt-7">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#647d83]">
                        Recorded from your recommendations
                      </p>
                      <h2 id="history-title" className="mt-1 text-xl font-bold">
                        Activity history
                      </h2>
                    </div>
                    <Link href="/recommendations" className="rounded-md border border-[#176b5b] bg-[#176b5b] px-4 py-2 text-xs font-semibold text-white no-underline hover:bg-[#115648]">
                      Find activities
                    </Link>
                  </div>

                  {history.length === 0 ? (
                    <div className="rounded-xl border border-[#c9dadd] bg-white p-8 text-center">
                      <p className="text-sm text-[#445f67]">No activity history yet.</p>
                      <p className="mt-2 text-xs text-[#647d83]">Request recommendations and open an activity to start building a history.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((session) => {
                        const events = session.activities || [];
                        const completedIds = new Set(
                          events
                            .filter((event) => event.event_type === "completed")
                            .map((event) => String(event.content_id)),
                        );

                        return (
                          <article key={session.id} className="rounded-xl border border-[#c9dadd] bg-white p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#d9e9e8] pb-3">
                              <div>
                                <h3 className="font-bold">{session.child.display_name}</h3>
                                <p className="mt-1 text-xs text-[#647d83]">
                                  Age {session.age_months} months · {session.learning_goals.join(", ")}
                                </p>
                              </div>
                              <time className="text-xs text-[#647d83]" dateTime={session.created_at}>
                                {formatDate(session.created_at)}
                              </time>
                            </div>

                            {session.recommendations.length > 0 ? (
                              <ul className="mt-3 divide-y divide-[#edf4f5]">
                                {session.recommendations.map((item) => {
                                  const completed = completedIds.has(String(item.id));
                                  return (
                                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                      <div>
                                        <p className="text-sm font-semibold">{item.title}</p>
                                        <p className="mt-1 text-xs text-[#647d83]">
                                          Match {Math.round(item.relevance_score * 100)}% · {item.matched_goals.join(", ")}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className={`text-xs font-semibold ${completed ? "text-[#176b4d]" : "text-[#647d83]"}`}>
                                          {completed ? "Completed" : "Not completed"}
                                        </span>
                                        <Link href={activityHref(session.id, item.id)} className="rounded-md border border-[#b6ccd1] px-3 py-1.5 text-xs text-[#36535b] no-underline hover:bg-[#eef5f5]">
                                          Open
                                        </Link>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="mt-3 text-xs text-[#647d83]">No matching activities were returned for this session.</p>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Progress() {
  return <RoleGate><ProgressContent /></RoleGate>;
}
