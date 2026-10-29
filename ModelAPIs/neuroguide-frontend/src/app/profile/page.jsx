"use client";

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

const learningGoals = [
  ["number_identification", "Number identification"],
  ["number_size_discrimination", "Number size"],
  ["letter_alphabet_knowledge", "Letters and alphabet"],
  ["phonological_awareness", "Sound awareness"],
  ["expressive_language", "Expressive language"],
  ["receptive_language", "Listening and comprehension"],
  ["fine_motor", "Fine motor"],
  ["mental_flexibility", "Flexible thinking"],
  ["working_memory", "Working memory"],
  ["inhibition", "Self-control"],
  ["approaches_to_learning_play", "Learning through play"],
  ["social_competence", "Social competence"],
  ["relationship_skills", "Relationship skills"],
  ["interpersonal_conflict_resolution", "Conflict resolution"],
  ["prosocial_behaviour", "Prosocial behavior"],
  ["social_cognition", "Social understanding"],
  ["theory_of_mind", "Perspective taking"],
  ["empathy", "Empathy"],
  ["emotion_knowledge", "Emotion knowledge"],
  ["self_regulation", "Self-regulation"],
];

const interestOptions = [
  "Animals",
  "Stories",
  "Music",
  "Numbers",
  "Puzzles",
  "Art",
  "Movement",
];

const emptyForm = {
  display_name: "",
  age_months: "48",
  learning_goals: [],
  interests: [],
  notes: "",
};

const inputClasses =
  "min-w-0 rounded-md border border-[#b6ccd1] bg-white px-3 py-2 text-sm text-[#176b5b] outline-none focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20";

function profileToForm(profile) {
  if (!profile) return emptyForm;
  return {
    display_name: profile.display_name || "",
    age_months: String(profile.age_months ?? 48),
    learning_goals: profile.learning_goals || [],
    interests: profile.interests || [],
    notes: profile.notes || "",
  };
}

function formatGoal(goal) {
  return learningGoals.find(([value]) => value === goal)?.[1] || goal;
}

export default function Profile() {
  const router = useRouter();
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedChild = useMemo(
    () => children.find((child) => String(child.id) === selectedChildId),
    [children, selectedChildId],
  );

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }

    apiFetch("children/")
      .then((records) => {
        if (!active) return;
        setChildren(records);
        const firstChild = records[0];
        setSelectedChildId(firstChild ? String(firstChild.id) : "");
        setForm(profileToForm(firstChild));
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

  useEffect(() => {
    if (!selectedChildId || !hasAccessToken()) {
      setHistory([]);
      return;
    }

    let active = true;
    apiFetch(`recommend/history/?child_id=${encodeURIComponent(selectedChildId)}`)
      .then((records) => {
        if (active) setHistory(records);
      })
      .catch(() => {
        if (active) setHistory([]);
      });

    return () => {
      active = false;
    };
  }, [selectedChildId]);

  function startNewProfile() {
    setSelectedChildId("");
    setForm(emptyForm);
    setHistory([]);
    setError("");
    setSaved(false);
  }

  function selectChild(childId) {
    setSelectedChildId(childId);
    const profile = children.find((child) => String(child.id) === childId);
    setForm(profileToForm(profile));
    setError("");
    setSaved(false);
  }

  function toggleValue(field, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value],
    }));
    setSaved(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setSaved(false);

    const ageMonths = Number(form.age_months);
    if (!Number.isInteger(ageMonths) || ageMonths < 0 || ageMonths > 83) {
      setError("Age must be between 0 and 83 months.");
      return;
    }
    if (form.learning_goals.length === 0) {
      setError("Choose at least one learning goal to enable recommendations.");
      return;
    }

    setIsSaving(true);
    const payload = {
      display_name: form.display_name.trim(),
      age_months: ageMonths,
      learning_goals: form.learning_goals,
      interests: form.interests,
      notes: form.notes,
    };

    try {
      const savedProfile = await apiFetch(
        selectedChildId ? `children/${selectedChildId}/` : "children/",
        {
          method: selectedChildId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setChildren((current) => {
        const exists = current.some((child) => child.id === savedProfile.id);
        return exists
          ? current.map((child) =>
              child.id === savedProfile.id ? savedProfile : child,
            )
          : [savedProfile, ...current];
      });
      setSelectedChildId(String(savedProfile.id));
      setForm(profileToForm(savedProfile));
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const completedActivities = history.reduce(
    (total, session) =>
      total + session.activities.filter((item) => item.event_type === "completed").length,
    0,
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Profile" />

        <main className="min-w-0 flex-1 px-4 pb-10 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[#c9dadd] py-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#176b5b] no-underline hover:bg-[#dbe9eb]"
              >
                ‹ &nbsp; Back
              </Link>
              <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
                Child Profile
              </h1>
              <div className="ml-auto flex items-center gap-2">
                {children.length > 0 ? (
                  <select
                    aria-label="Choose child profile"
                    value={selectedChildId}
                    onChange={(event) => selectChild(event.target.value)}
                    className="max-w-40 rounded-sm border border-[#b6ccd1] bg-white px-2 py-1.5 text-xs"
                  >
                    {children.map((child) => (
                      <option key={child.id} value={String(child.id)}>
                        {child.display_name}
                      </option>
                    ))}
                    <option value="">New profile</option>
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={startNewProfile}
                  className="rounded-sm border border-[#b6ccd1] bg-white px-2.5 py-1.5 text-xs hover:bg-[#eef5f5]"
                >
                  Add child
                </button>
              </div>
            </div>

            {isLoading ? (
              <p className="py-10 text-center text-sm text-[#536c73]">Loading child profiles…</p>
            ) : (
              <form onSubmit={handleSave} onChange={() => setSaved(false)}>
                <div className="grid gap-6 pt-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7">
                  <section aria-label="Child information" className="space-y-4">
                    <div className="flex flex-col items-center">
                      <div
                        aria-hidden="true"
                        className="relative flex aspect-square w-28 items-center justify-center overflow-hidden border border-[#94aab0] bg-[#dbe9eb] text-[9px] uppercase text-[#536c73] sm:w-32"
                      >
                        <span className="absolute left-[-8%] top-1/2 h-px w-[116%] -rotate-45 bg-[#94aab0]" />
                        <span className="absolute left-[-8%] top-1/2 h-px w-[116%] rotate-45 bg-[#94aab0]" />
                        <span className="relative bg-[#dbe9eb]/70 px-1">Photo</span>
                      </div>
                      <h2 className="mt-2 text-sm font-bold uppercase tracking-[0.08em]">
                        {form.display_name || "Child Name"}
                      </h2>
                    </div>

                    <fieldset className="rounded-lg border border-[#c9dadd] bg-white p-3.5">
                      <legend className="sr-only">Basic information</legend>
                      <p className="mb-3 text-[11px] font-semibold text-[#36535b]">
                        Basic Information
                      </p>
                      <div className="space-y-3 text-xs">
                        <label className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
                          <span>Name:</span>
                          <input
                            required
                            type="text"
                            name="display_name"
                            value={form.display_name}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                display_name: event.target.value,
                              }))
                            }
                            className={inputClasses}
                          />
                        </label>
                        <label className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
                          <span>Age:</span>
                          <span className="flex items-center gap-2">
                            <input
                              required
                              type="number"
                              min="0"
                              max="83"
                              name="age_months"
                              value={form.age_months}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  age_months: event.target.value,
                                }))
                              }
                              className={`${inputClasses} w-20`}
                            />
                            <span className="text-[#536c73]">months</span>
                          </span>
                        </label>
                        <fieldset>
                          <legend className="mb-1.5">Interests:</legend>
                          <span className="flex flex-wrap gap-x-3 gap-y-2">
                            {interestOptions.map((interest) => (
                              <label key={interest} className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={form.interests.includes(interest)}
                                  onChange={() => toggleValue("interests", interest)}
                                  className="size-3.5 accent-[#536c73]"
                                />
                                {interest}
                              </label>
                            ))}
                          </span>
                        </fieldset>
                        <label className="block">
                          <span className="mb-1.5 block">Notes:</span>
                          <textarea
                            name="notes"
                            rows="3"
                            value={form.notes}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            className={`${inputClasses} w-full resize-y`}
                          />
                        </label>
                      </div>
                    </fieldset>
                  </section>

                  <section aria-label="Learning goals and activity history" className="space-y-4">
                    <div className="rounded-lg border border-[#c9dadd] bg-white p-4 sm:p-5">
                      <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
                        Developmental Learning Goals
                      </h2>
                      <p className="mb-4 text-xs text-[#647d83]">
                        Choose the areas to use when finding activities.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {learningGoals.map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2 text-xs text-[#36535b]">
                            <input
                              type="checkbox"
                              checked={form.learning_goals.includes(value)}
                              onChange={() => toggleValue("learning_goals", value)}
                              className="size-3.5 accent-[#536c73]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {[
                        { value: history.length, label: "Recommendation Sessions" },
                        { value: completedActivities, label: "Activities Completed" },
                        { value: form.learning_goals.length, label: "Learning Goals" },
                      ].map((stat) => (
                        <div key={stat.label} className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-[#c9dadd] bg-white px-2 py-3 text-center">
                          <span className="text-base font-medium">{stat.value}</span>
                          <span className="mt-1 text-[9px] text-[#647d83] sm:text-[10px]">{stat.label}</span>
                        </div>
                      ))}
                    </div>

                    {selectedChild ? (
                      <div className="rounded-lg border border-[#c9dadd] bg-white p-4">
                        <h2 className="text-[11px] font-bold uppercase tracking-wide">Saved Learning Goals</h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedChild.learning_goals.map((goal) => (
                            <span key={goal} className="rounded-full border border-[#c9dadd] bg-[#edf4f5] px-3 py-1 text-xs">
                              {formatGoal(goal)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full max-w-[280px] rounded-md border border-[#94aab0] bg-[#c9dadd] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#176b5b] transition hover:bg-[#c9dadd] disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSaving
                          ? "Saving…"
                          : selectedChildId
                            ? "Save Profile"
                            : "Create Profile"}
                      </button>
                      <p role="status" className="min-h-4 text-xs text-[#176b4d]">
                        {saved ? "Profile saved." : " "}
                      </p>
                      {error ? <p role="alert" className="text-center text-xs text-red-700">{error}</p> : null}
                    </div>
                  </section>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
