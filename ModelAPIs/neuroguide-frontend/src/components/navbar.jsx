"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, hasAccessToken } from "../lib/api";

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
  const [sessionName, setSessionName] = useState(userName);

  useEffect(() => {
    let active = true;

    if (!hasAccessToken()) {
      setSessionName("Profile");
      return () => {
        active = false;
      };
    }

    apiFetch("profile/")
      .then((profile) => {
        if (!active) return;
        const fullName = [profile.first_name, profile.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        setSessionName(fullName || profile.username || userName);
      })
      .catch(() => {
        if (active) setSessionName(userName);
      });

    return () => {
      active = false;
    };
  }, [userName]);

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
        <Link
          href={notificationsHref}
          aria-label="Notifications"
          className="flex size-8 items-center justify-center rounded-sm border border-[#b6ccd1] bg-[#e7f0f2] text-[#536c73] transition-colors hover:bg-[#dbe9eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
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
        </Link>

        <Link
          href={profileHref}
          className="flex items-center gap-2 text-sm text-inherit no-underline hover:text-[#536c73] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287a71]"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-[#b6ccd1] bg-[#e7f0f2] text-[0.6rem] text-[#536c73]">
            {initials}
          </span>
          <span className="hidden sm:inline">{sessionName}</span>
        </Link>
      </div>
    </header>
  );
}
