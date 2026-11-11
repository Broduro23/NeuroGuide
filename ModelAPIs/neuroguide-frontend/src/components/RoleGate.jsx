"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch, hasAccessToken } from "../lib/api";

const routeRoles = {
  "/activity": ["admin", "caregiver"],
  "/recommendations": ["admin", "caregiver"],
  "/progress": ["admin", "caregiver"],
  "/profile": ["admin", "caregiver", "content_provider"],
  "/settings": ["admin", "caregiver", "content_provider"],
  "/notifications": ["admin", "caregiver", "content_provider"],
  "/content-management": ["admin", "content_provider"],
  "/media-testing": ["admin", "content_provider"],
};

export default function RoleGate({ children }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let active = true;
    if (!hasAccessToken()) {
      setAllowed(false);
      return () => { active = false; };
    }
    apiFetch("profile/")
      .then((profile) => {
        if (active) setAllowed((routeRoles[pathname] || ["admin"]).includes(profile.role));
      })
      .catch(() => { if (active) setAllowed(false); });
    return () => { active = false; };
  }, [pathname]);

  if (allowed === null) return <main className="p-8 text-center text-sm text-[#536c73]">Checking account access…</main>;
  if (!allowed) return <main className="p-8 text-center text-sm text-[#536c73]">You do not have access to this view.</main>;
  return children;
}
