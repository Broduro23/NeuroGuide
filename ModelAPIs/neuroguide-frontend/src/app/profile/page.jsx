"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";

// Temporary profile values for the screen. These can be replaced by profile
// data from the API when the database connection is ready.
const childProfile = {
  name: "Child Name",
  age: "4 years",
  interests: ["Animals", "Stories"],
  developmentalAreas: [
    { name: "Cognitive", progress: 80 },
    { name: "Language", progress: 90 },
    { name: "Literacy", progress: 60 },
    { name: "Numeracy", progress: 70 },
    { name: "Motor", progress: 80 },
    { name: "Social-Emotional", progress: 70 },
  ],
  developmentalStage: "4–5 Years",
  overallProgress: 75,
  activitiesDone: 24,
  streak: "7 days",
};

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

const inputClasses =
  "min-w-0 rounded-sm border border-[#bdbdbd] bg-white px-2 py-1.5 text-xs text-[#333] outline-none focus:border-[#666] focus:ring-2 focus:ring-[#666]/20";

export default function Profile() {
  const [saved, setSaved] = useState(false);
  const [childName, setChildName] = useState(childProfile.name);

  function handleSave(event) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Profile" />

        <main className="min-w-0 flex-1 px-4 pb-10 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex min-h-14 items-center gap-3 border-b border-[#d0d0d0]">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-sm border border-[#bdbdbd] bg-[#e4e4e4] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#333] no-underline hover:bg-[#d8d8d8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="m10 3-5 5 5 5M5 8h9" />
                </svg>
                Back
              </Link>
              <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
                Child Profile
              </h1>
            </div>

            <form onSubmit={handleSave} onChange={() => setSaved(false)}>
              <div className="grid gap-6 pt-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7">
                <section aria-label="Child information" className="space-y-4">
                  <div className="flex flex-col items-center">
                    <div
                      aria-label="Child photo placeholder"
                      className="relative flex aspect-square w-28 items-center justify-center overflow-hidden border border-[#aaa] bg-[#dedede] text-[9px] uppercase text-[#888] sm:w-32"
                    >
                      <span className="absolute left-[-8%] top-1/2 h-px w-[116%] -rotate-45 bg-[#b0b0b0]" />
                      <span className="absolute left-[-8%] top-1/2 h-px w-[116%] rotate-45 bg-[#b0b0b0]" />
                      <span className="relative bg-[#dedede]/70 px-1">Photo</span>
                    </div>
                    <h2 className="mt-2 text-sm font-bold uppercase tracking-[0.08em]">
                      {childName || "Child Name"}
                    </h2>
                  </div>

                  <fieldset className="rounded-lg border border-[#c5c5c5] bg-white p-3.5">
                    <legend className="sr-only">Basic information</legend>
                    <p className="mb-3 text-[11px] font-semibold text-[#444]">
                      Basic Information
                    </p>

                    <div className="space-y-3 text-xs">
                      <label className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
                        <span>Name:</span>
                        <input
                          type="text"
                          name="childName"
                          value={childName}
                          onChange={(event) => setChildName(event.target.value)}
                          placeholder="Enter child name..."
                          className={inputClasses}
                        />
                      </label>

                      <label className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
                        <span>Age:</span>
                        <select
                          name="childAge"
                          defaultValue={childProfile.age}
                          className={`${inputClasses} w-fit`}
                        >
                          <option>2 years</option>
                          <option>3 years</option>
                          <option>4 years</option>
                          <option>5 years</option>
                          <option>6 years</option>
                        </select>
                      </label>

                      <fieldset className="border-0 p-0">
                        <legend className="mb-2">Interests:</legend>
                        <div className="flex flex-wrap gap-x-2.5 gap-y-2">
                          {["Animals", "Stories", "Music", "Numbers"].map(
                            (interest) => (
                              <label
                                key={interest}
                                className="inline-flex items-center gap-1 whitespace-nowrap text-[10px]"
                              >
                                <input
                                  type="checkbox"
                                  name="interests"
                                  value={interest}
                                  defaultChecked={childProfile.interests.includes(
                                    interest,
                                  )}
                                  className="size-3 accent-[#666]"
                                />
                                {interest}
                              </label>
                            ),
                          )}
                        </div>
                      </fieldset>
                    </div>
                  </fieldset>
                </section>

                <section aria-label="Developmental progress" className="space-y-4">
                  <div className="rounded-lg border border-[#c5c5c5] bg-white p-4 sm:p-5">
                    <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wide">
                      Developmental Areas
                    </h2>

                    <div className="space-y-2.5">
                      {childProfile.developmentalAreas.map((area) => (
                        <div
                          key={area.name}
                          className="grid grid-cols-[5rem_minmax(0,1fr)_2rem] items-center gap-2 text-[10px] sm:grid-cols-[6rem_minmax(0,1fr)_2rem]"
                        >
                          <span>{area.name}</span>
                          <div
                            className="h-2.5 overflow-hidden rounded-full border border-[#c3c3c3] bg-[#dedede]"
                            role="progressbar"
                            aria-label={`${area.name} progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={area.progress}
                          >
                            <div
                              className="h-full rounded-full bg-[#929292]"
                              style={{ width: `${area.progress}%` }}
                            />
                          </div>
                          <span className="text-right">{area.progress}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 border-t border-[#e1e1e1] pt-3 text-center text-[10px] text-[#666]">
                      Developmental Stage: {childProfile.developmentalStage}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      {
                        value: `${childProfile.overallProgress}%`,
                        label: "Overall Progress",
                      },
                      { value: childProfile.activitiesDone, label: "Activities Done" },
                      { value: childProfile.streak, label: "Streak" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-[#c5c5c5] bg-white px-2 py-3"
                      >
                        <span className="text-base font-medium">{stat.value}</span>
                        <span className="mt-1 text-center text-[9px] text-[#777] sm:text-[10px]">
                          {stat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="w-full max-w-[280px] rounded-md border border-[#aaa] bg-[#d2d2d2] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#333] transition hover:bg-[#c5c5c5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
                    >
                      Save Profile
                    </button>
                    <p aria-live="polite" className="min-h-4 text-xs text-[#666]">
                      {saved ? "Profile saved for this session." : " "}
                    </p>
                  </div>
                </section>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
