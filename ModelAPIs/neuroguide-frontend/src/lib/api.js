const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api/ModelAPIs/RecEngine"
).replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "neuroguide.access";
const REFRESH_TOKEN_KEY = "neuroguide.refresh";

function apiUrl(path) {
  const endpoint = String(path).replace(/^\/+/, "");
  const queryIndex = endpoint.indexOf("?");
  const pathname = queryIndex === -1 ? endpoint : endpoint.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : endpoint.slice(queryIndex);
  const slashTerminatedPath = pathname.endsWith("/")
    ? pathname
    : `${pathname}/`;

  return `${API_BASE_URL}/${slashTerminatedPath}${query}`;
}

export function saveTokens(tokens) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  if (tokens.refresh) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasAccessToken() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY))
  );
}

function errorMessage(payload, status) {
  if (typeof payload === "string" && payload) return payload;
  if (payload?.detail) return payload.detail;
  if (payload?.error) return payload.error;

  if (payload && typeof payload === "object") {
    const messages = Object.entries(payload).flatMap(([field, value]) => {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return [`${field}: ${text}`];
    });
    if (messages.length) return messages.join(" ");
  }

  return `Request failed (${status}).`;
}

async function readResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function refreshAccessToken() {
  if (typeof window === "undefined") return false;

  const refresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return false;

  try {
    const response = await fetch(apiUrl("refresh/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) {
      clearTokens();
      return false;
    }

    saveTokens(await response.json());
    return true;
  } catch {
    return false;
  }
}

/** Fetch a Django REST endpoint through the same-origin Next.js proxy. */
export async function apiFetch(path, options = {}) {
  const { auth = true, retryAfterRefresh = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  if (fetchOptions.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth && typeof window !== "undefined") {
    const access = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (access) headers.set("Authorization", `Bearer ${access}`);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { ...fetchOptions, headers });
  } catch {
    throw new Error("Could not reach NeuroGuide. Check that the API is running.");
  }

  if (
    response.status === 401 &&
    auth &&
    retryAfterRefresh &&
    (await refreshAccessToken())
  ) {
    const access = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    headers.set("Authorization", `Bearer ${access}`);
    response = await fetch(apiUrl(path), { ...fetchOptions, headers });
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearTokens();
      if (typeof window !== "undefined") {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?next=${encodeURIComponent(next)}`);
      }
    }
    throw new Error(errorMessage(payload, response.status));
  }

  return payload;
}
