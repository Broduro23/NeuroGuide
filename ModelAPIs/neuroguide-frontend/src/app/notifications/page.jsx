"use client";

import RoleGate from "../../components/RoleGate";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/navbar";
import Sidebar from "../../components/Sidebar";
import { apiFetch, hasAccessToken } from "../../lib/api";

function NotificationsContent() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      router.replace("/login?next=/notifications");
      return () => { active = false; };
    }
    apiFetch("notifications/")
      .then((records) => { if (active) setItems(records); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  async function markRead(item) {
    try {
      await apiFetch(`notifications/${item.id}/read/`, { method: "POST" });
      setItems((current) => current.map((record) => record.id === item.id ? { ...record, read: true } : record));
    } catch (readError) {
      setError(readError.message);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f8f9] text-[#183940]">
      <Navbar />
      <div className="flex flex-1 flex-col sm:flex-row">
        <Sidebar activeItem="Notifications" />
        <main className="min-w-0 flex-1 px-4 py-7 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <Link href="/" className="text-xs text-[#36535b] underline">‹ Back home</Link>
            <h1 className="mt-4 text-2xl font-bold">Notifications</h1>
            <p className="mt-1 text-sm text-[#647d83]">Updates about content you uploaded or flagged.</p>
            {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
            {loading ? <p className="mt-6 rounded-lg border border-[#c9dadd] bg-white p-5 text-sm">Loading notifications…</p> : items.length === 0 ? (
              <p className="mt-6 rounded-lg border border-[#c9dadd] bg-white p-6 text-sm text-[#647d83]">You have no notifications.</p>
            ) : (
              <ul className="mt-6 space-y-3">
                {items.map((item) => (
                  <li key={item.id} className={`rounded-lg border bg-white p-4 ${item.read ? "border-[#c9dadd]" : "border-[#83b4a8]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-[#536c73]">{item.message}</p>
                        <time className="mt-2 block text-xs text-[#80969b]">{new Date(item.created_at).toLocaleString()}</time>
                      </div>
                      {!item.read ? <button type="button" onClick={() => markRead(item)} className="rounded border border-[#b6ccd1] px-3 py-1.5 text-xs hover:bg-[#eef5f5]">Mark read</button> : <span className="text-xs text-[#80969b]">Read</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return <RoleGate><NotificationsContent /></RoleGate>;
}
