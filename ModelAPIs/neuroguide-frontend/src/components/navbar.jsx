"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, clearTokens, hasAccessToken } from "../lib/api";

/** Top application bar with configurable branding and account actions. */
export default function Navbar({
  brandName = "NeuroGuide",
  logo = "NG",
  userName = "Profile",
  avatarLabel,
  homeHref = "/",
  notificationsHref = "/notifications",
  profileHref = "/profile",
  className = "",
}) {
  const router = useRouter();
  const [sessionName, setSessionName] = useState(userName);
  const [hasSession, setHasSession] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSessionDetails() {
      if (!hasAccessToken()) {
        await Promise.resolve();
        if (active) {
          setHasSession(false);
          setUnreadCount(0);
          setSessionName(userName);
        }
        return;
      }

      try {
        const [profile, notifications] = await Promise.all([
          apiFetch("profile/"),
          apiFetch("notifications/"),
        ]);
        if (!active) return;
        const fullName = [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        setHasSession(true);
        setSessionName(fullName || profile.username || userName);
        setUnreadCount(notifications.filter((item) => !item.read).length);
      } catch {
        if (!active) return;
        setHasSession(false);
        setUnreadCount(0);
        setSessionName(userName);
      }
    }

    loadSessionDetails();
    const interval = window.setInterval(loadSessionDetails, 30_000);
    window.addEventListener("focus", loadSessionDetails);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadSessionDetails);
    };
  }, [userName]);

  function logOut() {
    clearTokens();
    setHasSession(false);
    setUnreadCount(0);
    setSessionName(userName);
    setProfileMenuOpen(false);
    router.push(homeHref);
    router.refresh();
  }

  const nameParts = sessionName.trim().split(/\s+/).filter(Boolean);
  const initials = avatarLabel ?? (
    nameParts.length > 1
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
      : (nameParts[0] || "P").slice(0, 2)
  ).toUpperCase();

  return (
    <header
      className={`flex min-h-14 w-full items-center justify-between border-b border-[#c9dadd] bg-white px-4 text-[#193c44] sm:px-6 ${className}`.trim()}
    >
      <Link
        href={homeHref}
        className="flex min-w-0 items-center gap-2.5 text-inherit no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287a71]"
        aria-label={`${brandName} home`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] text-[0.55rem] font-medium text-[#536c73]">
          {logo}
        </span>
        <span className="truncate text-base font-bold tracking-wide sm:text-lg">
          {brandName}
        </span>
      </Link>

      <div className="ml-4 flex shrink-0 items-center gap-3 sm:gap-4">
        {hasSession ? <Link
          href={notificationsHref}
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative flex size-8 items-center justify-center rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] text-[#536c73] transition-colors hover:bg-[#dbe9eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="size-4"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
          {unreadCount > 0 ? <span aria-hidden="true" className="absolute right-0 top-0 size-2.5 translate-x-1/4 -translate-y-1/4 rounded-full bg-red-600 ring-2 ring-white" /> : null}
        </Link> : null}

        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="flex items-center gap-2 text-sm text-inherit hover:text-[#536c73] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
          >
            <span className="flex size-8 items-center justify-center rounded-full border border-[#b6ccd1] bg-[#e7f0f2] text-[0.6rem] text-[#536c73]">
              {initials}
            </span>
            <span className="hidden sm:inline">{sessionName}</span>
          </button>
          {profileMenuOpen ? (
            <div role="menu" className="absolute right-0 z-50 mt-2 min-w-44 rounded-lg border border-[#c9dadd] bg-white p-1.5 shadow-lg">
              {hasSession ? (
                <>
                  <Link role="menuitem" href={profileHref} onClick={() => setProfileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-[#304b54] no-underline hover:bg-[#eef5f5]">My profile</Link>
                  <button role="menuitem" type="button" onClick={logOut} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Log out</button>
                </>
              ) : (
                <>
                  <Link role="menuitem" href="/login" onClick={() => setProfileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-[#304b54] no-underline hover:bg-[#eef5f5]">Log in</Link>
                  <Link role="menuitem" href="/register" onClick={() => setProfileMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-[#304b54] no-underline hover:bg-[#eef5f5]">Create account</Link>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
