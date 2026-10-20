"use client";

import { useState } from "react";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Activity", href: "/activity" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

const inputClasses =
  "min-w-0 flex-1 rounded-sm border border-[#bdbdbd] bg-white px-2.5 py-2 text-xs text-[#333] outline-none placeholder:text-[#999] focus:border-[#666] focus:ring-2 focus:ring-[#666]/20";

function Toggle({ name, label, defaultChecked = false }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-[#e1e1e1] py-2.5 text-xs">
      <span>{label}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-5 w-10 rounded-full bg-[#c5c5c5] transition-colors peer-checked:bg-[#929292] peer-focus-visible:ring-2 peer-focus-visible:ring-[#666]/40 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        <span className="absolute left-1.5 text-[8px] font-bold text-white peer-checked:opacity-0">OFF</span>
        <span className="absolute right-1.5 text-[8px] font-bold text-white opacity-0 peer-checked:opacity-100">ON</span>
      </span>
    </label>
  );
}

export default function Settings() {
  const [saved, setSaved] = useState(false);

  function handleSave(event) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f0f0f0] text-[#292929]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Settings" />

        <main className="min-w-0 flex-1 px-4 pb-10 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex min-h-14 items-center gap-3 border-b border-[#d0d0d0]">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[#bdbdbd] bg-[#e4e4e4] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#333] hover:bg-[#d8d8d8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]"
              >
                ‹ &nbsp; Back
              </button>
              <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
                Settings Dashboard
              </h1>
            </div>

            <form onSubmit={handleSave} onChange={() => setSaved(false)} className="grid gap-5 pt-5 lg:grid-cols-[242px_minmax(0,1fr)]">
              <div className="space-y-5">
                <section className="rounded-lg border border-[#c5c5c5] bg-white p-4">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide">
                    Account Settings
                  </h2>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-9 shrink-0">Name:</span>
                      <input type="text" name="accountName" placeholder="Enter your name..." className={inputClasses} />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-9 shrink-0">Email:</span>
                      <input type="email" name="email" placeholder="Enter your email address..." className={inputClasses} />
                    </label>
                  </div>

                  <details className="mt-3 text-center">
                    <summary className="cursor-pointer list-none text-xs font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-[#454545]">
                      Change Password
                    </summary>
                    <div className="mt-3 space-y-2 text-left">
                      <label className="block text-[10px] text-[#555]">
                        Current password
                        <input type="password" name="currentPassword" autoComplete="current-password" className={`${inputClasses} mt-1 w-full`} />
                      </label>
                      <label className="block text-[10px] text-[#555]">
                        New password
                        <input type="password" name="newPassword" autoComplete="new-password" className={`${inputClasses} mt-1 w-full`} />
                      </label>
                    </div>
                  </details>
                </section>

                <section className="rounded-lg border border-[#c5c5c5] bg-white p-4">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide">
                    Notification Preferences
                  </h2>
                  <div className="space-y-2.5 text-xs">
                    {[
                      "Learning Progress Updates",
                      "Community Events",
                      "Activity Recommendations",
                      "System Alerts",
                    ].map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input type="checkbox" name="notifications" value={item} defaultChecked={item !== "Community Events"} className="size-3.5 accent-[#666]" />
                        {item}
                      </label>
                    ))}
                  </div>
                  <label className="mt-4 block text-xs">
                    <span className="mb-1.5 block">Notification Frequency:</span>
                    <select name="notificationFrequency" defaultValue="Weekly Digest" className={`${inputClasses} w-full`}>
                      <option>Immediately</option>
                      <option>Daily Summary</option>
                      <option>Weekly Digest</option>
                    </select>
                  </label>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-lg border border-[#c5c5c5] bg-white p-4 sm:p-5">
                  <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide">
                    Privacy &amp; Data Sharing
                  </h2>
                  <label className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e1e1e1] py-3 text-xs">
                    <span>Profile Visibility</span>
                    <select name="profileVisibility" defaultValue="Selected Caregivers" className="rounded-sm border border-[#d0d0d0] bg-white px-2 py-1.5 text-xs font-semibold text-[#444] outline-none focus:border-[#666] focus:ring-2 focus:ring-[#666]/20">
                      <option>Public</option>
                      <option>Private</option>
                      <option>Selected Caregivers</option>
                    </select>
                  </label>
                  <Toggle name="communitySharing" label="Data Sharing with Community" defaultChecked />
                  <Toggle name="anonymousUsageData" label="Anonymized Usage Data" defaultChecked />
                </section>

                <section aria-label="Account plan summary" className="grid gap-3 sm:grid-cols-3">
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c5c5c5] bg-white p-3 text-center">
                    <p className="text-sm">Premium Plan</p>
                    <p className="mt-0.5 text-[10px] text-[#777]">[tier]</p>
                    <button type="button" disabled title="Plan management is not connected yet" className="mt-2 rounded-md border border-[#bdbdbd] bg-[#e5e5e5] px-3 py-1.5 text-[10px] text-[#777] disabled:cursor-not-allowed">
                      Manage Plan
                    </button>
                  </div>
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c5c5c5] bg-white p-3 text-center">
                    <p className="text-sm">Active Profiles: <strong>3</strong></p>
                    <a href="/profile" className="mt-3 rounded-md border border-[#bdbdbd] bg-[#e5e5e5] px-3 py-1.5 text-[10px] text-[#444] no-underline hover:bg-[#d8d8d8]">
                      View Profiles
                    </a>
                  </div>
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c5c5c5] bg-white p-3 text-center">
                    <p className="text-sm">Billing Date: <strong>Jan 15</strong></p>
                    <button type="button" disabled title="Billing is not connected yet" className="mt-3 rounded-md border border-[#bdbdbd] bg-[#e5e5e5] px-3 py-1.5 text-[10px] text-[#777] disabled:cursor-not-allowed">
                      View Invoice
                    </button>
                  </div>
                </section>

                <div className="flex flex-col items-start gap-2">
                  <button type="submit" className="min-h-10 w-full max-w-[280px] rounded-md border border-[#aaa] bg-[#d2d2d2] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#333] transition hover:bg-[#c5c5c5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#454545]">
                    Save Changes
                  </button>
                  <p aria-live="polite" className="min-h-4 text-xs text-[#666]">
                    {saved ? "Settings saved for this session." : " "}
                  </p>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
