"use client";

import { useEffect, useState } from "react";
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

const inputClasses =
  "min-w-0 flex-1 rounded-sm border border-[#b6ccd1] bg-white px-2.5 py-2 text-xs text-[#176b5b] outline-none placeholder:text-[#647d83] focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20";

function Toggle({ name, label, defaultChecked = false }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-[#d9e9e8] py-2.5 text-xs">
      <span>{label}</span>
      <span className="relative inline-flex shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-5 w-10 rounded-full bg-[#c9dadd] transition-colors peer-checked:bg-[#647d83] peer-focus-visible:ring-2 peer-focus-visible:ring-[#536c73]/40 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        <span className="absolute left-1.5 text-[8px] font-bold text-white peer-checked:opacity-0">OFF</span>
        <span className="absolute right-1.5 text-[8px] font-bold text-white opacity-0 peer-checked:opacity-100">ON</span>
      </span>
    </label>
  );
}

export default function Settings() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [account, setAccount] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
  });
  const [childCount, setChildCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/settings");
      return () => {
        active = false;
      };
    }

    Promise.all([apiFetch("profile/"), apiFetch("children/")])
      .then(([profile, children]) => {
        if (!active) return;
        setAccount(profile);
        setChildCount(children.length);
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

  async function handleSave(event) {
    event.preventDefault();
    setSaved(false);
    setError("");
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);

    try {
      const updatedProfile = await apiFetch("profile/", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: formData.get("firstName"),
          last_name: formData.get("lastName"),
          email: formData.get("email"),
        }),
      });
      setAccount(updatedProfile);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />

      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar items={navigationItems} activeItem="Settings" />

        <main className="min-w-0 flex-1 px-4 pb-10 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex min-h-14 items-center gap-3 border-b border-[#c9dadd]">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[#176b5b] hover:bg-[#dbe9eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
              >
                ‹ &nbsp; Back
              </button>
              <h1 className="text-xs font-bold uppercase tracking-[0.14em]">
                Settings Dashboard
              </h1>
            </div>

            {isLoading ? (
              <p className="py-10 text-center text-sm text-[#536c73]">Loading settings…</p>
            ) : (
            <form onSubmit={handleSave} onChange={() => setSaved(false)} className="grid gap-5 pt-5 lg:grid-cols-[242px_minmax(0,1fr)]">
              <div className="space-y-5">
                <section className="rounded-lg border border-[#c9dadd] bg-white p-4">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide">
                    Account Settings
                  </h2>
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0">First name:</span>
                      <input type="text" name="firstName" value={account.first_name} onChange={(event) => setAccount((current) => ({ ...current, first_name: event.target.value }))} placeholder="First name" className={inputClasses} />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0">Last name:</span>
                      <input type="text" name="lastName" value={account.last_name} onChange={(event) => setAccount((current) => ({ ...current, last_name: event.target.value }))} placeholder="Last name" className={inputClasses} />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0">Email:</span>
                      <input type="email" name="email" value={account.email} onChange={(event) => setAccount((current) => ({ ...current, email: event.target.value }))} placeholder="Email address" className={inputClasses} />
                    </label>
                    <p className="text-[10px] text-[#647d83]">Username: {account.username}</p>
                  </div>

                  <p className="mt-3 text-[10px] text-[#647d83]">Password changes are not available through the current API.</p>
                </section>

                <section className="rounded-lg border border-[#c9dadd] bg-white p-4">
                  <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wide">
                    Notification Preferences
                  </h2>
                  <p className="mb-3 text-[10px] text-[#647d83]">Preview only: notification preferences are not stored by the API yet.</p>
                  <div className="space-y-2.5 text-xs">
                    {[
                      "Learning Progress Updates",
                      "Community Events",
                      "Activity Recommendations",
                      "System Alerts",
                    ].map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input type="checkbox" name="notifications" value={item} defaultChecked={item !== "Community Events"} className="size-3.5 accent-[#536c73]" />
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
                <section className="rounded-lg border border-[#c9dadd] bg-white p-4 sm:p-5">
                  <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide">
                    Privacy &amp; Data Sharing
                  </h2>
                  <p className="mb-2 text-[10px] text-[#647d83]">These controls are not connected to a backend setting yet.</p>
                  <label className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d9e9e8] py-3 text-xs">
                    <span>Profile Visibility</span>
                    <select name="profileVisibility" defaultValue="Selected Caregivers" className="rounded-sm border border-[#c9dadd] bg-white px-2 py-1.5 text-xs font-semibold text-[#36535b] outline-none focus:border-[#536c73] focus:ring-2 focus:ring-[#536c73]/20">
                      <option>Public</option>
                      <option>Private</option>
                      <option>Selected Caregivers</option>
                    </select>
                  </label>
                  <Toggle name="communitySharing" label="Data Sharing with Community" defaultChecked />
                  <Toggle name="anonymousUsageData" label="Anonymized Usage Data" defaultChecked />
                </section>

                <section aria-label="Account plan summary" className="grid gap-3 sm:grid-cols-3">
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c9dadd] bg-white p-3 text-center">
                    <p className="text-sm">Plan &amp; Billing</p>
                    <p className="mt-1 text-[10px] text-[#647d83]">No billing endpoint available</p>
                  </div>
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c9dadd] bg-white p-3 text-center">
                    <p className="text-sm">Child Profiles: <strong>{childCount}</strong></p>
                    <a href="/profile" className="mt-3 rounded-md border border-[#b6ccd1] bg-[#e7f0f2] px-3 py-1.5 text-[10px] text-[#36535b] no-underline hover:bg-[#dbe9eb]">
                      View Profiles
                    </a>
                  </div>
                  <div className="flex min-h-24 flex-col items-center justify-center rounded-lg border border-[#c9dadd] bg-white p-3 text-center">
                    <p className="text-sm">Recommendation History</p>
                    <p className="mt-1 text-[10px] text-[#647d83]">Available in the API</p>
                    <a href="/recommendations" className="mt-2 rounded-md border border-[#b6ccd1] bg-[#e7f0f2] px-3 py-1.5 text-[10px] text-[#36535b] no-underline hover:bg-[#dbe9eb]">
                      View Recommendations
                    </a>
                  </div>
                </section>

                <div className="flex flex-col items-start gap-2">
                  <button type="submit" disabled={isSaving} className="min-h-10 w-full max-w-[280px] rounded-md border border-[#94aab0] bg-[#c9dadd] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#176b5b] transition hover:bg-[#c9dadd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71] disabled:cursor-wait disabled:opacity-60">
                    {isSaving ? "Saving…" : "Save Account Details"}
                  </button>
                  <p aria-live="polite" className="min-h-4 text-xs text-[#536c73]">
                    {saved ? "Account details saved." : " "}
                  </p>
                  {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
                </div>
              </div>
            </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
