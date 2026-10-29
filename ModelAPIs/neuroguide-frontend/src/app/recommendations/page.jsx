"use client";

import { useEffect, useState } from "react";
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

const goalLabels = {
  number_identification: "Number identification",
  number_size_discrimination: "Number size",
  letter_alphabet_knowledge: "Letters and alphabet",
  phonological_awareness: "Sound awareness",
  expressive_language: "Expressive language",
  receptive_language: "Listening and comprehension",
  fine_motor: "Fine motor",
  mental_flexibility: "Flexible thinking",
  working_memory: "Working memory",
  inhibition: "Self-control",
  approaches_to_learning_play: "Learning through play",
  social_competence: "Social competence",
  relationship_skills: "Relationship skills",
  interpersonal_conflict_resolution: "Conflict resolution",
  prosocial_behaviour: "Prosocial behavior",
  social_cognition: "Social understanding",
  theory_of_mind: "Perspective taking",
  empathy: "Empathy",
  emotion_knowledge: "Emotion knowledge",
  self_regulation: "Self-regulation",
};

function readableGoal(goal) {
  return goalLabels[goal] || goal.replaceAll("_", " ");
}

function isGeneralMedia(item) {
  return item?.general_media || ["audio", "video"].includes(item?.content_type);
}

function formatAge(months) {
  const years = months / 12;
  return Number.isInteger(years) ? `${years} years` : `${years.toFixed(1)} years`;
}

function MediaPlaceholder({ label, className = "" }) {
  return (
    <div className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-[#94aab0] bg-[#dbe9eb] text-[10px] tracking-wide text-[#647d83] ${className}`}>
      <span aria-hidden="true" className="absolute left-[-5%] top-1/2 h-px w-[110%] -rotate-[16deg] bg-[#94aab0]" />
      <span aria-hidden="true" className="absolute left-[-5%] top-1/2 h-px w-[110%] rotate-[16deg] bg-[#94aab0]" />
      <span className="relative z-10 bg-[#dbe9eb]/80 px-2">{label}</span>
    </div>
  );
}

export default function Recommendations() {
  const router = useRouter();
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecommendations(childId, forceRefresh = false) {
    if (!childId) return;
    setIsLoading(true);
    setError("");

    try {
      const child = children.find((item) => String(item.id) === String(childId));
      if (!child?.learning_goals?.length) {
        setResult(null);
        setError("Add at least one learning goal to this child profile first.");
        return;
      }

      if (!forceRefresh) {
        const history = await apiFetch(
          `recommend/history/?child_id=${encodeURIComponent(childId)}`,
        );
        if (history.some((item) => item.recommendations?.length > 0)) {
          const latest = [...history].filter((item) => item.recommendations?.length > 0).sort(
            (left, right) => new Date(right.created_at) - new Date(left.created_at),
          )[0];
          setResult({
            history_id: latest.id,
            child: {
              id: latest.child.id,
              display_name: latest.child.display_name,
              age_months: latest.age_months,
            },
            recommendations: latest.recommendations,
          });
          return;
        }
      }

      const response = await apiFetch("recommend/", {
        method: "POST",
        body: JSON.stringify({ child_id: Number(childId), top_n: 4 }),
      });
      setResult({ ...response, history_id: response.history_id });
    } catch (loadError) {
      setResult(null);
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/recommendations");
      return () => {
        active = false;
      };
    }

    apiFetch("children/")
      .then(async (records) => {
        if (!active) return;
        setChildren(records);
        if (records.length === 0) {
          setError("Create a child profile before requesting recommendations.");
          setIsLoading(false);
          return;
        }
        const firstChildId = String(records[0].id);
        setSelectedChildId(firstChildId);

        if (!records[0].learning_goals?.length) {
          setError("Add at least one learning goal to this child profile first.");
          setIsLoading(false);
          return;
        }

        const history = await apiFetch(
          `recommend/history/?child_id=${encodeURIComponent(firstChildId)}`,
        );
        if (!active) return;
        if (history.some((item) => item.recommendations?.length > 0)) {
          const latest = [...history].filter((item) => item.recommendations?.length > 0).sort(
            (left, right) => new Date(right.created_at) - new Date(left.created_at),
          )[0];
          setResult({
            history_id: latest.id,
            child: {
              id: latest.child.id,
              display_name: latest.child.display_name,
              age_months: latest.age_months,
            },
            recommendations: latest.recommendations,
          });
          setIsLoading(false);
          return;
        }

        const response = await apiFetch("recommend/", {
          method: "POST",
          body: JSON.stringify({ child_id: records[0].id, top_n: 4 }),
        });
        if (active) setResult(response);
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

  const recommendations = result?.recommendations || [];
  const featured = recommendations[0];

  function activityHref(item) {
    const params = new URLSearchParams({
      historyId: String(result.history_id),
      contentId: String(item.id),
    });
    return `/activity?${params.toString()}`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Recommendations" />

        <main className="min-w-0 flex-1">
          <div className="relative flex min-h-12 items-center justify-center border-b border-[#c9dadd] bg-white px-16">
            <Link href="/" className="absolute left-4 rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#176b5b] no-underline hover:bg-[#dbe9eb]">
              ‹ &nbsp; Back
            </Link>
            <h1 className="text-center text-xs font-bold uppercase tracking-[0.14em]">
              Recommendations
            </h1>
          </div>

          <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6 sm:px-8">
            {children.length > 1 ? (
              <label className="mb-4 flex items-center gap-2 text-sm text-[#445f67]">
                Recommended for
                <select
                  value={selectedChildId}
                  onChange={(event) => {
                    const childId = event.target.value;
                    setSelectedChildId(childId);
                    setResult(null);
                    loadRecommendations(childId);
                  }}
                  className="rounded-sm border border-[#c9dadd] bg-white px-2 py-1.5"
                >
                  {children.map((child) => (
                    <option key={child.id} value={String(child.id)}>
                      {child.display_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {isLoading ? (
              <p className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center text-sm text-[#536c73]">
                Loading recommendations…
              </p>
            ) : error ? (
              <div role="alert" className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center">
                <p className="text-sm text-[#445f67]">{error}</p>
                <Link href="/profile" className="mt-4 inline-flex rounded-md border border-[#94aab0] bg-[#c9dadd] px-4 py-2 text-xs font-semibold text-[#176b5b] no-underline hover:bg-[#c9dadd]">
                  Open child profile
                </Link>
              </div>
            ) : featured ? (
              <>
                <section aria-label="Recommendation context" className="mb-5 text-sm text-[#445f67]">
                  <p>
                    <span className="font-semibold">Recommended for:</span>{" "}
                    <span className="rounded-sm border border-[#c9dadd] bg-white px-2 py-1">
                      {result.child.display_name}
                    </span>
                    <span className="mx-2 text-[#647d83]">|</span>
                    Age {formatAge(result.child.age_months)}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="font-semibold">Based on:</span>
                    {isGeneralMedia(featured) ? <span>general age-appropriate media</span> : featured.matched_goals.map((goal) => (
                      <span key={goal} className="inline-flex items-center gap-1">
                        <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-[3px] border border-[#94aab0] bg-[#dbe9eb] text-[10px] leading-none text-[#445f67]">✓</span>
                        {readableGoal(goal)}
                      </span>
                    ))}
                  </p>
                </section>

                <article className="rounded-xl border border-[#c9dadd] bg-white p-4 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)_4.5rem] sm:items-start">
                    <MediaPlaceholder label={featured.content_type || "Activity"} className="w-full sm:w-24" />
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#445f67]">
                        ★ Recommended
                      </span>
                      <h2 className="mt-2 text-lg font-bold">{featured.title}</h2>
                      {isGeneralMedia(featured) ? (
                        <p className="mt-2 text-sm text-[#445f67]">General age-appropriate activity</p>
                      ) : (
                        <p className="mt-2 text-sm text-[#445f67]">
                          Development: <strong className="text-[#304b54]">{featured.matched_goals.map(readableGoal).join(" + ") || "General learning"}</strong>
                        </p>
                      )}
                      <p className="mt-1 text-sm text-[#445f67]">
                        Age suitability: {formatAge(featured.age_range.minimum)}–{formatAge(featured.age_range.maximum)}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#445f67]">
                        Safety: <span aria-hidden="true" className="text-[#445f67]">✓</span> Assessed safe
                      </p>
                    </div>
                    {Number.isFinite(featured.relevance_score) ? (
                      <div className="flex size-[4.5rem] flex-col items-center justify-center self-start rounded-full border border-[#c9dadd] bg-[#e7f0f2] text-center">
                        <span className="text-lg font-bold leading-none">{Math.round(featured.relevance_score * 100)}%</span>
                        <span className="mt-1 text-[9px] uppercase text-[#647d83]">Score</span>
                      </div>
                    ) : null}
                  </div>

                  {Number.isFinite(featured.relevance_score) ? <div className="mt-5 border-t border-[#dbe9eb] pt-4">
                    <div className="mb-2 flex justify-between text-[10px] uppercase tracking-wide text-[#536c73]">
                      <span>Match Strength</span>
                      <span>{Math.round(featured.relevance_score * 100)}%</span>
                    </div>
                    <div role="progressbar" aria-label="Recommendation match strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(featured.relevance_score * 100)} className="h-2.5 overflow-hidden rounded-full border border-[#b6ccd1] bg-[#dbe9eb]">
                      <div className="h-full rounded-full bg-[#647d83]" style={{ width: `${Math.round(featured.relevance_score * 100)}%` }} />
                    </div>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <Link href={activityHref(featured)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#94aab0] bg-[#c9dadd] px-8 text-xs font-bold uppercase tracking-[0.12em] text-[#176b5b] no-underline transition hover:bg-[#c9dadd]">
                        Start Activity
                      </Link>
                      <button type="button" onClick={() => loadRecommendations(selectedChildId, true)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#b6ccd1] bg-white px-5 text-xs font-semibold text-[#36535b] hover:bg-[#eef5f5]">
                        Refresh recommendations
                      </button>
                    </div>
                  </div> : <div className="mt-5 flex flex-wrap justify-center gap-3 border-t border-[#dbe9eb] pt-4">
                    <Link href={activityHref(featured)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#94aab0] bg-[#c9dadd] px-8 text-xs font-bold uppercase tracking-[0.12em] text-[#176b5b] no-underline transition hover:bg-[#c9dadd]">
                      Play Activity
                    </Link>
                    <button type="button" onClick={() => loadRecommendations(selectedChildId, true)} className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#b6ccd1] bg-white px-5 text-xs font-semibold text-[#36535b] hover:bg-[#eef5f5]">
                      Refresh recommendations
                    </button>
                  </div>}
                </article>

                {recommendations.length > 1 ? (
                  <section aria-labelledby="more-recommendations-title" className="mt-6">
                    <h2 id="more-recommendations-title" className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">
                      More Recommendations
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {recommendations.slice(1).map((item) => (
                        <article key={item.id} className="rounded-xl border border-[#c9dadd] bg-white p-3.5">
                          <MediaPlaceholder label={item.content_type || "Activity"} />
                          <div className="py-3 text-center text-sm text-[#536c73]">
                            <h3 className="font-semibold">{item.title}</h3>
                            {isGeneralMedia(item) ? (
                              <p className="mt-1 text-xs">General age-appropriate activity · Ages {formatAge(item.age_range.minimum)}–{formatAge(item.age_range.maximum)}</p>
                            ) : <>
                              <p className="mt-1 text-xs">{item.matched_goals.map(readableGoal).join(" · ")}</p>
                              <p className="mt-1 text-xs">Match: {Math.round(item.relevance_score * 100)}%</p>
                            </>}
                          </div>
                          {Number.isFinite(item.relevance_score) ? <div className="mb-3 h-2 overflow-hidden rounded-full border border-[#b6ccd1] bg-[#dbe9eb]">
                            <div className="h-full rounded-full bg-[#94aab0]" style={{ width: `${Math.round(item.relevance_score * 100)}%` }} />
                          </div> : null}
                          <div className="flex justify-center">
                            <Link href={activityHref(item)} aria-label={`View ${item.title}`} className="rounded-md border border-[#b6ccd1] bg-white px-7 py-1.5 text-xs text-[#36535b] no-underline hover:bg-[#eef5f5]">
                              {isGeneralMedia(item) ? "Play activity" : "View activity"}
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-[#c9dadd] bg-white p-6 text-center">
                <p className="text-sm text-[#445f67]">No matching activities are available for this child yet.</p>
                <p className="mt-2 text-xs text-[#647d83]">Add assessed content to the library, then refresh recommendations.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
