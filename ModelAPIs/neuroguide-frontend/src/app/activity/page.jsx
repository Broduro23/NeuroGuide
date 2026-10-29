"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function formatAgeRange(minimum, maximum) {
  const format = (months) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} ${years === 1 ? "year" : "years"}`;
    if (years === 0) return `${months} months`;
    return `${years}y ${remainingMonths}m`;
  };
  return `${format(minimum)}–${format(maximum)}`;
}

function ActivityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyId = searchParams.get("historyId");
  const contentId = searchParams.get("contentId");
  const [contents, setContents] = useState([]);
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/activity");
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setError("");
    setContent(null);
    setIsComplete(false);

    async function loadActivity() {
      try {
        if (!contentId) {
          const availableContent = await apiFetch("content/");
          if (active) {
            setContents(availableContent.filter((item) => item.safety_label === "safe"));
          }
          return;
        }

        const activityContent = await apiFetch(
          `content/${encodeURIComponent(contentId)}/`,
        );
        if (!active) return;
        if (activityContent.safety_label !== "safe") {
          setError("This activity is unavailable because it has not passed safety review.");
          return;
        }
        setContent(activityContent);

        if (historyId) {
          const history = await apiFetch("recommend/history/");
          const currentHistory = history.find((item) => String(item.id) === historyId);
          setIsComplete(
            Boolean(
              currentHistory?.activities.some(
                (item) =>
                  String(item.content_id) === contentId &&
                  item.event_type === "completed",
              ),
            ),
          );

          try {
            await apiFetch(`recommend/history/${encodeURIComponent(historyId)}/activity/`, {
              method: "POST",
              body: JSON.stringify({
                content_id: Number(contentId),
                event_type: "viewed",
                details: { source: "frontend_activity_page" },
              }),
            });
          } catch (eventError) {
            if (active) setError(eventError.message);
          }
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadActivity();
    return () => {
      active = false;
    };
  }, [contentId, historyId, router]);

  async function markComplete() {
    setError("");
    setIsCompleting(true);
    try {
      await apiFetch(`recommend/history/${encodeURIComponent(historyId)}/activity/`, {
        method: "POST",
        body: JSON.stringify({
          content_id: Number(contentId),
          event_type: "completed",
          details: { source: "frontend_activity_page" },
        }),
      });
      setIsComplete(true);
    } catch (completeError) {
      setError(completeError.message);
    } finally {
      setIsCompleting(false);
    }
  }

  const hasSelection = Boolean(contentId);

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Activity" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9dadd] bg-white px-16">
            <Link href={hasSelection ? "/activity" : "/recommendations"} className="absolute left-4 text-xs font-medium uppercase tracking-wide text-[#36535b] no-underline hover:text-black">
              ‹ &nbsp; {hasSelection ? "All Activities" : "Back"}
            </Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">
              {hasSelection ? "Learning Activity" : "All Activities"}
            </h1>
          </div>

          {isLoading ? (
            <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-[#c9dadd] bg-white p-6 text-center text-sm text-[#536c73]">
              {hasSelection ? "Loading activity…" : "Loading activities…"}
            </p>
          ) : !hasSelection ? (
            <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-7 sm:px-8">
              {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">{error}</p> : null}
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#647d83]">Learning activity catalog</p>
                  <h2 className="mt-1 text-xl font-bold">Available content</h2>
                </div>
                <span className="text-xs text-[#647d83]">{contents.length} {contents.length === 1 ? "item" : "items"}</span>
              </div>
              {contents.length === 0 ? (
                <div className="rounded-xl border border-[#c9dadd] bg-white p-8 text-center">
                  <p className="text-sm text-[#445f67]">There is no content in the library yet.</p>
                  <Link href="/content-management" className="mt-4 inline-flex rounded-md border border-[#176b5b] bg-[#176b5b] px-4 py-2 text-xs font-semibold text-white no-underline hover:bg-[#115648]">Manage content</Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {contents.map((item) => (
                    <article key={item.id} className="flex flex-col rounded-xl border border-[#c9dadd] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-sm border border-[#c9dadd] bg-[#edf4f5] px-2 py-1 text-[10px] uppercase tracking-wide text-[#536c73]">{item.content_type || "Activity"}</span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${item.recommendation_eligible ? "border-[#a7d8c3] bg-[#e7f5ee] text-[#176b4d]" : "border-[#c9dadd] bg-[#edf4f5] text-[#536c73]"}`}>
                          {item.recommendation_eligible ? "Ready" : item.assessment_status || "Pending"}
                        </span>
                      </div>
                      <h2 className="mt-4 text-base font-bold">{item.title}</h2>
                      {item.content_type === "video" && item.media_file_url ? (
                        <video className="mt-3 w-full rounded-lg bg-black" src={item.media_file_url} controls preload="metadata" />
                      ) : item.content_type === "audio" && item.media_file_url ? (
                        <audio className="mt-3 w-full" src={item.media_file_url} controls preload="metadata" />
                      ) : (
                        <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-[#536c73]">{item.text}</p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#d9e9e8] pt-3 text-xs text-[#647d83]">
                        <span>Ages {formatAgeRange(item.age_min, item.age_max)}</span>
                        {item.content_type === "text" ? <span className="capitalize">Safety: {item.safety_label}</span> : null}
                      </div>
                      <Link href={`/activity?contentId=${encodeURIComponent(item.id)}`} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md border border-[#b6ccd1] bg-[#edf4f5] px-4 text-xs font-semibold text-[#176b5b] no-underline hover:bg-[#e7f0f2]">
                        Open activity
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : content ? (
            <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-7 sm:px-8 sm:pt-8">
              <div className="mb-6 flex items-center justify-center gap-3">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-[#b6ccd1] bg-[#dbe9eb] text-[0.55rem] text-[#647d83]">
                  {content.content_type || "ACTIVITY"}
                </span>
                <h2 className="text-center text-xl font-extrabold uppercase tracking-[0.06em] sm:text-2xl">
                  {content.title}
                </h2>
              </div>

              <section aria-label="Activity instructions" className="mx-auto max-w-3xl rounded-xl border border-[#c9dadd] bg-white p-5 sm:p-7">
                {content.content_type === "video" && content.media_file_url ? (
                  <video className="w-full rounded-lg bg-black" src={content.media_file_url} controls preload="metadata" />
                ) : content.content_type === "audio" && content.media_file_url ? (
                  <audio className="w-full" src={content.media_file_url} controls preload="metadata" />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#36535b]">{content.text}</p>
                )}
                <div className="mt-6 grid gap-2 border-t border-[#dbe9eb] pt-4 text-sm text-[#445f67] sm:grid-cols-2">
                  <p><strong className="text-[#304b54]">Age suitability:</strong> {formatAgeRange(content.age_min, content.age_max)}</p>
                  {content.content_type === "text" ? <>
                    <p><strong className="text-[#304b54]">Safety:</strong> {content.safety_label === "safe" ? "Assessed safe" : content.safety_label}</p>
                    <p className="sm:col-span-2">
                      <strong className="text-[#304b54]">Developmental areas:</strong>{" "}
                      {Object.entries(content.developmental_scores || {})
                        .filter(([, score]) => Number(score) >= 0.5)
                        .map(([goal]) => goal.replaceAll("_", " "))
                        .join(", ") || "No matching domains listed"}
                    </p>
                  </> : null}
                </div>
              </section>

              {historyId ? <section aria-labelledby="activity-progress-title" className="mx-auto mt-6 max-w-3xl border-t border-[#c9dadd] pt-5">
                <h3 id="activity-progress-title" className="mb-4 text-center text-xs font-bold uppercase tracking-[0.12em]">
                  Activity Progress
                </h3>
                <div className="flex items-center gap-2">
                  <div role="progressbar" aria-label="Activity progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={isComplete ? 100 : 0} className="h-3 flex-1 overflow-hidden rounded-full border border-[#b6ccd1] bg-[#dbe9eb]">
                    <div className={`h-full rounded-full bg-[#647d83] transition-[width] ${isComplete ? "w-full" : "w-0"}`} />
                  </div>
                  <span className="shrink-0 text-xs text-[#445f67]">{isComplete ? "100%" : "0%"}</span>
                </div>
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={markComplete}
                    disabled={isComplete || isCompleting}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#94aab0] bg-[#c9dadd] px-8 text-xs font-bold uppercase tracking-[0.12em] text-[#176b5b] transition hover:bg-[#c9dadd] disabled:cursor-default disabled:opacity-70"
                  >
                    {isComplete ? "Activity Completed" : isCompleting ? "Saving…" : "Mark Activity Complete"}
                  </button>
                </div>
                {error ? <p role="alert" className="mt-3 text-center text-xs text-red-700">{error}</p> : null}
              </section> : <p className="mx-auto mt-5 max-w-3xl text-center text-xs text-[#647d83]">Open this activity from a recommendation to record its completion in progress history.</p>}
            </div>
          ) : (
            <div role="alert" className="mx-auto mt-10 max-w-xl rounded-xl border border-[#c9dadd] bg-white p-8 text-center">
              <p className="text-sm text-[#445f67]">{error || "Activity could not be loaded."}</p>
              <button type="button" onClick={() => router.push("/activity")} className="mt-5 rounded-md border border-[#b6ccd1] bg-white px-4 py-2 text-sm hover:bg-[#eef5f5]">
                Return to activities
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Activity() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f3f8f9] text-sm text-[#536c73]">
          Loading activity…
        </div>
      }
    >
      <ActivityContent />
    </Suspense>
  );
}
