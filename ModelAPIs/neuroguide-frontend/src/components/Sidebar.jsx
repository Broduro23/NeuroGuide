"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, hasAccessToken } from "../lib/api";

const defaultItems = [
  { label: "Home", href: "/" },
  { label: "Content Library", href: "/content-management" },
  { label: "Media Testing", href: "/media-testing" },
  { label: "Activity", href: "/activity" },
  { label: "Recommendations", href: "/recommendations" },
  { label: "Progress", href: "/progress" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
  { label: "Notifications", href: "/notifications" },
];

/**
 * Vertical navigation for authenticated/dashboard pages.
 * Pass `activeItem` as the label or href of the current page.
 */
export default function Sidebar({
  items = defaultItems,
  activeItem = "",
  className = "",
  ariaLabel = "Main navigation",
}) {
  const [role, setRole] = useState(null);
  useEffect(() => {
    if (hasAccessToken()) apiFetch("profile/").then((profile) => setRole(profile.role)).catch(() => setRole(""));
  }, []);
  const navigationItems = items.some((item) => item.href === "/notifications")
    ? items
    : [...items, { label: "Notifications", href: "/notifications" }];
  const visibleItems = role === "admin"
    ? navigationItems
    : role === "caregiver"
      ? navigationItems.filter((item) => ["/activity", "/recommendations", "/progress", "/profile", "/settings", "/notifications"].includes(item.href))
      : role === "content_provider"
        ? navigationItems.filter((item) => ["/content-management", "/media-testing", "/profile", "/settings", "/notifications"].includes(item.href))
        : navigationItems;
  return (
    <aside
      className={`min-h-full w-full border-b border-[#c9dadd] bg-white text-[#536c73] sm:w-40 sm:min-w-40 sm:border-b-0 sm:border-r ${className}`.trim()}
    >
      <nav aria-label={ariaLabel}>
        <ul className="m-0 flex list-none overflow-x-auto p-0 sm:block">
          {visibleItems.map((item) => {
            const active = activeItem === item.label || activeItem === item.href;

            return (
              <li key={item.href}>
                <Link
                  className={`flex min-h-11 shrink-0 items-center gap-2.5 border-t-[3px] px-3.5 text-sm text-inherit no-underline transition-colors hover:bg-[#f5f5f5] hover:text-[#193c44] focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#287a71] sm:min-h-12 sm:shrink sm:border-l-[3px] sm:border-t-0 sm:px-5 ${
                    active
                      ? "border-t-[#287a71] bg-[#f3f8f9] font-bold text-[#102c33] sm:border-l-[#287a71]"
                      : "border-t-transparent sm:border-l-transparent"
                  }`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon ? (
                    <span className="inline-flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center" aria-hidden="true">
                      {item.icon}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
